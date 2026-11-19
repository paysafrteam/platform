import "server-only";
import * as React from "react";
import { q, type Db } from "@/server/db";
import { maskEmail, maskPhone } from "@/lib/auth-utils";
import type {
  DisputeSummary, EvidenceItem, Milestone, OrderAccount, PublicOrder, PublicSeller, ReceiptRef, SellerMilestone, SellerOrder, TrustLevel,
} from "@/lib/domain/types";

export { maskEmail, maskPhone };
const reactCache = (React as unknown as { cache?: <F extends (...a: never[]) => unknown>(f: F) => F }).cache;
/** React cache() dedupes repeated lookups inside one server render; a no-op outside React Server Components. */
export const cacheFn = <F extends (...a: never[]) => unknown>(fn: F): F => (reactCache ? reactCache(fn) : fn);

interface OrderRow {
  id: string; seller_id: string; token: string; title: string; description: string; total_kobo: number; status: string;
  buyer_email: string | null; buyer_phone: string | null; delivery_deadline: Date; review_window_hours: number; fee_kobo: number;
  amount_funded_kobo: number; overpaid_kobo: number; order_account_bank: string | null; order_account_number: string | null;
  order_account_name: string | null; order_account_expires_at: Date | null; order_account_total_payment_kobo: number | null;
  expires_at: Date | null; funded_at: Date | null;
  completed_at: Date | null; needs_refund_flag: boolean; created_at: Date;
  seller_name: string; seller_business: string | null; seller_trust_score: number | null; seller_trust_level: TrustLevel; seller_completed: number;
}
interface MsRow {
  id: string; order_id: string; position: number; title: string; amount_kobo: number; fee_kobo: number; status: Milestone["status"];
  proof_kind: "link" | "note" | null; proof_content: string | null; delivered_at: Date | null; release_at: Date | null;
}
interface DisputeRow {
  id: string; number: number; order_id: string; milestone_id: string; opened_by: "buyer" | "seller"; reason: DisputeSummary["reason"]; note: string;
  status: DisputeSummary["status"]; response_due_at: Date; outcome: DisputeSummary["outcome"] | null; split_to_seller_kobo: number | null;
  decision_reason: string | null; opened_at: Date; resolved_at: Date | null;
}
interface ReceiptRow { number: string; public_token: string; type: "payment" | "completion"; order_id: string; milestone_id: string | null; issued_at: Date }

export interface OrderGraph {
  order: OrderRow; milestones: MsRow[]; changes: Record<string, { id: string; note: string; created_at: Date }[]>;
  payouts: Record<string, string>; receipts: ReceiptRow[]; disputes: DisputeRow[]; evidence: Record<string, EvidenceItem[]>;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

export async function loadGraphs(db: Db | undefined, where: string, params: unknown[]): Promise<OrderGraph[]> {
  const orders = await q<OrderRow>(db, `SELECT o.*, u.name AS seller_name, u.business_name AS seller_business, u.trust_score AS seller_trust_score,
      u.trust_level AS seller_trust_level, u.completed_orders AS seller_completed
    FROM orders o JOIN users u ON u.id = o.seller_id WHERE ${where}`, params);
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const [ms, ch, po, rc, ds] = await Promise.all([
    q<MsRow>(db, "SELECT * FROM milestones WHERE order_id = ANY($1) ORDER BY order_id, position", [ids]),
    q<{ id: string; milestone_id: string; note: string; created_at: Date }>(db, "SELECT c.* FROM change_requests c JOIN milestones m ON m.id=c.milestone_id WHERE m.order_id = ANY($1) ORDER BY c.created_at", [ids]),
    q<{ milestone_id: string; status: string }>(db, "SELECT milestone_id, status FROM payouts WHERE order_id = ANY($1) AND kind='seller_payout' AND milestone_id IS NOT NULL", [ids]),
    q<ReceiptRow>(db, "SELECT number, public_token, type, order_id, milestone_id, issued_at FROM receipts WHERE order_id = ANY($1) ORDER BY issued_at", [ids]),
    q<DisputeRow>(db, "SELECT * FROM disputes WHERE order_id = ANY($1) ORDER BY opened_at", [ids]),
  ]);
  const ev = ds.length ? await q<{ id: string; dispute_id: string; submitted_by: "buyer" | "seller"; type: "text" | "link"; content: string; created_at: Date }>(
    db, "SELECT * FROM evidence WHERE dispute_id = ANY($1) ORDER BY created_at", [ds.map((d) => d.id)]) : [];
  return orders.map((order) => {
    const changes: OrderGraph["changes"] = {};
    for (const c of ch) (changes[c.milestone_id] ??= []).push(c);
    const evidence: OrderGraph["evidence"] = {};
    const myDisputes = ds.filter((d) => d.order_id === order.id);
    for (const e of ev) if (myDisputes.some((d) => d.id === e.dispute_id))
      (evidence[e.dispute_id] ??= []).push({ id: e.id, submittedBy: e.submitted_by, type: e.type, content: e.content, createdAt: e.created_at.toISOString() });
    const milestones = ms.filter((m) => m.order_id === order.id);
    return {
      order, milestones, changes, evidence,
      payouts: Object.fromEntries(po.filter((p) => milestones.some((m) => m.id === p.milestone_id)).map((p) => [p.milestone_id, p.status])),
      receipts: rc.filter((r) => r.order_id === order.id), disputes: myDisputes,
    };
  });
}

const receiptRef = (r: ReceiptRow): ReceiptRef => ({ number: r.number, publicToken: r.public_token, type: r.type, milestoneId: r.milestone_id, issuedAt: r.issued_at.toISOString() });
const disputeDto = (d: DisputeRow): DisputeSummary => ({
  id: d.id, number: `DSP-${d.number}`, milestoneId: d.milestone_id, openedBy: d.opened_by, status: d.status, reason: d.reason, note: d.note,
  responseDueAt: d.response_due_at.toISOString(), ...(d.outcome ? { outcome: d.outcome } : {}),
  ...(d.split_to_seller_kobo != null ? { splitToSellerKobo: d.split_to_seller_kobo } : {}),
  ...(d.decision_reason ? { decisionReason: d.decision_reason } : {}), openedAt: d.opened_at.toISOString(), ...(d.resolved_at ? { resolvedAt: d.resolved_at.toISOString() } : {}),
});

/** An unpaid order past its expiry is presented as expired without writing (the job persists it). */
export const effectiveStatus = (o: OrderRow) =>
  o.status === "awaiting_payment" && o.expires_at && o.expires_at.getTime() <= Date.now() ? "expired" : o.status;

function base(g: OrderGraph) {
  const o = g.order;
  const status = effectiveStatus(o) as PublicOrder["status"];
  const seller: PublicSeller = {
    name: o.seller_name, ...(o.seller_business ? { businessName: o.seller_business } : {}),
    trustScore: o.seller_trust_score, trustLevel: o.seller_trust_level, completedOrders: o.seller_completed,
  };
  const account: OrderAccount | undefined = status === "awaiting_payment" && o.order_account_number
    ? {
        bankName: o.order_account_bank ?? "",
        accountNumber: o.order_account_number,
        accountName: o.order_account_name ?? "",
        expiresAt: (o.order_account_expires_at ?? o.expires_at)!.toISOString(),
        totalPaymentAmountKobo: o.order_account_total_payment_kobo ?? o.total_kobo,
      }
    : undefined;
  const payment = g.receipts.find((r) => r.type === "payment");
  const completions = g.receipts.filter((r) => r.type === "completion");
  const mapMs = (m: MsRow): Milestone => ({
    id: m.id, position: m.position, title: m.title, amountKobo: m.amount_kobo, status: m.status,
    ...(m.status === "delivered" && m.proof_kind && m.proof_content ? { proof: { kind: m.proof_kind, content: m.proof_content } } : {}),
    ...(m.delivered_at ? { deliveredAt: m.delivered_at.toISOString() } : {}), ...(m.release_at ? { releaseAt: m.release_at.toISOString() } : {}),
    changeRequestCount: g.changes[m.id]?.length ?? 0,
  });
  return {
    o, status, seller, account, mapMs,
    common: {
      token: o.token, seller, title: o.title, description: o.description, totalKobo: o.total_kobo, currency: "NGN" as const, status,
      deliveryDeadline: o.delivery_deadline.toISOString(), reviewWindowHours: o.review_window_hours, amountFundedKobo: o.amount_funded_kobo,
      overpaidKobo: o.overpaid_kobo, ...(account ? { orderAccount: account } : {}), createdAt: o.created_at.toISOString(),
      expiresAt: iso(o.expires_at) ?? null, ...(o.funded_at ? { fundedAt: o.funded_at.toISOString() } : {}),
      ...(o.completed_at ? { completedAt: o.completed_at.toISOString() } : {}),
      paymentReceipt: payment ? receiptRef(payment) : null, completionReceipt: completions.length ? receiptRef(completions[completions.length - 1]!) : null,
      disputes: g.disputes.map(disputeDto),
    },
    receipts: g.receipts.map(receiptRef),
  };
}

/** Sanitised buyer-facing DTO: no seller email, phone, bank or user id; buyer contact masked. */
export function toPublicOrder(g: OrderGraph): PublicOrder {
  const b = base(g);
  const contact = { ...(g.order.buyer_email ? { email: maskEmail(g.order.buyer_email) } : {}), ...(g.order.buyer_phone ? { phone: maskPhone(g.order.buyer_phone) } : {}) };
  return { ...b.common, milestones: g.milestones.map(b.mapMs), ...(Object.keys(contact).length ? { buyerContact: contact } : {}) };
}

export function toSellerOrder(g: OrderGraph): SellerOrder {
  const b = base(g);
  const contact = { ...(g.order.buyer_email ? { email: g.order.buyer_email } : {}), ...(g.order.buyer_phone ? { phone: g.order.buyer_phone } : {}) };
  const milestones: SellerMilestone[] = g.milestones.map((m) => ({
    ...b.mapMs(m), feeKobo: m.fee_kobo,
    ...(m.proof_kind && m.proof_content ? { proof: { kind: m.proof_kind, content: m.proof_content } } : {}),
    ...(g.payouts[m.id] ? { payoutStatus: g.payouts[m.id] as SellerMilestone["payoutStatus"] } : {}),
    changeRequests: (g.changes[m.id] ?? []).map((c) => ({ id: c.id, note: c.note, createdAt: c.created_at.toISOString() })),
  }));
  return { ...b.common, id: g.order.id, feeKobo: g.order.fee_kobo, ...(Object.keys(contact).length ? { buyerContact: contact } : {}),
    milestones, receipts: b.receipts, needsRefundFlag: g.order.needs_refund_flag, evidence: g.evidence };
}

export const getPublicOrderByToken = cacheFn(async (token: string): Promise<PublicOrder | null> => {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [g] = await loadGraphs(undefined, "o.token = $1 AND o.status <> 'draft'", [token]);
  return g ? toPublicOrder(g) : null;
});
