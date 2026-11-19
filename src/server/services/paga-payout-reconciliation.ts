import "server-only";
import { q, q1, withTx } from "@/server/db";
import { parsePagaNairaToKobo, type PagaPayoutCallback } from "@/server/payments/paga-hash";
import { getPagaTransactionStatus, pagaProvider } from "@/server/payments/paga";
import { getPaymentProvider } from "@/server/payments/simulator";
import { notify } from "@/server/services/notifications";
import { writeAudit } from "@/server/audit";

type ReconciledPayoutStatus = "paid" | "pending" | "reversed" | "unknown" | "duplicate";

async function applyPagaPayoutStatus(
  referenceNumber: string,
  providerStatus: Record<string, unknown>,
  deduplicateNotification = false,
): Promise<ReconciledPayoutStatus> {
  const responseCode = String(providerStatus.responseCode ?? "");
  const reversalId = typeof providerStatus.reversalId === "string" && providerStatus.reversalId
    ? providerStatus.reversalId
    : null;
  const transactionId = typeof providerStatus.transactionId === "string" && providerStatus.transactionId
    ? providerStatus.transactionId
    : null;
  const reportedAmountKobo = parsePagaNairaToKobo(providerStatus.amount);
  const providerResult: ReconciledPayoutStatus =
    reversalId ? "reversed" :
    responseCode === "0" ? "paid" :
    "pending";

  return withTx(async (tx, defer) => {
    if (deduplicateNotification) {
      const inserted = await q1<{ reference_number: string }>(tx, `INSERT INTO paga_payout_notifications
        (reference_number) VALUES ($1) ON CONFLICT (reference_number) DO NOTHING RETURNING reference_number`,
      [referenceNumber]);
      if (!inserted) return "duplicate";
    }

    const payout = await q1<{
      id: string;
      order_id: string;
      amount_kobo: number;
      status: string;
      kind: string;
      last_error: string | null;
      seller_id: string;
      seller_email: string;
      title: string;
    }>(tx, `SELECT p.id, p.order_id, p.amount_kobo, p.status, p.kind, p.last_error,
        o.seller_id, u.email AS seller_email, o.title
      FROM payouts p JOIN orders o ON o.id=p.order_id JOIN users u ON u.id=o.seller_id
      WHERE p.paga_reference_number=$1 FOR UPDATE OF p`, [referenceNumber]);
    if (!payout) return "unknown";

    if ((providerResult === "paid" || providerResult === "reversed") && reportedAmountKobo !== payout.amount_kobo) {
      await tx.query(`UPDATE payouts SET status=CASE WHEN status IN ('processing','failed') THEN 'pending' ELSE status END,
        last_error='Paga transaction amount did not match the saved payout.', updated_at=now() WHERE id=$1`, [payout.id]);
      if (payout.last_error !== "Paga transaction amount did not match the saved payout.") {
        await writeAudit(tx, {
          actorType: "system",
          actorLabel: "paga:reconcile",
          action: "paga.payout_amount_mismatch",
          targetType: "payout",
          targetId: payout.id,
          before: { amountKobo: payout.amount_kobo },
          after: { amountKobo: reportedAmountKobo, referenceNumber },
        });
      }
      return "pending";
    }

    const currentFinal = payout.status === "paid" || payout.status === "reversed";
    const nextStatus = payout.status === "reversed"
      ? "reversed"
      : providerResult === "reversed"
        ? "reversed"
        : payout.status === "paid"
          ? "paid"
          : providerResult;
    const changed = payout.status !== nextStatus;
    const statusMessage = providerStatus.message
      ? String(providerStatus.message).slice(0, 200)
      : `Paga response code ${responseCode || "missing"}.`;
    await tx.query(`UPDATE payouts SET status=$2, provider_reference=COALESCE($3,provider_reference),
      paga_transaction_id=COALESCE($3,paga_transaction_id), reversal_id=COALESCE($4,reversal_id),
      last_error=CASE WHEN $2 IN ('pending','failed') THEN $5 ELSE NULL END, updated_at=now() WHERE id=$1`,
    [payout.id, nextStatus, transactionId, reversalId, statusMessage]);

    if (changed || (providerResult === "pending" && payout.last_error !== statusMessage)) {
      await writeAudit(tx, {
        actorType: "system",
        actorLabel: "paga:reconcile",
        action: `paga.payout_${nextStatus}`,
        targetType: "payout",
        targetId: payout.id,
        before: { status: payout.status },
        after: { status: nextStatus, referenceNumber, transactionId, reversalId },
      });
      if (payout.kind === "seller_payout" && (!currentFinal || nextStatus === "reversed") && nextStatus !== "pending") {
        await notify(tx, defer, {
          userId: payout.seller_id,
          type: "payout",
          title: nextStatus === "paid" ? "Payout sent" : nextStatus === "reversed" ? "Payout was returned" : "Payout needs attention",
          message: nextStatus === "paid"
            ? `Your payout for "${payout.title}" reached your bank.`
            : nextStatus === "reversed"
              ? `Your bank returned the payout for "${payout.title}". PaySafr support will review it.`
              : `Your payout for "${payout.title}" was not completed. PaySafr support will review it.`,
          orderId: payout.order_id,
          ...(nextStatus === "paid" ? { email: { to: payout.seller_email, path: `/orders/${payout.order_id}`, buttonLabel: "View order" } } : {}),
        });
      }
    }
    return nextStatus;
  });
}

export async function reconcilePagaPayout(referenceNumber: string): Promise<ReconciledPayoutStatus> {
  const providerStatus = await getPagaTransactionStatus(referenceNumber);
  if (String(providerStatus.responseCode ?? "") === "135") {
    const retried = await resubmitPagaPayoutOnce(referenceNumber);
    if (retried) return retried;
  }
  return applyPagaPayoutStatus(referenceNumber, providerStatus);
}

async function resubmitPagaPayoutOnce(referenceNumber: string): Promise<ReconciledPayoutStatus | null> {
  const payout = await withTx(async (tx) => {
    const row = await q1<{
      id: string;
      amount_kobo: number;
      status: string;
      attempts: number;
      paga_same_ref_retry_used: boolean;
      paga_destination_bank_code: string | null;
      paga_destination_account_number: string | null;
      paga_destination_account_name: string | null;
    }>(tx, `SELECT id, amount_kobo, status, attempts, paga_same_ref_retry_used, paga_destination_bank_code,
        paga_destination_account_number, paga_destination_account_name
      FROM payouts WHERE paga_reference_number=$1
        AND status IN ('processing','pending')
        AND updated_at < now() - interval '5 seconds'
      FOR UPDATE`, [referenceNumber]);
    const bankCode = row?.paga_destination_bank_code;
    const accountNumber = row?.paga_destination_account_number;
    const accountName = row?.paga_destination_account_name;
    if (!row || row.paga_same_ref_retry_used || !bankCode || !accountNumber || !accountName) return null;
    await tx.query(`UPDATE payouts SET paga_same_ref_retry_used=true, status='processing',
      attempts=attempts+1, updated_at=now() WHERE id=$1`, [row.id]);
    await writeAudit(tx, {
      actorType: "system",
      actorLabel: "paga:reconcile",
      action: "paga.payout_same_reference_retry",
      targetType: "payout",
      targetId: row.id,
      before: { status: row.status, attempts: row.attempts, sameReferenceRetryUsed: false },
      after: { status: "processing", attempts: row.attempts + 1, sameReferenceRetryUsed: true, referenceNumber },
    });
    return { id: row.id, amountKobo: row.amount_kobo, bankCode, accountNumber, accountName };
  });
  if (!payout) return null;

  let error: string | null = null;
  try {
    const result = await pagaProvider.initiatePayout({
      payoutId: referenceNumber,
      amountKobo: payout.amountKobo,
      bankCode: payout.bankCode,
      accountNumber: payout.accountNumber,
      accountName: payout.accountName,
    });
    error = result.error ?? null;
  } catch {
    error = "Paga same-reference resubmission outcome requires reconciliation.";
  }
  await q(undefined, `UPDATE payouts SET status='pending', last_error=$2, updated_at=now()
    WHERE id=$1 AND status='processing'`, [payout.id, error]);
  return "pending";
}

export async function processPagaPayoutNotification(
  payload: PagaPayoutCallback,
): Promise<ReconciledPayoutStatus> {
  const referenceNumber = typeof payload.referenceNumber === "string" ? payload.referenceNumber : "";
  if (!referenceNumber) return "unknown";
  return applyPagaPayoutStatus(referenceNumber, payload, true);
}

export async function reconcilePagaPayouts(limit = 50): Promise<number> {
  if (getPaymentProvider().name !== "paga") return 0;
  const rows = await q<{ paga_reference_number: string }>(undefined, `SELECT paga_reference_number FROM payouts
    WHERE kind='seller_payout' AND status IN ('processing','pending') AND paga_reference_number IS NOT NULL
      AND updated_at < now() - interval '5 seconds'
    ORDER BY updated_at LIMIT $1`, [limit]);
  let reconciled = 0;
  for (const row of rows) {
    await reconcilePagaPayout(row.paga_reference_number);
    reconciled++;
  }

  const refunds = await q<{
    id: string;
    order_id: string;
    amount_kobo: number;
    provider_reference: string | null;
  }>(undefined, `SELECT id, order_id, amount_kobo, provider_reference FROM payouts
    WHERE kind='buyer_refund' AND status IN ('processing','pending') AND provider_reference IS NOT NULL
      AND updated_at < now() - interval '5 seconds'
    ORDER BY updated_at LIMIT $1`, [limit]);
  for (const payout of refunds) {
    const result = await pagaProvider.initiateRefund({
      payoutId: payout.provider_reference!,
      amountKobo: payout.amount_kobo,
      orderId: payout.order_id,
    });
    await q(undefined, `UPDATE payouts SET status=$2, last_error=$3, updated_at=now() WHERE id=$1
      AND status IN ('processing','pending')`,
    [payout.id, result.status, result.error ?? null]);
    reconciled++;
  }
  return reconciled;
}
