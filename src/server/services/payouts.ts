import "server-only";
import { q, q1, withTx } from "@/server/db";
import { getPaymentProvider } from "@/server/payments/simulator";
import { notify } from "@/server/services/notifications";

interface PayoutCtx {
  id: string; order_id: string; kind: "seller_payout" | "buyer_refund"; amount_kobo: number; status: string; attempts: number;
  seller_id: string; seller_email: string; title: string;
  bank_code: string | null; account_number: string | null; account_name: string | null;
  paga_reference_number: string | null;
  paga_destination_bank_code: string | null; paga_destination_account_number: string | null;
  paga_destination_account_name: string | null;
}

/** Claims a queued/failed payout, calls the provider OUTSIDE any transaction, then records the result. Safe to call concurrently. */
export async function processPayout(payoutId: string): Promise<"paid" | "failed" | "skipped" | "processing"> {
  const claimed = await withTx(async (tx) => {
    const p = await q1<PayoutCtx>(tx, `SELECT p.id, p.order_id, p.kind, p.amount_kobo, p.status, p.attempts,
      p.paga_reference_number, p.paga_destination_bank_code, p.paga_destination_account_number,
      p.paga_destination_account_name, o.seller_id, u.email AS seller_email, o.title,
      pa.bank_code, pa.account_number, pa.account_name
      FROM payouts p JOIN orders o ON o.id = p.order_id JOIN users u ON u.id = o.seller_id LEFT JOIN payout_accounts pa ON pa.user_id = o.seller_id
      WHERE p.id = $1 FOR UPDATE OF p`, [payoutId]);
    if (!p || (p.status !== "queued" && p.status !== "failed")) return null;
    const pagaReference = getPaymentProvider().name === "paga" && p.kind === "seller_payout"
      ? p.status === "failed" && p.attempts > 0
        ? `${p.id}-${p.attempts + 1}`
        : p.paga_reference_number ?? p.id
      : p.paga_reference_number;
    const snapshotPagaDestination = getPaymentProvider().name === "paga" && p.kind === "seller_payout";
    await q(tx, `UPDATE payouts SET status='processing', attempts = attempts + 1,
      paga_reference_number=CASE WHEN $2 IS NULL THEN paga_reference_number ELSE $2 END,
      paga_same_ref_retry_used=CASE WHEN $6 THEN false ELSE paga_same_ref_retry_used END,
      paga_destination_bank_code=CASE WHEN $6 THEN $3 ELSE paga_destination_bank_code END,
      paga_destination_account_number=CASE WHEN $6 THEN $4 ELSE paga_destination_account_number END,
      paga_destination_account_name=CASE WHEN $6 THEN $5 ELSE paga_destination_account_name END,
      updated_at = now() WHERE id=$1`,
    [payoutId, pagaReference, p.bank_code, p.account_number, p.account_name, snapshotPagaDestination]);
    return {
      ...p,
      paga_reference_number: pagaReference,
      paga_destination_bank_code: snapshotPagaDestination ? p.bank_code : p.paga_destination_bank_code,
      paga_destination_account_number: snapshotPagaDestination ? p.account_number : p.paga_destination_account_number,
      paga_destination_account_name: snapshotPagaDestination ? p.account_name : p.paga_destination_account_name,
    };
  });
  if (!claimed) return "skipped";

  const provider = getPaymentProvider();
  let result;
  try {
    result = claimed.kind === "buyer_refund"
      ? await provider.initiateRefund({ payoutId, amountKobo: claimed.amount_kobo, orderId: claimed.order_id })
      : await provider.initiatePayout({ payoutId: claimed.paga_reference_number ?? payoutId, amountKobo: claimed.amount_kobo, bankCode: claimed.bank_code ?? "", accountNumber: claimed.account_number ?? "", accountName: claimed.account_name ?? "" });
  } catch (e) {
    result = provider.name === "paga"
      ? { status: "processing" as const, reference: claimed.paga_reference_number ?? payoutId, error: "Paga request outcome requires reconciliation." }
      : { status: "failed" as const, reference: `ERR-${payoutId}`, error: e instanceof Error ? e.message.slice(0, 200) : "Provider error" };
  }
  await withTx(async (tx, defer) => {
    await q(tx, `UPDATE payouts SET status=$2, provider_reference=$3,
      paga_reference_number=COALESCE(paga_reference_number,$4), last_error=$5, updated_at=now() WHERE id=$1`,
      [payoutId, result.status, result.reference, provider.name === "paga" && claimed.kind === "seller_payout" ? result.reference : null, result.error ?? null]);
    if (result.status === "failed" && claimed.kind === "seller_payout") {
      await notify(tx, defer, { userId: claimed.seller_id, type: "payout", title: "Payout needs attention",
        message: provider.name === "paga"
          ? `Your payout for "${claimed.title}" could not be verified and needs review. PaySafr will not resend it automatically.`
          : `Your payout for "${claimed.title}" could not be sent. PaySafr will retry it; your money is safe.`,
        orderId: claimed.order_id });
    }
    if (result.status === "paid" && claimed.kind === "seller_payout") {
      await notify(tx, defer, { userId: claimed.seller_id, type: "payout", title: "Payout sent",
        message: `Your payout for "${claimed.title}" is on its way to your bank account.`, orderId: claimed.order_id,
        email: { to: claimed.seller_email, path: `/orders/${claimed.order_id}`, buttonLabel: "View order" } });
    }
  });
  return result.status;
}
