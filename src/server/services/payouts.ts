import "server-only";
import { q, q1, withTx } from "@/server/db";
import { getPaymentProvider } from "@/server/payments/simulator";
import { notify } from "@/server/services/notifications";

interface PayoutCtx {
  id: string; order_id: string; kind: "seller_payout" | "buyer_refund"; amount_kobo: number; status: string; attempts: number;
  seller_id: string; seller_email: string; title: string;
  bank_code: string | null; account_number: string | null; account_name: string | null;
}

/** Claims a queued/failed payout, calls the provider OUTSIDE any transaction, then records the result. Safe to call concurrently. */
export async function processPayout(payoutId: string): Promise<"paid" | "failed" | "skipped" | "processing"> {
  const claimed = await withTx(async (tx) => {
    const p = await q1<PayoutCtx>(tx, `SELECT p.id, p.order_id, p.kind, p.amount_kobo, p.status, p.attempts, o.seller_id, u.email AS seller_email, o.title,
        pa.bank_code, pa.account_number, pa.account_name
      FROM payouts p JOIN orders o ON o.id = p.order_id JOIN users u ON u.id = o.seller_id LEFT JOIN payout_accounts pa ON pa.user_id = o.seller_id
      WHERE p.id = $1 FOR UPDATE OF p`, [payoutId]);
    if (!p || (p.status !== "queued" && p.status !== "failed")) return null;
    await q(tx, "UPDATE payouts SET status='processing', attempts = attempts + 1, updated_at = now() WHERE id=$1", [payoutId]);
    return p;
  });
  if (!claimed) return "skipped";

  const provider = getPaymentProvider();
  let result;
  try {
    result = claimed.kind === "buyer_refund"
      ? await provider.initiateRefund({ payoutId, amountKobo: claimed.amount_kobo, orderId: claimed.order_id })
      : await provider.initiatePayout({ payoutId, amountKobo: claimed.amount_kobo, bankCode: claimed.bank_code ?? "", accountNumber: claimed.account_number ?? "", accountName: claimed.account_name ?? "" });
  } catch (e) {
    result = { status: "failed" as const, reference: `ERR-${payoutId}`, error: e instanceof Error ? e.message.slice(0, 200) : "Provider error" };
  }
  await withTx(async (tx, defer) => {
    await q(tx, "UPDATE payouts SET status=$2, provider_reference=$3, last_error=$4, updated_at=now() WHERE id=$1",
      [payoutId, result.status, result.reference, result.error ?? null]);
    if (result.status === "failed" && claimed.kind === "seller_payout") {
      await notify(tx, defer, { userId: claimed.seller_id, type: "payout", title: "Payout needs attention",
        message: `Your payout for "${claimed.title}" could not be sent. PaySafr will retry it; your money is safe.`, orderId: claimed.order_id });
    }
    if (result.status === "paid" && claimed.kind === "seller_payout") {
      await notify(tx, defer, { userId: claimed.seller_id, type: "payout", title: "Payout sent",
        message: `Your payout for "${claimed.title}" is on its way to your bank account.`, orderId: claimed.order_id,
        email: { to: claimed.seller_email, path: `/orders/${claimed.order_id}`, buttonLabel: "View order" } });
    }
  });
  return result.status;
}
