import "server-only";
import { q, q1, type Db } from "@/server/db";
import type { TrustLevel } from "@/lib/domain/types";

export const QUALIFYING_MIN_ORDERS = 3;
export const QUALIFYING_MIN_KOBO = 100_000; // ₦1,000
export interface QualifyingOrder { valueKobo: number; onTime: boolean; disputed: boolean; lossWeight: number }

/** Pure scoring: weights from the project documentation, response time omitted until tracked (weights rescaled). */
export function computeTrust(orders: QualifyingOrder[]): { score: number | null; level: TrustLevel } {
  const n = orders.length;
  if (n < QUALIFYING_MIN_ORDERS) return { score: null, level: "new" };
  const clean = orders.filter((o) => !o.disputed).length / n;
  const disputeScore = Math.max(0, 1 - orders.reduce((s, o) => s + o.lossWeight, 0) / n);
  const onTime = orders.filter((o) => o.onTime).length / n;
  const value = orders.reduce((s, o) => s + o.valueKobo, 0);
  const experience = Math.min(1, n / 20) * 0.6 + Math.min(1, value / 200_000_000) * 0.4;
  const score = Math.round((100 * (35 * clean + 25 * disputeScore + 20 * onTime + 10 * experience)) / 90);
  const clamped = Math.max(0, Math.min(100, score));
  return { score: clamped, level: clamped >= 60 ? "trusted" : "rising" };
}

export async function qualifyingOrders(db: Db | undefined, sellerId: string): Promise<QualifyingOrder[]> {
  const rows = await q<{ total_kobo: number; on_time: boolean; disputed: boolean; loss: number }>(db, `
    SELECT o.total_kobo,
      COALESCE(bool_and(m.delivered_at IS NOT NULL AND m.delivered_at <= o.delivery_deadline) FILTER (WHERE m.status = 'released'), false) AS on_time,
      EXISTS (SELECT 1 FROM disputes d WHERE d.order_id = o.id) AS disputed,
      COALESCE((SELECT SUM(CASE d.outcome WHEN 'refund_to_buyer' THEN 1 WHEN 'split' THEN 0.5 ELSE 0 END) FROM disputes d WHERE d.order_id = o.id AND d.status = 'resolved'), 0)::float AS loss
    FROM orders o JOIN users u ON u.id = o.seller_id JOIN milestones m ON m.order_id = o.id
    WHERE o.seller_id = $1 AND o.status = 'completed' AND o.total_kobo >= $2
      AND (o.buyer_email IS NULL OR lower(o.buyer_email) <> lower(u.email))
      AND (o.buyer_phone IS NULL OR o.buyer_phone <> u.phone)
    GROUP BY o.id HAVING bool_or(m.status = 'released')`, [sellerId, QUALIFYING_MIN_KOBO]);
  return rows.map((r) => ({ valueKobo: r.total_kobo, onTime: r.on_time, disputed: r.disputed, lossWeight: Number(r.loss) }));
}

/** Call inside the transaction that settles an order. Writes the score and a trust_events row. */
export async function recomputeTrust(tx: Db, sellerId: string, orderId: string | null, eventType: string) {
  const before = await q1<{ trust_score: number | null }>(tx, "SELECT trust_score FROM users WHERE id=$1 FOR UPDATE", [sellerId]);
  const { score, level } = computeTrust(await qualifyingOrders(tx, sellerId));
  await q(tx, `UPDATE users SET trust_score=$2, trust_level=CASE WHEN trust_level='verified' THEN 'verified' ELSE $3 END,
    completed_orders=(SELECT count(*) FROM orders WHERE seller_id=$1 AND status='completed'), updated_at=now() WHERE id=$1`, [sellerId, score, level]);
  await q(tx, "INSERT INTO trust_events (seller_id, order_id, event_type, delta, score_after) VALUES ($1,$2,$3,$4,$5)",
    [sellerId, orderId, eventType, (score ?? 0) - (before?.trust_score ?? 0), score]);
}
