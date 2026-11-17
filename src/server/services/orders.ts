import "server-only";
import { q, q1, withTx } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { rateLimit } from "@/server/http/ratelimit";
import { randomToken } from "@/server/ids";
import { getSettings, SETTING_RANGES } from "@/server/settings";
import { getPaymentProvider } from "@/server/payments/simulator";
import { loadGraphs, toPublicOrder, toSellerOrder } from "@/server/mappers/orders";
import { lockOrder, settleMilestone, queuePayout, writeRefund } from "@/server/services/settlement";
import { emailBuyer, notify } from "@/server/services/notifications";
import { allocateMilestoneFees, isMilestoneAllocationValid } from "@/lib/domain/rules";
import { normalizeNgPhone } from "@/lib/auth-utils";
import { processPayout } from "@/server/services/payouts";
import { formatNaira } from "@/lib/format/money";
import type { PublicOrder, SellerOrder } from "@/lib/domain/types";
import type { SessionUser } from "@/server/auth/session";

export interface CreateOrderInput {
  title: string; description: string; totalKobo: number; reviewWindowHours: number; deliveryDeadline: string;
  milestones: { title: string; amountKobo: number }[]; buyerContact?: { email?: string | undefined; phone?: string | undefined } | undefined; publish: boolean;
}

function cleanContact(c: CreateOrderInput["buyerContact"]) {
  const email = c?.email?.trim().toLowerCase() || null;
  const rawPhone = c?.phone?.trim();
  const phone = rawPhone ? normalizeNgPhone(rawPhone) : null;
  if (rawPhone && !phone) throw new AppError("VALIDATION", "Enter a valid Nigerian phone number for the buyer.", { "buyerContact.phone": "Enter a valid Nigerian phone number." });
  return { email, phone };
}

export async function createOrder(user: SessionUser, input: CreateOrderInput): Promise<SellerOrder> {
  await rateLimit({ key: `create-order:${user.id}`, limit: 60, windowSeconds: 3600 });
  const amounts = input.milestones.map((m) => m.amountKobo);
  if (!isMilestoneAllocationValid(amounts, input.totalKobo)) {
    throw new AppError("VALIDATION", "Milestone amounts must add up to the order total.", { milestones: "Milestone amounts must add up to the order total." });
  }
  const settings = await getSettings();
  const [lo, hi] = SETTING_RANGES.review_window_hours;
  if (input.reviewWindowHours < lo || input.reviewWindowHours > hi) {
    throw new AppError("VALIDATION", `Choose a review window between ${lo} and ${hi} hours.`, { reviewWindowHours: `Between ${lo} and ${hi} hours.` });
  }
  const deadline = new Date(input.deliveryDeadline);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    throw new AppError("VALIDATION", "Choose a delivery deadline in the future.", { deliveryDeadline: "Choose a date in the future." });
  }
  void settings;
  const contact = cleanContact(input.buyerContact);
  const fees = allocateMilestoneFees(amounts, input.totalKobo);
  const orderId = await withTx(async (tx) => {
    const o = await q1<{ id: string }>(tx, `INSERT INTO orders (seller_id, token, title, description, total_kobo, review_window_hours, delivery_deadline, fee_kobo, buyer_email, buyer_phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [user.id, randomToken(32), input.title.trim(), input.description.trim(), input.totalKobo, input.reviewWindowHours, deadline, fees.reduce((a, b) => a + b, 0), contact.email, contact.phone]);
    for (const [i, m] of input.milestones.entries()) {
      await q(tx, "INSERT INTO milestones (order_id, position, title, amount_kobo, fee_kobo) VALUES ($1,$2,$3,$4,$5)", [o!.id, i + 1, m.title.trim(), m.amountKobo, fees[i]]);
    }
    return o!.id;
  });
  if (input.publish) return publishOrder(user, orderId);
  return getSellerOrder(user.id, orderId);
}

export async function publishOrder(user: SessionUser, orderId: string): Promise<SellerOrder> {
  const settings = await getSettings();
  const pre = await q1<{ status: string; seller_status: string }>(undefined,
    "SELECT o.status, u.status AS seller_status FROM orders o JOIN users u ON u.id=o.seller_id WHERE o.id=$1 AND o.seller_id=$2", [orderId, user.id]);
  if (!pre) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  if (pre.status !== "draft") throw new AppError("INVALID_STATE", "Only a draft order can be published.");
  if (pre.seller_status !== "active") throw new AppError("FORBIDDEN", "Your account is limited and cannot publish new orders. Contact support.");
  const acct = await q1(undefined, "SELECT 1 FROM payout_accounts WHERE user_id=$1", [user.id]);
  if (!acct) throw new AppError("CONFLICT", "Add a payout account before publishing your first order.");

  const expiresAt = new Date(Date.now() + settings.unpaid_expiry_hours * 3_600_000);
  const total = (await q1<{ total_kobo: number }>(undefined, "SELECT total_kobo FROM orders WHERE id=$1", [orderId]))!.total_kobo;
  const account = await getPaymentProvider().createCollectionAccount({ orderId, amountKobo: total, reference: `PS-${orderId}`, expiresAt });
  await withTx(async (tx) => {
    const { order } = await lockOrder(tx, orderId);
    if (order.status !== "draft") throw new AppError("INVALID_STATE", "Only a draft order can be published.");
    await q(tx, `UPDATE orders SET status='awaiting_payment', published_at=now(), expires_at=$2, order_account_bank=$3, order_account_number=$4,
      order_account_name=$5, order_account_expires_at=$2, updated_at=now() WHERE id=$1`,
      [orderId, expiresAt, account.bankName, account.accountNumber, account.accountName]);
  });
  return getSellerOrder(user.id, orderId);
}

export async function listOrders(sellerId: string): Promise<SellerOrder[]> {
  const gs = await loadGraphs(undefined, "o.seller_id = $1 ORDER BY o.created_at DESC", [sellerId]);
  return gs.map(toSellerOrder);
}

export async function getSellerOrder(sellerId: string, orderId: string): Promise<SellerOrder> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  const [g] = await loadGraphs(undefined, "o.id = $1 AND o.seller_id = $2", [orderId, sellerId]);
  if (!g) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  return toSellerOrder(g);
}

export async function cancelOrder(sellerId: string, orderId: string): Promise<SellerOrder> {
  await getSellerOrder(sellerId, orderId);
  await withTx(async (tx) => {
    const { order } = await lockOrder(tx, orderId);
    const o = await q1<{ amount_funded_kobo: number }>(tx, "SELECT amount_funded_kobo FROM orders WHERE id=$1", [orderId]);
    if ((order.status !== "draft" && order.status !== "awaiting_payment") || (o?.amount_funded_kobo ?? 0) > 0) {
      throw new AppError("INVALID_STATE", "Only an unpaid order can be cancelled.");
    }
    await q(tx, "UPDATE orders SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE id=$1", [orderId]);
  });
  return getSellerOrder(sellerId, orderId);
}

/** Read-only: never changes funding. Funding only comes from recordFunding(). */
export async function checkPayment(token: string): Promise<{ status: "funded" | "awaiting_payment"; order: PublicOrder }> {
  await rateLimit({ key: `check:${token}`, limit: 60, windowSeconds: 600 });
  const [g] = await loadGraphs(undefined, "o.token = $1 AND o.status <> 'draft'", [token]);
  if (!g) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  const order = toPublicOrder(g);
  return { status: order.amountFundedKobo >= order.totalKobo && order.status !== "awaiting_payment" ? "funded" : "awaiting_payment", order };
}

export async function contactSeller(token: string, c: { email?: string | undefined; phone?: string | undefined }) {
  await rateLimit({ key: `contact:${token}`, limit: 10, windowSeconds: 3600 });
  const contact = cleanContact(c);
  if (!contact.email && !contact.phone) throw new AppError("VALIDATION", "Enter an email address or phone number.");
  const row = await q1<{ id: string }>(undefined, `UPDATE orders SET buyer_email = COALESCE($2, buyer_email), buyer_phone = COALESCE($3, buyer_phone), updated_at = now()
    WHERE token=$1 AND status <> 'draft' RETURNING id`, [token, contact.email, contact.phone]);
  if (!row) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  return { saved: true as const };
}

export async function confirmMilestone(token: string, milestoneId: string): Promise<PublicOrder> {
  await rateLimit({ key: `confirm:${token}`, limit: 30, windowSeconds: 600 });
  const m = await q1<{ id: string }>(undefined, "SELECT m.id FROM milestones m JOIN orders o ON o.id=m.order_id WHERE o.token=$1 AND m.id=$2", [token, milestoneId]);
  if (!m) throw new AppError("NOT_FOUND", "We couldn't find this delivery.");
  await settleMilestone({ milestoneId, trigger: "buyer" });
  return (await loadPublic(token))!;
}

export async function loadPublic(token: string): Promise<PublicOrder | null> {
  const [g] = await loadGraphs(undefined, "o.token = $1 AND o.status <> 'draft'", [token]);
  return g ? toPublicOrder(g) : null;
}

export async function requestChanges(token: string, milestoneId: string, note: string) {
  await rateLimit({ key: `changes:${token}`, limit: 5, windowSeconds: 3600 });
  const ref = await q1<{ order_id: string }>(undefined, "SELECT m.order_id FROM milestones m JOIN orders o ON o.id=m.order_id WHERE o.token=$1 AND m.id=$2", [token, milestoneId]);
  if (!ref) throw new AppError("NOT_FOUND", "We couldn't find this delivery.");
  await withTx(async (tx, defer) => {
    const { order, milestones } = await lockOrder(tx, ref.order_id);
    const m = milestones.find((x) => x.id === milestoneId);
    if (!m || m.status !== "delivered") throw new AppError("INVALID_STATE", "This delivery is not waiting for a change request.");
    const count = (await q1<{ n: number }>(tx, "SELECT count(*)::int AS n FROM change_requests WHERE milestone_id=$1", [m.id]))!.n;
    if (count >= 2) throw new AppError("INVALID_STATE", "You have used both change requests for this delivery. Confirm it or open a dispute.");
    await q(tx, "INSERT INTO change_requests (milestone_id, note) VALUES ($1,$2)", [m.id, note.trim()]);
    await notify(tx, defer, { userId: order.seller_id, type: "changes", title: "Buyer asked for changes",
      message: `The buyer asked for changes to "${m.title}": ${note.trim().slice(0, 200)}`, orderId: order.id,
      email: { to: order.seller_email, path: `/orders/${order.id}`, buttonLabel: "View request" } });
  });
  return { sent: true as const };
}

export async function deliverMilestone(user: SessionUser, orderId: string, milestoneId: string, proof: { kind: "note" | "link"; content: string }) {
  await getSellerOrder(user.id, orderId);
  if (proof.kind === "link" && !/^https?:\/\/\S+$/i.test(proof.content)) {
    throw new AppError("VALIDATION", "Enter a link that starts with http:// or https://.", { content: "Enter a valid http(s) link." });
  }
  await withTx(async (tx, defer) => {
    const { order, milestones } = await lockOrder(tx, orderId);
    const m = milestones.find((x) => x.id === milestoneId);
    if (!m || order.status !== "funded") throw new AppError("INVALID_STATE", "This milestone is not ready to be marked delivered.");
    const full = (await q1<{ revision_count: number }>(tx, "SELECT revision_count FROM milestones WHERE id=$1", [m.id]))!;
    const changeCount = (await q1<{ n: number }>(tx, "SELECT count(*)::int AS n FROM change_requests WHERE milestone_id=$1", [m.id]))!.n;
    if (m.status === "delivered") {
      // Re-delivery after the buyer asked for changes: allowed while unanswered requests exist; restarts the review window.
      if (changeCount <= full.revision_count || full.revision_count >= 2) throw new AppError("INVALID_STATE", "This milestone is already delivered and waiting for the buyer.");
      await q(tx, `UPDATE milestones SET proof_kind=$2, proof_content=$3, delivered_at=now(), release_at = now() + make_interval(hours => $4), reminder_sent_at=NULL,
        revision_count = revision_count + 1, updated_at=now() WHERE id=$1`, [m.id, proof.kind, proof.content.trim(), order.review_window_hours]);
    } else {
      const blocked = milestones.some((x) => x.position < m.position && x.status !== "released" && x.status !== "refunded");
      if (m.status !== "pending" || blocked) throw new AppError("INVALID_STATE", "Finish the earlier milestone first: it must be confirmed, released or refunded before the next one.");
      await q(tx, `UPDATE milestones SET status='delivered', proof_kind=$2, proof_content=$3, delivered_at=now(), release_at = now() + make_interval(hours => $4), updated_at=now() WHERE id=$1`,
        [m.id, proof.kind, proof.content.trim(), order.review_window_hours]);
    }
    await notify(tx, defer, { userId: user.id, type: "delivered", title: "Delivery submitted", message: `"${m.title}" is with the buyer for review.`, orderId: order.id });
    emailBuyer(defer, order.buyer_email, "Your order was delivered",
      `The seller marked "${m.title}" as delivered. Review it and confirm to release payment. If you do nothing, payment is released automatically after ${order.review_window_hours} hours.`,
      `/pay/${order.token}`, "Review delivery");
  });
  return getSellerOrder(user.id, orderId);
}

/** Admin sandbox helper wrapper lives in admin service; refund of unallocated funds is below. */
export async function refundUnallocated(orderId: string): Promise<{ refundedKobo: number }> {
  const result = await withTx(async (tx, defer) => {
    const { order } = await lockOrder(tx, orderId);
    const o = (await q1<{ amount_funded_kobo: number; overpaid_kobo: number; status: string }>(tx, "SELECT amount_funded_kobo, overpaid_kobo, status FROM orders WHERE id=$1", [orderId]))!;
    const refunded = (await q1<{ n: number }>(tx, "SELECT COALESCE(SUM(amount_kobo),0)::bigint AS n FROM ledger_entries WHERE order_id=$1 AND type='refund' AND milestone_id IS NULL", [orderId]))!.n;
    const refundable = ["funded", "completed"].includes(o.status) ? o.overpaid_kobo - refunded : o.amount_funded_kobo - refunded;
    if (refundable <= 0) throw new AppError("INVALID_STATE", "There are no unallocated funds to refund on this order.");
    await writeRefund(tx, { orderId, milestoneId: null, amountKobo: refundable, key: `refund-excess:${orderId}:${refunded}` });
    const pid = await queuePayout(tx, { orderId, milestoneId: null, kind: "buyer_refund", amountKobo: refundable, key: `payout:${orderId}:excess:${refunded}` });
    await q(tx, "UPDATE orders SET needs_refund_flag=false, updated_at=now() WHERE id=$1", [orderId]);
    defer(() => processPayout(pid));
    emailBuyer(defer, order.buyer_email, "Refund issued", `We are refunding ${formatNaira(refundable)} for "${order.title}" to the account you paid from.`, `/pay/${order.token}`, "View order");
    return { refundedKobo: refundable };
  });
  return result;
}

