import "server-only";
import { q, q1, withTx } from "@/server/db";
import { issueReceipt, orderForReceipt } from "@/server/services/receipts";
import { emailBuyer, notify } from "@/server/services/notifications";
import { formatNaira } from "@/lib/format/money";

export interface FundingResult { orderId: string; status: string; duplicate: boolean; amountFundedKobo: number }

/**
 * The ONLY code path that credits an order. Called by the sandbox simulator now and by the verified Paga webhook later.
 * One transaction, order row locked, idempotent on (provider, providerReference).
 */
export async function recordFunding(input: { orderId: string; amountKobo: number; provider: string; providerReference: string; raw?: unknown }): Promise<FundingResult> {
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) throw new RangeError("Funding amount must be positive integer kobo.");
  return withTx(async (tx, defer) => {
    const order = await q1<{ id: string; seller_id: string; title: string; status: string; total_kobo: number; amount_funded_kobo: number; buyer_email: string | null; token: string }>(
      tx, "SELECT id, seller_id, title, status, total_kobo, amount_funded_kobo, buyer_email, token FROM orders WHERE id=$1 FOR UPDATE", [input.orderId]);
    if (!order) throw new Error("Order not found for funding.");

    const dup = await q1<{ id: string }>(tx, "SELECT id FROM payments WHERE provider=$1 AND provider_reference=$2", [input.provider, input.providerReference]);
    if (dup) return { orderId: order.id, status: order.status, duplicate: true, amountFundedKobo: order.amount_funded_kobo };

    let payStatus: "applied" | "flagged_late" | "flagged_over" = "applied";
    let newStatus = order.status;
    let overpaid = 0;
    let flag = false;
    const funded = order.amount_funded_kobo + input.amountKobo;

    if (order.status === "awaiting_payment") {
      if (funded >= order.total_kobo) {
        newStatus = "funded";
        overpaid = funded - order.total_kobo;
        if (overpaid > 0) { payStatus = "flagged_over"; flag = true; }
      }
    } else if (order.status === "funded" || order.status === "completed") {
      payStatus = "flagged_over"; overpaid = input.amountKobo; flag = true;
    } else {
      payStatus = "flagged_late"; flag = true; // expired, cancelled or draft: the money really arrived and must be refunded
    }

    await q(tx, "INSERT INTO payments (order_id, provider, provider_reference, amount_kobo, status, raw) VALUES ($1,$2,$3,$4,$5,$6)",
      [order.id, input.provider, input.providerReference, input.amountKobo, payStatus, input.raw === undefined ? null : JSON.stringify(input.raw)]);
    await q(tx, "INSERT INTO ledger_entries (order_id, type, amount_kobo, reference, idempotency_key) VALUES ($1,'funding',$2,$3,$4)",
      [order.id, input.amountKobo, input.providerReference, `funding:${input.provider}:${input.providerReference}`]);
    await q(tx, `UPDATE orders SET amount_funded_kobo=$2, status=$3, overpaid_kobo = overpaid_kobo + $4,
        needs_refund_flag = needs_refund_flag OR $5, funded_at = CASE WHEN $3 = 'funded' AND status <> 'funded' THEN now() ELSE funded_at END, updated_at=now() WHERE id=$1`,
      [order.id, funded, newStatus, overpaid, flag]);

    if (order.status === "awaiting_payment" && newStatus === "funded") {
      await issueReceipt(tx, await orderForReceipt(tx, order.id), "payment", { amountKobo: order.total_kobo, outcome: "funded" });
      const seller = await q1<{ email: string }>(tx, "SELECT email FROM users WHERE id=$1", [order.seller_id]);
      await notify(tx, defer, { userId: order.seller_id, type: "funded", title: "Order funded",
        message: `${formatNaira(order.total_kobo)} for "${order.title}" is held safely. You can start work.`, orderId: order.id,
        ...(seller ? { email: { to: seller.email, path: `/orders/${order.id}`, buttonLabel: "Open order" } } : {}) });
      emailBuyer(defer, order.buyer_email, "Payment received", `Your payment of ${formatNaira(order.total_kobo)} for "${order.title}" is held safely until you confirm delivery.`, `/pay/${order.token}`, "View your order");
    }
    return { orderId: order.id, status: newStatus, duplicate: false, amountFundedKobo: funded };
  });
}

/** Sandbox only: stands in for the buyer's bank transfer so the whole flow can be tried without real money. */
export async function simulateBuyerPayment(token: string): Promise<FundingResult & { amountKobo: number }> {
  const { isProd } = await import("@/server/env");
  const { AppError } = await import("@/server/http/errors");
  const { rateLimit } = await import("@/server/http/ratelimit");
  const { randomToken } = await import("@/server/ids");
  if (isProd()) throw new AppError("NOT_FOUND", "Not found.");
  await rateLimit({ key: `simulate:${token}`, limit: 20, windowSeconds: 3600 });
  const o = await q1<{ id: string; total_kobo: number; amount_funded_kobo: number; status: string }>(undefined, "SELECT id, total_kobo, amount_funded_kobo, status FROM orders WHERE token=$1 AND status <> 'draft'", [token]);
  if (!o) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  if (o.status !== "awaiting_payment") throw new AppError("INVALID_STATE", "This order is not waiting for payment.");
  const amount = o.total_kobo - o.amount_funded_kobo;
  const r = await recordFunding({ orderId: o.id, amountKobo: amount, provider: "simulator", providerReference: `SIM-${randomToken(9)}`, raw: { simulated: true } });
  return { ...r, amountKobo: amount };
}
