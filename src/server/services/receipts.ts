import "server-only";
import { q, q1, type Db } from "@/server/db";
import { randomToken } from "@/server/ids";
import { maskEmail, maskPhone } from "@/lib/auth-utils";
import type { PublicReceipt } from "@/lib/domain/types";

export interface ReceiptOrder { id: string; title: string; description: string; total_kobo: number; buyer_email: string | null; buyer_phone: string | null; seller_name: string }

export async function orderForReceipt(tx: Db, orderId: string): Promise<ReceiptOrder> {
  return (await q1<ReceiptOrder>(tx, `SELECT o.id, o.title, o.description, o.total_kobo, o.buyer_email, o.buyer_phone, u.name AS seller_name
    FROM orders o JOIN users u ON u.id = o.seller_id WHERE o.id = $1`, [orderId]))!;
}

/** Issues a receipt with an immutable snapshot. Idempotent per (order, type, milestone). */
export async function issueReceipt(
  tx: Db, order: ReceiptOrder, type: "payment" | "completion",
  data: { milestoneId?: string; milestoneTitle?: string; amountKobo: number; feeKobo?: number; netKobo?: number; refundedKobo?: number; outcome: NonNullable<PublicReceipt["outcome"]> },
): Promise<void> {
  const contact = order.buyer_email ? maskEmail(order.buyer_email) : order.buyer_phone ? maskPhone(order.buyer_phone) : undefined;
  const snapshot: Omit<PublicReceipt, "number" | "token" | "issuedAt"> = {
    type, title: order.title, description: order.description, sellerName: order.seller_name, ...(contact ? { buyerContact: contact } : {}),
    amountKobo: data.amountKobo, ...(data.feeKobo !== undefined ? { feeKobo: data.feeKobo } : {}),
    ...(data.netKobo !== undefined ? { netKobo: data.netKobo } : {}), ...(data.refundedKobo ? { refundedKobo: data.refundedKobo } : {}),
    orderTotalKobo: order.total_kobo, ...(data.milestoneTitle ? { milestoneTitle: data.milestoneTitle } : {}), outcome: data.outcome,
  };
  await q(tx, `INSERT INTO receipts (number, public_token, type, order_id, milestone_id, snapshot)
    VALUES ('PS-' || to_char(now() AT TIME ZONE 'Africa/Lagos', 'YYYY') || '-' || lpad(nextval('receipt_number_seq')::text, 6, '0'), $1, $2, $3, $4, $5)
    ON CONFLICT (order_id, type, COALESCE(milestone_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING`,
    [randomToken(24), type, order.id, data.milestoneId ?? null, JSON.stringify(snapshot)]);
}

interface ReceiptRowFull { number: string; public_token: string; type: "payment" | "completion"; issued_at: Date; snapshot: Omit<PublicReceipt, "number" | "token" | "issuedAt"> }
const toDto = (r: ReceiptRowFull): PublicReceipt => ({ ...r.snapshot, number: r.number, token: r.public_token, type: r.type, issuedAt: r.issued_at.toISOString() });

export async function getPublicReceipt(token: string): Promise<PublicReceipt | null> {
  if (!token || token.length > 80) return null;
  const r = await q1<ReceiptRowFull>(undefined, "SELECT number, public_token, type, issued_at, snapshot FROM receipts WHERE public_token = $1", [token]);
  return r ? toDto(r) : null;
}

export async function getBuyerReceipts(orderToken: string): Promise<PublicReceipt[] | null> {
  const rows = await q<ReceiptRowFull>(undefined, `SELECT r.number, r.public_token, r.type, r.issued_at, r.snapshot FROM receipts r JOIN orders o ON o.id = r.order_id
    WHERE o.token = $1 AND o.status <> 'draft' ORDER BY r.issued_at`, [orderToken]);
  const exists = rows.length ? true : !!(await q1(undefined, "SELECT 1 FROM orders WHERE token=$1 AND status <> 'draft'", [orderToken]));
  return exists ? rows.map(toDto) : null;
}

export async function listSellerReceipts(sellerId: string): Promise<PublicReceipt[]> {
  const rows = await q<ReceiptRowFull>(undefined, `SELECT r.number, r.public_token, r.type, r.issued_at, r.snapshot FROM receipts r JOIN orders o ON o.id = r.order_id
    WHERE o.seller_id = $1 ORDER BY r.issued_at DESC LIMIT 200`, [sellerId]);
  return rows.map(toDto);
}
