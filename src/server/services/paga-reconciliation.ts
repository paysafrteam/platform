import "server-only";
import { q, q1, withTx } from "@/server/db";
import { parsePagaNairaToKobo, type PagaPaymentCallback } from "@/server/payments/paga-hash";
import { getCollectPaymentStatus } from "@/server/payments/paga";
import { getPaymentProvider } from "@/server/payments/simulator";
import { recordFundingInTransaction } from "@/server/services/funding";
import { writeAudit } from "@/server/audit";

type PaymentApplyResult = "paid" | "pending" | "review" | "unknown" | "duplicate";
interface Notification {
  id: string;
  event: string | null;
  payload: PagaPaymentCallback;
}

async function applyCollectStatus(
  referenceNumber: string,
  statusResponse: Awaited<ReturnType<typeof getCollectPaymentStatus>> | undefined,
  notification?: Notification,
): Promise<PaymentApplyResult> {
  return withTx(async (tx, defer) => {
    if (notification) {
      const inserted = await q1<{ notification_id: string }>(tx, `INSERT INTO paga_notifications
        (notification_id, external_reference_number, event) VALUES ($1,$2,$3)
        ON CONFLICT (notification_id) DO NOTHING RETURNING notification_id`,
      [notification.id, referenceNumber, notification.event]);
      if (!inserted) return "duplicate";
    }

    const request = await q1<{
      id: string;
      order_id: string;
      status: string;
      request_amount_kobo: number;
      total_payment_amount_kobo: number | null;
      last_error: string | null;
      order_total_kobo: number;
      order_status: string;
    }>(tx, `SELECT p.id, p.order_id, p.status, p.request_amount_kobo, p.total_payment_amount_kobo,
        p.last_error, o.total_kobo AS order_total_kobo, o.status AS order_status
      FROM paga_payment_requests p JOIN orders o ON o.id=p.order_id
      WHERE p.reference_number=$1 FOR UPDATE OF p,o`, [referenceNumber]);
    if (!request) return "unknown";

    const callback = notification?.payload;
    const callbackStatusCode = String(callback?.statusCode ?? "");
    const paymentStatusCode = statusResponse
      ? String(statusResponse.data.statusCode ?? "")
      : callbackStatusCode;
    await tx.query(`UPDATE paga_payment_requests SET last_status_code=$2, last_checked_at=now(), updated_at=now()
      WHERE id=$1`, [request.id, paymentStatusCode || statusResponse?.responseCode || null]);

    if (
      (statusResponse && statusResponse.responseCode !== "0") ||
      paymentStatusCode !== "0" ||
      (callback && callbackStatusCode !== "0") ||
      (callback && String(callback.state ?? "").toUpperCase() !== "CONSUMED")
    ) return "pending";

    const reportedRequestAmount = statusResponse
      ? parsePagaNairaToKobo(statusResponse.data.requestAmount)
      : request.request_amount_kobo;
    const reportedTotalAmount = statusResponse
      ? parsePagaNairaToKobo(statusResponse.data.totalPaymentAmount)
      : request.total_payment_amount_kobo;
    const callbackPaymentAmount = callback ? parsePagaNairaToKobo(callback.paymentAmount) : null;
    const callbackCumulativeAmount = callback ? parsePagaNairaToKobo(callback.cumulativePaymentAmount) : null;
    const recoveringUnknownCreate =
      statusResponse !== undefined &&
      request.total_payment_amount_kobo === null &&
      (request.status === "creating" ||
        (request.status === "review" && request.last_error === "Provider request outcome requires reconciliation."));
    const mismatch =
      reportedRequestAmount !== request.request_amount_kobo ||
      request.request_amount_kobo !== request.order_total_kobo ||
      reportedTotalAmount === null ||
      (request.total_payment_amount_kobo !== null && request.total_payment_amount_kobo !== reportedTotalAmount) ||
      (request.total_payment_amount_kobo === null && !recoveringUnknownCreate) ||
      (callback && (
        callbackPaymentAmount !== reportedTotalAmount ||
        callbackCumulativeAmount !== reportedTotalAmount
      ));

    if (mismatch) {
      await tx.query(`UPDATE paga_payment_requests SET status='review',
        last_error='Paga amount did not match the saved payment request.', updated_at=now() WHERE id=$1`, [request.id]);
      await tx.query(`UPDATE orders SET order_account_bank=NULL, order_account_number=NULL, order_account_name=NULL,
        order_account_expires_at=NULL, order_account_total_payment_kobo=NULL, needs_refund_flag=true, updated_at=now()
        WHERE id=$1`, [request.order_id]);
      if (request.last_error !== "Paga amount did not match the saved payment request.") {
        await writeAudit(tx, {
          actorType: "system",
          actorLabel: "paga:reconcile",
          action: "paga.payment_amount_mismatch",
          targetType: "order",
          targetId: request.order_id,
          before: {
            orderAmountKobo: request.order_total_kobo,
            requestAmountKobo: request.request_amount_kobo,
            expectedTransferKobo: request.total_payment_amount_kobo,
          },
          after: {
            statusRequestAmountKobo: reportedRequestAmount,
            statusTransferAmountKobo: reportedTotalAmount,
            callbackPaymentAmountKobo: callbackPaymentAmount,
            callbackCumulativeAmountKobo: callbackCumulativeAmount,
            referenceNumber,
          },
        });
      }
      return "review";
    }

    await tx.query(`UPDATE paga_payment_requests SET status='paid',
      total_payment_amount_kobo=COALESCE(total_payment_amount_kobo,$2), last_error=NULL, updated_at=now()
      WHERE id=$1`, [request.id, reportedTotalAmount]);
    const funding = await recordFundingInTransaction(tx, defer, {
      orderId: request.order_id,
      amountKobo: request.request_amount_kobo,
      provider: "paga",
      providerReference: referenceNumber,
      raw: { ...(statusResponse ? { status: statusResponse.data } : {}), ...(callback ? { callback } : {}) },
    });
    if (!funding.duplicate) {
      await writeAudit(tx, {
        actorType: "system",
        actorLabel: "paga:collect",
        action: "paga.payment_funded",
        targetType: "order",
        targetId: request.order_id,
        before: { orderStatus: request.order_status },
        after: { orderStatus: funding.status, providerReference: referenceNumber, amountKobo: request.request_amount_kobo },
      });
    }
    return "paid";
  });
}

export async function reconcilePagaPaymentRequest(referenceNumber: string): Promise<PaymentApplyResult> {
  const status = await getCollectPaymentStatus(referenceNumber);
  return applyCollectStatus(referenceNumber, status);
}

export async function processPagaPaymentNotification(
  payload: PagaPaymentCallback & { event?: unknown },
): Promise<PaymentApplyResult> {
  const referenceNumber = typeof payload.externalReferenceNumber === "string" ? payload.externalReferenceNumber : "";
  const notificationId = typeof payload.notificationId === "string" ? payload.notificationId : "";
  const existing = await q1<{ notification_id: string }>(undefined,
    "SELECT notification_id FROM paga_notifications WHERE notification_id=$1", [notificationId]);
  if (existing) return "duplicate";

  const notification = {
    id: notificationId,
    event: typeof payload.event === "string" ? payload.event : null,
    payload,
  };
  if (
    !referenceNumber ||
    String(payload.statusCode ?? "") !== "0" ||
    String(payload.state ?? "").toUpperCase() !== "CONSUMED"
  ) return applyCollectStatus(referenceNumber, undefined, notification);

  const request = await q1<{ reference_number: string }>(undefined,
    "SELECT reference_number FROM paga_payment_requests WHERE reference_number=$1", [referenceNumber]);
  if (!request) return applyCollectStatus(referenceNumber, undefined, notification);

  const status = await getCollectPaymentStatus(referenceNumber);
  return applyCollectStatus(referenceNumber, status, notification);
}

export async function reconcilePagaPaymentRequests(limit = 50): Promise<number> {
  if (getPaymentProvider().name !== "paga") return 0;
  const rows = await q<{ reference_number: string }>(undefined, `SELECT reference_number FROM paga_payment_requests
    WHERE status IN ('pending','review')
      AND COALESCE(last_checked_at,updated_at) < now() - interval '30 seconds'
    ORDER BY COALESCE(last_checked_at,updated_at) LIMIT $1`, [limit]);
  let reconciled = 0;
  for (const row of rows) {
    await reconcilePagaPaymentRequest(row.reference_number);
    reconciled++;
  }
  return reconciled;
}
