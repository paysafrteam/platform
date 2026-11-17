import "server-only";
import type { PoolClient } from "pg";
import { q, q1, withTx, type Db, type Defer } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { issueReceipt, orderForReceipt } from "@/server/services/receipts";
import { emailBuyer, notify } from "@/server/services/notifications";
import { processPayout } from "@/server/services/payouts";
import { recomputeTrust } from "@/server/services/trust";
import { formatNaira } from "@/lib/format/money";

export interface LockedOrder {
  id: string; seller_id: string; token: string; title: string; status: string; total_kobo: number; buyer_email: string | null;
  review_window_hours: number; seller_email: string;
}
export interface LockedMilestone { id: string; order_id: string; position: number; title: string; amount_kobo: number; fee_kobo: number; status: string }

/** Lock order first, then its milestones in position order (consistent order avoids deadlocks). */
export async function lockOrder(tx: Db, orderId: string): Promise<{ order: LockedOrder; milestones: LockedMilestone[] }> {
  const order = await q1<LockedOrder>(tx, `SELECT o.id, o.seller_id, o.token, o.title, o.status, o.total_kobo, o.buyer_email, o.review_window_hours, u.email AS seller_email
    FROM orders o JOIN users u ON u.id = o.seller_id WHERE o.id = $1 FOR UPDATE OF o`, [orderId]);
  if (!order) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  const milestones = await q<LockedMilestone>(tx, "SELECT id, order_id, position, title, amount_kobo, fee_kobo, status FROM milestones WHERE order_id=$1 ORDER BY position FOR UPDATE", [orderId]);
  return { order, milestones };
}

export async function heldBalance(tx: Db, orderId: string): Promise<number> {
  const r = await q1<{ held: number }>(tx, "SELECT COALESCE(SUM(CASE WHEN type='funding' THEN amount_kobo ELSE -amount_kobo END),0)::bigint AS held FROM ledger_entries WHERE order_id=$1", [orderId]);
  return r?.held ?? 0;
}

export async function queuePayout(tx: Db, p: { orderId: string; milestoneId: string | null; kind: "seller_payout" | "buyer_refund"; amountKobo: number; key: string }): Promise<string> {
  const row = await q1<{ id: string }>(tx, `INSERT INTO payouts (order_id, milestone_id, kind, amount_kobo, idempotency_key) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = payouts.updated_at RETURNING id`, [p.orderId, p.milestoneId, p.kind, p.amountKobo, p.key]);
  return row!.id;
}

/** Writes release (net) + fee ledger entries for `grossKobo` of a milestone, refusing to take held below zero. Returns the net. */
export async function writeRelease(tx: Db, p: { orderId: string; milestoneId: string; grossKobo: number; feeKobo: number; keySuffix?: string }): Promise<number> {
  const net = p.grossKobo - p.feeKobo;
  if (net <= 0) throw new AppError("INVALID_STATE", "Release amount must be positive.");
  if ((await heldBalance(tx, p.orderId)) < p.grossKobo) throw new AppError("INVALID_STATE", "Held balance is insufficient for this release.");
  const sfx = p.keySuffix ?? "";
  await q(tx, "INSERT INTO ledger_entries (order_id, milestone_id, type, amount_kobo, reference, idempotency_key) VALUES ($1,$2,'release',$3,$4,$5)",
    [p.orderId, p.milestoneId, net, `REL-${p.milestoneId.slice(0, 8)}`, `release:${p.milestoneId}${sfx}`]);
  if (p.feeKobo > 0) {
    await q(tx, "INSERT INTO ledger_entries (order_id, milestone_id, type, amount_kobo, reference, idempotency_key) VALUES ($1,$2,'fee',$3,$4,$5)",
      [p.orderId, p.milestoneId, p.feeKobo, `FEE-${p.milestoneId.slice(0, 8)}`, `fee:${p.milestoneId}${sfx}`]);
  }
  return net;
}

export async function writeRefund(tx: Db, p: { orderId: string; milestoneId: string | null; amountKobo: number; key: string }) {
  if (p.amountKobo <= 0) return;
  if ((await heldBalance(tx, p.orderId)) < p.amountKobo) throw new AppError("INVALID_STATE", "Held balance is insufficient for this refund.");
  await q(tx, "INSERT INTO ledger_entries (order_id, milestone_id, type, amount_kobo, reference, idempotency_key) VALUES ($1,$2,'refund',$3,$4,$5)",
    [p.orderId, p.milestoneId, p.amountKobo, `REF-${(p.milestoneId ?? p.orderId).slice(0, 8)}`, p.key]);
}

export async function finalizeOrderIfDone(tx: Db, defer: Defer, order: LockedOrder) {
  const rows = await q<{ status: string }>(tx, "SELECT status FROM milestones WHERE order_id=$1", [order.id]);
  if (!rows.length || !rows.every((m) => m.status === "released" || m.status === "refunded")) return false;
  await q(tx, "UPDATE orders SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1 AND status='funded'", [order.id]);
  await recomputeTrust(tx, order.seller_id, order.id, "order_completed");
  await notify(tx, defer, { userId: order.seller_id, type: "released", title: "Order completed", message: `"${order.title}" is complete.`, orderId: order.id });
  return true;
}

/**
 * The only path that releases money outside dispute resolution. Safe against double clicks and buyer-vs-auto races:
 * the milestone must still be 'delivered' after the order row is locked.
 */
export async function settleMilestone(input: { milestoneId: string; trigger: "buyer" | "auto" }): Promise<{ orderId: string; payoutId: string }> {
  const ref = await q1<{ order_id: string }>(undefined, "SELECT order_id FROM milestones WHERE id=$1", [input.milestoneId]);
  if (!ref) throw new AppError("NOT_FOUND", "We couldn't find this milestone.");
  const out = await withTx(async (tx, defer) => {
    const { order, milestones } = await lockOrder(tx, ref.order_id);
    const m = milestones.find((x) => x.id === input.milestoneId);
    if (!m || order.status !== "funded" || m.status !== "delivered") {
      throw new AppError("INVALID_STATE", "This delivery is no longer waiting for confirmation.");
    }
    const net = await writeRelease(tx, { orderId: order.id, milestoneId: m.id, grossKobo: m.amount_kobo, feeKobo: m.fee_kobo });
    await q(tx, "UPDATE milestones SET status='released', released_at=now(), updated_at=now() WHERE id=$1", [m.id]);
    const payoutId = await queuePayout(tx, { orderId: order.id, milestoneId: m.id, kind: "seller_payout", amountKobo: net, key: `payout:${m.id}:seller_payout` });
    await issueReceipt(tx, await orderForReceipt(tx, order.id), "completion",
      { milestoneId: m.id, milestoneTitle: m.title, amountKobo: m.amount_kobo, feeKobo: m.fee_kobo, netKobo: net, outcome: "released" });
    await notify(tx, defer, { userId: order.seller_id, type: "released", title: "Money released",
      message: `${formatNaira(net)} for "${m.title}" was released${input.trigger === "auto" ? " automatically after the review window" : " after the buyer confirmed"}.`,
      orderId: order.id, email: { to: order.seller_email, path: `/orders/${order.id}`, buttonLabel: "View order" } });
    emailBuyer(defer, order.buyer_email, "Payment released", `Your payment for "${m.title}" was released to the seller. Thank you for using PaySafr.`, `/pay/${order.token}`, "View receipt");
    await finalizeOrderIfDone(tx, defer, order);
    defer(() => processPayout(payoutId));
    return { orderId: order.id, payoutId };
  });
  return out;
}

export type { PoolClient };
