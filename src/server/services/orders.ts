import "server-only";
import { randomUUID } from "node:crypto";
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
import { reconcilePagaPaymentRequest } from "@/server/services/paga-reconciliation";
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
  const provider = getPaymentProvider();
  const account = provider.name === "paga"
    ? null
    : await provider.createCollectionAccount({ orderId, amountKobo: total, reference: `PS-${orderId}`, expiresAt });
  await withTx(async (tx) => {
    const { order } = await lockOrder(tx, orderId);
    if (order.status !== "draft") throw new AppError("INVALID_STATE", "Only a draft order can be published.");
    await q(tx, `UPDATE orders SET status='awaiting_payment', published_at=now(), expires_at=$2, order_account_bank=$3, order_account_number=$4,
      order_account_name=$5, order_account_expires_at=$2, updated_at=now() WHERE id=$1`,
      [orderId, expiresAt, account?.bankName ?? null, account?.accountNumber ?? null, account?.accountName ?? null]);
  });
  return getSellerOrder(user.id, orderId);
}

export async function createPagaPaymentAccount(
  token: string,
  contact: { phone?: string; email?: string } = {},
): Promise<PublicOrder> {
  await rateLimit({ key: `paga-account:${token}`, limit: 5, windowSeconds: 3600 });
  const rawPhone = contact.phone?.trim();
  const inputPhone = rawPhone ? normalizeNgPhone(rawPhone) : null;
  if (rawPhone && !inputPhone) {
    throw new AppError("VALIDATION", "Enter a valid Nigerian phone number.", { phone: "Enter a valid Nigerian phone number." });
  }
  const inputEmail = contact.email?.trim().toLowerCase() || null;
  const provider = getPaymentProvider();
  if (provider.name !== "paga") throw new AppError("NOT_FOUND", "This payment account is not available.");

  const result = await withTx(async (tx) => {
    const order = await q1<{
      id: string;
      status: string;
      total_kobo: number;
      buyer_email: string | null;
      buyer_phone: string | null;
      order_account_number: string | null;
      order_account_expires_at: Date | null;
      expires_at: Date | null;
    }>(tx, `SELECT id, status, total_kobo, buyer_email, buyer_phone, order_account_number,
        order_account_expires_at, expires_at
      FROM orders WHERE token=$1 AND status <> 'draft' FOR UPDATE`, [token]);
    if (!order) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
    if (order.status !== "awaiting_payment" || !order.expires_at || order.expires_at.getTime() <= Date.now()) {
      throw new AppError("INVALID_STATE", "This payment link is no longer active.");
    }

    const accountExpiry = order.order_account_expires_at ?? order.expires_at;
    if (order.order_account_number && accountExpiry.getTime() > Date.now()) return { kind: "ready" as const };

    await q(tx, `UPDATE paga_payment_requests SET status='expired', updated_at=now()
      WHERE order_id=$1 AND status IN ('creating','pending') AND expires_at <= now()`, [order.id]);
    if (order.order_account_number) {
      await q(tx, `UPDATE orders SET order_account_bank=NULL, order_account_number=NULL, order_account_name=NULL,
        order_account_expires_at=NULL, order_account_total_payment_kobo=NULL, updated_at=now() WHERE id=$1`, [order.id]);
    }

    const existing = await q1<{
      status: string;
      reference_number: string;
      request_amount_kobo: number;
      last_error: string | null;
      created_at: Date;
      bank_name: string | null;
      account_number: string | null;
      account_name: string | null;
      total_payment_amount_kobo: number | null;
      expires_at: Date;
    }>(tx, `SELECT status, reference_number, request_amount_kobo, last_error, created_at, bank_name,
        account_number, account_name, total_payment_amount_kobo, expires_at
      FROM paga_payment_requests
      WHERE order_id=$1 AND status IN ('creating','pending','review')
      ORDER BY created_at DESC LIMIT 1`, [order.id]);
    if (existing?.status === "pending") {
      if (existing.bank_name && existing.account_number && existing.account_name && existing.total_payment_amount_kobo) {
        await q(tx, `UPDATE orders SET order_account_bank=$2, order_account_number=$3, order_account_name=$4,
          order_account_expires_at=$5, order_account_total_payment_kobo=$6, updated_at=now() WHERE id=$1`,
        [order.id, existing.bank_name, existing.account_number, existing.account_name, existing.expires_at, existing.total_payment_amount_kobo]);
      }
      return { kind: "ready" as const };
    }
    const phone = inputPhone ?? order.buyer_phone;
    const email = inputEmail ?? order.buyer_email;
    if (existing?.status === "creating" && Date.now() - existing.created_at.getTime() < 60_000) {
      return { kind: "creating" as const };
    }
    if (existing?.status === "review" && existing.last_error !== "Provider request outcome requires reconciliation.") {
      throw new AppError("CONFLICT", "Paga is checking this payment request. Please contact support if this continues.");
    }
    if (!phone || !email) {
      throw new AppError("VALIDATION", "Enter both a phone number and email address to create payment details.", {
        ...(!phone ? { phone: "Enter a valid Nigerian phone number." } : {}),
        ...(!email ? { email: "Enter a valid email address." } : {}),
      });
    }

    if (existing?.status === "creating" || existing?.status === "review") {
      return {
        kind: "create" as const,
        orderId: order.id,
        amountKobo: existing.request_amount_kobo,
        reference: existing.reference_number,
        expiresAt: existing.expires_at,
        buyerPhone: phone,
        buyerEmail: email,
      };
    }

    const requestExpiresAt = new Date(Math.min(order.expires_at.getTime(), Date.now() + 24 * 60 * 60 * 1000));
    const reference = `PS-${order.id}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await q(tx, `INSERT INTO paga_payment_requests (order_id, reference_number, request_amount_kobo, expires_at, status)
      VALUES ($1,$2,$3,$4,'creating')`, [order.id, reference, order.total_kobo, requestExpiresAt]);
    await q(tx, `UPDATE orders SET buyer_phone=COALESCE($2,buyer_phone), buyer_email=COALESCE($3,buyer_email), updated_at=now()
      WHERE id=$1`, [order.id, phone, email]);
    return {
      kind: "create" as const,
      orderId: order.id,
      amountKobo: order.total_kobo,
      reference,
      expiresAt: requestExpiresAt,
      buyerPhone: phone,
      buyerEmail: email,
    };
  });

  if (result.kind !== "create") {
    const publicOrder = await loadPublic(token);
    if (!publicOrder) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
    return publicOrder;
  }

  try {
    const account = await provider.createCollectionAccount({
      orderId: result.orderId,
      amountKobo: result.amountKobo,
      reference: result.reference,
      expiresAt: result.expiresAt,
      buyerPhone: result.buyerPhone ?? undefined,
      buyerEmail: result.buyerEmail,
    });
    await withTx(async (tx) => {
      const request = await q1<{ id: string }>(tx, `UPDATE paga_payment_requests SET
          total_payment_amount_kobo=$2, bank_name=$3, account_number=$4, account_name=$5,
          expires_at=$6, status='pending', last_error=NULL, updated_at=now()
        WHERE reference_number=$1 AND (
          status='creating' OR (status='review' AND last_error='Provider request outcome requires reconciliation.')
        ) RETURNING id`,
      [result.reference, account.totalPaymentAmountKobo, account.bankName, account.accountNumber, account.accountName, account.expiresAt]);
      if (!request) throw new AppError("CONFLICT", "The payment request changed while details were being created.");
      await q(tx, `UPDATE orders SET order_account_bank=$2, order_account_number=$3, order_account_name=$4,
          order_account_expires_at=$5, order_account_total_payment_kobo=$6, updated_at=now()
        WHERE id=$1 AND status='awaiting_payment'`,
      [result.orderId, account.bankName, account.accountNumber, account.accountName, account.expiresAt, account.totalPaymentAmountKobo]);
    });
  } catch (error) {
    await q(undefined, `UPDATE paga_payment_requests SET status='review',
      last_error='Provider request outcome requires reconciliation.', updated_at=now()
      WHERE reference_number=$1 AND status='creating'`, [result.reference]);
    throw error;
  }

  const publicOrder = await loadPublic(token);
  if (!publicOrder) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  return publicOrder;
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
  await rateLimit({ key: `check:${token}`, limit: 180, windowSeconds: 600 });
  const [g] = await loadGraphs(undefined, "o.token = $1 AND o.status <> 'draft'", [token]);
  if (!g) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  if (g.order.status === "awaiting_payment" && getPaymentProvider().name === "paga") {
    const request = await q1<{ reference_number: string }>(undefined, `SELECT reference_number FROM paga_payment_requests
      WHERE order_id=$1 AND status IN ('pending','review') ORDER BY created_at DESC LIMIT 1`, [g.order.id]);
    if (request) await reconcilePagaPaymentRequest(request.reference_number);
  }
  const [fresh] = await loadGraphs(undefined, "o.token = $1 AND o.status <> 'draft'", [token]);
  if (!fresh) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  const order = toPublicOrder(fresh);
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

