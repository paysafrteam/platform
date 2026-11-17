import "server-only";
import { q, q1, withTx } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { rateLimit } from "@/server/http/ratelimit";
import { writeAudit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { emailBuyer, notify } from "@/server/services/notifications";
import { finalizeOrderIfDone, lockOrder, queuePayout, writeRefund, writeRelease } from "@/server/services/settlement";
import { issueReceipt, orderForReceipt } from "@/server/services/receipts";
import { processPayout } from "@/server/services/payouts";
import { calcFee } from "@/lib/domain/rules";
import { formatNaira } from "@/lib/format/money";
import type { DisputeOutcome, DisputeReason } from "@/lib/domain/types";

export interface EvidenceInput { type: "text" | "link"; content: string }

function checkEvidence(items: EvidenceInput[]) {
  for (const e of items) {
    if (e.type === "link" && !/^https?:\/\/\S+$/i.test(e.content)) throw new AppError("VALIDATION", "Evidence links must start with http:// or https://.");
  }
}

interface OpenInput { milestoneId: string; reason: DisputeReason; note: string; evidence?: EvidenceInput[] }

async function openDisputeInternal(orderId: string, openedBy: "buyer" | "seller", input: OpenInput) {
  checkEvidence(input.evidence ?? []);
  const settings = await getSettings();
  return withTx(async (tx, defer) => {
    const { order, milestones } = await lockOrder(tx, orderId);
    const m = milestones.find((x) => x.id === input.milestoneId);
    if (!m || order.status !== "funded") throw new AppError("INVALID_STATE", "A dispute can only be opened on a funded order.");
    const full = (await q1<{ release_at: Date | null }>(tx, "SELECT release_at FROM milestones WHERE id=$1", [m.id]))!;
    const dl = (await q1<{ delivery_deadline: Date }>(tx, "SELECT delivery_deadline FROM orders WHERE id=$1", [orderId]))!.delivery_deadline;
    const underReview = m.status === "delivered" && full.release_at != null && full.release_at.getTime() > Date.now();
    const missedDeadline = openedBy === "buyer" && m.status === "pending" && dl.getTime() < Date.now() && input.reason !== "not_as_described";
    if (!underReview && !missedDeadline) {
      throw new AppError("INVALID_STATE", "A dispute can only be opened while a delivery is under review, or after the delivery deadline has passed.");
    }
    const existing = await q1(tx, "SELECT 1 FROM disputes WHERE milestone_id=$1 AND status <> 'resolved'", [m.id]);
    if (existing) throw new AppError("CONFLICT", "This milestone already has an open dispute.");
    await q(tx, "UPDATE milestones SET status='disputed', updated_at=now() WHERE id=$1", [m.id]);
    const d = (await q1<{ id: string; number: number }>(tx, `INSERT INTO disputes (order_id, milestone_id, opened_by, reason, note, status, response_due_at)
      VALUES ($1,$2,$3,$4,$5,'awaiting_response', now() + make_interval(hours => $6)) RETURNING id, number`,
      [orderId, m.id, openedBy, input.reason, input.note.trim(), settings.dispute_response_hours]))!;
    for (const e of input.evidence ?? []) await q(tx, "INSERT INTO evidence (dispute_id, submitted_by, type, content) VALUES ($1,$2,$3,$4)", [d.id, openedBy, e.type, e.content.trim()]);
    await writeAudit(tx, { actorType: "user", actorLabel: openedBy, action: "dispute.opened", targetType: "dispute", targetId: d.id, after: { milestoneId: m.id, reason: input.reason } });
    const who = openedBy === "buyer" ? "The buyer" : "The seller";
    await notify(tx, defer, { userId: order.seller_id, type: "dispute", title: openedBy === "buyer" ? "A dispute was opened" : "Dispute recorded",
      message: `${who} opened a dispute on "${m.title}". The money is frozen. You have ${settings.dispute_response_hours} hours to respond with evidence.`, orderId: order.id,
      email: { to: order.seller_email, path: `/orders/${order.id}`, buttonLabel: "Respond to dispute" } });
    if (openedBy === "seller") emailBuyer(defer, order.buyer_email, "A dispute was opened", `The seller opened a dispute on "${m.title}". The money is frozen while PaySafr reviews it.`, `/pay/${order.token}`, "View order");
    return { id: d.id, number: `DSP-${d.number}` };
  }).catch((e) => {
    if ((e as { code?: string }).code === "23505") throw new AppError("CONFLICT", "This milestone already has an open dispute.");
    throw e;
  });
}

export async function openBuyerDispute(token: string, input: OpenInput) {
  await rateLimit({ key: `dispute:${token}`, limit: 10, windowSeconds: 3600 });
  const o = await q1<{ id: string }>(undefined, "SELECT id FROM orders WHERE token=$1 AND status <> 'draft'", [token]);
  if (!o) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  return openDisputeInternal(o.id, "buyer", input);
}

export async function openSellerDispute(sellerId: string, orderId: string, input: OpenInput) {
  const o = await q1<{ id: string }>(undefined, "SELECT id FROM orders WHERE id=$1 AND seller_id=$2", [orderId, sellerId]);
  if (!o) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  return openDisputeInternal(o.id, "seller", input);
}

export async function addEvidence(by: { side: "buyer"; token: string } | { side: "seller"; sellerId: string; orderId: string }, disputeId: string, item: EvidenceInput) {
  checkEvidence([item]);
  const d = by.side === "buyer"
    ? await q1<{ id: string; status: string }>(undefined, "SELECT d.id, d.status FROM disputes d JOIN orders o ON o.id=d.order_id WHERE d.id=$1 AND o.token=$2", [disputeId, by.token])
    : await q1<{ id: string; status: string }>(undefined, "SELECT d.id, d.status FROM disputes d JOIN orders o ON o.id=d.order_id WHERE d.id=$1 AND o.id=$2 AND o.seller_id=$3", [disputeId, by.orderId, by.sellerId]);
  if (!d) throw new AppError("NOT_FOUND", "We couldn't find this dispute.");
  if (d.status === "resolved") throw new AppError("INVALID_STATE", "This dispute has already been decided.");
  const n = (await q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM evidence WHERE dispute_id=$1 AND submitted_by=$2", [d.id, by.side]))!.n;
  if (n >= 20) throw new AppError("VALIDATION", "You have reached the evidence limit for this dispute.");
  await q(undefined, "INSERT INTO evidence (dispute_id, submitted_by, type, content) VALUES ($1,$2,$3,$4)", [d.id, by.side, item.type, item.content.trim()]);
  return { saved: true as const };
}

export async function startReview(adminId: string, adminLabel: string, disputeId: string) {
  const d = await q1<{ id: string; status: string }>(undefined, "UPDATE disputes SET status='under_review', updated_at=now() WHERE id=$1 AND status IN ('open','awaiting_response') RETURNING id, status", [disputeId]);
  if (!d) throw new AppError("INVALID_STATE", "This dispute cannot be moved to review.");
  await writeAudit(undefined, { actorType: "admin", actorId: adminId, actorLabel: adminLabel, action: "dispute.start_review", targetType: "dispute", targetId: disputeId, before: "awaiting_response", after: "under_review" });
  return { started: true as const };
}

export async function resolveDispute(admin: { id: string; label: string }, disputeId: string, input: { outcome: DisputeOutcome; reason: string; splitToSellerKobo?: number | undefined; decideEarly?: boolean | undefined }, ip?: string) {
  const ref = await q1<{ order_id: string }>(undefined, "SELECT order_id FROM disputes WHERE id=$1", [disputeId]);
  if (!ref) throw new AppError("NOT_FOUND", "We couldn't find this dispute.");
  const payoutIds: string[] = [];
  await withTx(async (tx, defer) => {
    const { order, milestones } = await lockOrder(tx, ref.order_id);
    const d = await q1<{ id: string; milestone_id: string; status: string; response_due_at: Date; number: number }>(tx, "SELECT id, milestone_id, status, response_due_at, number FROM disputes WHERE id=$1 FOR UPDATE", [disputeId]);
    const m = milestones.find((x) => x.id === d?.milestone_id);
    if (!d || !m || d.status === "resolved" || m.status !== "disputed") throw new AppError("INVALID_STATE", "This dispute has already been decided.");
    if (d.response_due_at.getTime() > Date.now() && !input.decideEarly) {
      throw new AppError("INVALID_STATE", "The response window is still open. Tick “Decide early” and explain why to decide now.");
    }
    const before = { milestone: m.status, dispute: d.status };
    let net = 0, fee = 0, refunded = 0, receiptOutcome: "released" | "refunded" | "split";
    if (input.outcome === "release_to_seller") {
      fee = m.fee_kobo; net = await writeRelease(tx, { orderId: order.id, milestoneId: m.id, grossKobo: m.amount_kobo, feeKobo: fee });
      await q(tx, "UPDATE milestones SET status='released', released_at=now(), updated_at=now() WHERE id=$1", [m.id]);
      payoutIds.push(await queuePayout(tx, { orderId: order.id, milestoneId: m.id, kind: "seller_payout", amountKobo: net, key: `payout:${m.id}:seller_payout` }));
      receiptOutcome = "released";
    } else if (input.outcome === "refund_to_buyer") {
      refunded = m.amount_kobo;
      await writeRefund(tx, { orderId: order.id, milestoneId: m.id, amountKobo: refunded, key: `refund:${m.id}` });
      await q(tx, "UPDATE milestones SET status='refunded', updated_at=now() WHERE id=$1", [m.id]);
      payoutIds.push(await queuePayout(tx, { orderId: order.id, milestoneId: m.id, kind: "buyer_refund", amountKobo: refunded, key: `payout:${m.id}:buyer_refund` }));
      receiptOutcome = "refunded";
    } else {
      const s = input.splitToSellerKobo;
      if (s === undefined || !Number.isSafeInteger(s) || s <= 0 || s >= m.amount_kobo) {
        throw new AppError("VALIDATION", "The seller's share must be a whole amount above zero and below the milestone amount. Use release or refund for the extremes.", { splitToSellerKobo: "Must be between 0 and the milestone amount." });
      }
      fee = calcFee(s, (await q1<{ total_kobo: number }>(tx, "SELECT total_kobo FROM orders WHERE id=$1", [order.id]))!.total_kobo);
      net = await writeRelease(tx, { orderId: order.id, milestoneId: m.id, grossKobo: s, feeKobo: fee });
      refunded = m.amount_kobo - s;
      await writeRefund(tx, { orderId: order.id, milestoneId: m.id, amountKobo: refunded, key: `refund:${m.id}` });
      await q(tx, "UPDATE milestones SET status='released', released_at=now(), updated_at=now() WHERE id=$1", [m.id]);
      payoutIds.push(await queuePayout(tx, { orderId: order.id, milestoneId: m.id, kind: "seller_payout", amountKobo: net, key: `payout:${m.id}:seller_payout` }));
      payoutIds.push(await queuePayout(tx, { orderId: order.id, milestoneId: m.id, kind: "buyer_refund", amountKobo: refunded, key: `payout:${m.id}:buyer_refund` }));
      receiptOutcome = "split";
    }
    await q(tx, `UPDATE disputes SET status='resolved', outcome=$2, split_to_seller_kobo=$3, decision_reason=$4, decided_by=$5, decided_early=$6, resolved_at=now(), updated_at=now() WHERE id=$1`,
      [d.id, input.outcome, input.outcome === "split" ? input.splitToSellerKobo! : null, input.reason.trim(), admin.id, d.response_due_at.getTime() > Date.now()]);
    await issueReceipt(tx, await orderForReceipt(tx, order.id), "completion", { milestoneId: m.id, milestoneTitle: m.title, amountKobo: m.amount_kobo, feeKobo: fee || undefined as never, netKobo: net || undefined as never, refundedKobo: refunded, outcome: receiptOutcome });
    await writeAudit(tx, { actorType: "admin", actorId: admin.id, actorLabel: admin.label, action: `dispute.resolved.${input.outcome}`, targetType: "dispute", targetId: d.id,
      before, after: { outcome: input.outcome, reason: input.reason, decidedEarly: d.response_due_at.getTime() > Date.now(), netKobo: net, feeKobo: fee, refundedKobo: refunded }, ...(ip ? { ip } : {}) });
    const summary = input.outcome === "release_to_seller" ? `${formatNaira(net)} was released to the seller.` : input.outcome === "refund_to_buyer" ? `${formatNaira(refunded)} is being refunded to the buyer.` : `${formatNaira(net)} went to the seller and ${formatNaira(refunded)} is being refunded to the buyer.`;
    const msg = `Decision on "${m.title}": ${summary} Reason: ${input.reason.trim()}`;
    await notify(tx, defer, { userId: order.seller_id, type: "dispute", title: "Dispute decided", message: msg, orderId: order.id, email: { to: order.seller_email, path: `/orders/${order.id}`, buttonLabel: "View decision" } });
    emailBuyer(defer, order.buyer_email, "Dispute decided", msg, `/pay/${order.token}`, "View decision");
    await finalizeOrderIfDone(tx, defer, order);
    for (const id of payoutIds) defer(() => processPayout(id));
  });
  return { resolved: true as const };
}
