import "server-only";
import { q, q1, withTx } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { writeAudit } from "@/server/audit";
import { getSettings, updateSettings, type PlatformSettings } from "@/server/settings";
import { env } from "@/server/env";
import { revokeUserSessions } from "@/server/auth/session";
import { sendEmail } from "@/server/email";
import { notification } from "@/server/email/templates";
import { loadGraphs, toSellerOrder } from "@/server/mappers/orders";
import { recordFunding } from "@/server/services/funding";
import { processPayout } from "@/server/services/payouts";
import { refundUnallocated } from "@/server/services/orders";
import { randomToken } from "@/server/ids";
import { FEE_TIER_THRESHOLD_KOBO, HIGHER_FEE_RATE, LOWER_FEE_RATE } from "@/lib/domain/rules";
import type { SellerStatus } from "@/lib/domain/types";

export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
const LAGOS_MIDNIGHT = "(date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos')";
const iso = (d: Date | null) => (d ? d.toISOString() : null);

class Where {
  parts: string[] = []; params: unknown[] = [];
  add(sql: string, value: unknown) { this.params.push(value); this.parts.push(sql.replace("?", `$${this.params.length}`)); }
  get sql() { return this.parts.length ? `WHERE ${this.parts.join(" AND ")}` : ""; }
}
const pageArgs = (p?: number, size = 25) => { const pageSize = Math.min(Math.max(size, 1), 100); const page = Math.max(p ?? 1, 1); return { page, pageSize, offset: (page - 1) * pageSize }; };
const like = (s: string) => `%${s.replace(/[%_\\]/g, "\\$&")}%`;

export async function overview() {
  const [held, fundedToday, disputes, payouts, refundN, users, byStatus, vol, byReason, recentOrders, recentAudit, email, lastJob, integrity] = await Promise.all([
    q1<{ n: number }>(undefined, "SELECT COALESCE(SUM(CASE WHEN type='funding' THEN amount_kobo ELSE -amount_kobo END),0)::bigint AS n FROM ledger_entries"),
    q1<{ c: number; n: number }>(undefined, `SELECT count(*)::int AS c, COALESCE(SUM(amount_kobo),0)::bigint AS n FROM ledger_entries WHERE type='funding' AND created_at >= ${LAGOS_MIDNIGHT}`),
    q1<{ open: number; due_soon: number; oldest: Date | null }>(undefined, `SELECT count(*)::int AS open, count(*) FILTER (WHERE response_due_at <= now() + interval '12 hours')::int AS due_soon, min(opened_at) AS oldest FROM disputes WHERE status <> 'resolved'`),
    q1<{ pending: number; failed: number }>(undefined, `SELECT count(*) FILTER (WHERE status IN ('queued','processing','pending'))::int AS pending, count(*) FILTER (WHERE status IN ('failed','reversed'))::int AS failed FROM payouts`),
    q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM orders WHERE needs_refund_flag"),
    q1<{ total: number; new7d: number; unverified: number; limited: number; suspended: number }>(undefined, `SELECT count(*) FILTER (WHERE email_verified_at IS NOT NULL)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '7 days' AND email_verified_at IS NOT NULL)::int AS new7d, count(*) FILTER (WHERE email_verified_at IS NULL)::int AS unverified,
      count(*) FILTER (WHERE status='limited')::int AS limited, count(*) FILTER (WHERE status='suspended')::int AS suspended FROM users`),
    q<{ status: string; n: number }>(undefined, "SELECT status, count(*)::int AS n FROM orders GROUP BY status"),
    q<{ day: string; kobo: number }>(undefined, `SELECT to_char(g.day, 'YYYY-MM-DD') AS day, COALESCE(SUM(l.amount_kobo),0)::bigint AS kobo
      FROM generate_series((now() AT TIME ZONE 'Africa/Lagos')::date - 13, (now() AT TIME ZONE 'Africa/Lagos')::date, interval '1 day') AS g(day)
      LEFT JOIN ledger_entries l ON l.type='funding' AND (l.created_at AT TIME ZONE 'Africa/Lagos')::date = g.day::date GROUP BY g.day ORDER BY g.day`),
    q<{ reason: string; n: number }>(undefined, "SELECT reason, count(*)::int AS n FROM disputes GROUP BY reason"),
    loadGraphs(undefined, "TRUE ORDER BY o.created_at DESC LIMIT 5", []),
    q<{ id: string; actor_label: string; action: string; target_type: string | null; target_id: string | null; created_at: Date }>(undefined, "SELECT id, actor_label, action, target_type, target_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 5"),
    q1<{ sent: number; failed: number }>(undefined, "SELECT count(*) FILTER (WHERE status='sent')::int AS sent, count(*) FILTER (WHERE status='failed')::int AS failed FROM email_log WHERE created_at > now() - interval '24 hours'"),
    q1<{ at: Date | null }>(undefined, "SELECT max(started_at) AS at FROM job_runs"),
    reconciliation(),
  ]);
  const failedPayouts = await q<{ id: string; order_id: string; amount_kobo: number; last_error: string | null }>(undefined, "SELECT id, order_id, amount_kobo, last_error FROM payouts WHERE status IN ('failed','reversed') ORDER BY updated_at DESC LIMIT 5");
  const flagged = await q<{ id: string; title: string }>(undefined, "SELECT id, title FROM orders WHERE needs_refund_flag ORDER BY updated_at DESC LIMIT 5");
  const dueSoon = await q<{ id: string; number: number; response_due_at: Date }>(undefined, "SELECT id, number, response_due_at FROM disputes WHERE status <> 'resolved' AND response_due_at <= now() + interval '12 hours' ORDER BY response_due_at LIMIT 5");
  const oldest = disputes?.oldest ? Math.floor((Date.now() - disputes.oldest.getTime()) / 3_600_000) : null;
  return {
    totalHeldKobo: Math.max(0, held?.n ?? 0), fundedToday: { count: fundedToday?.c ?? 0, amountKobo: fundedToday?.n ?? 0 },
    openDisputes: { count: disputes?.open ?? 0, dueSoon: disputes?.due_soon ?? 0, oldestAgeHours: oldest },
    payouts: { pending: payouts?.pending ?? 0, failed: payouts?.failed ?? 0 }, ordersNeedingRefund: refundN?.n ?? 0,
    integrity: { ok: integrity.ok, issueCount: integrity.issueCount },
    users: { totalSellers: users?.total ?? 0, new7d: users?.new7d ?? 0, unverified: users?.unverified ?? 0, limited: users?.limited ?? 0, suspended: users?.suspended ?? 0 },
    ordersByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), volume14d: vol.map((v) => ({ day: v.day, kobo: v.kobo })),
    disputesByReason: Object.fromEntries(byReason.map((r) => [r.reason, r.n])), recentOrders: recentOrders.map(toSellerOrder),
    recentAudit: recentAudit.map((a) => ({ id: a.id, actor: a.actor_label, action: a.action, target: a.target_id ?? "", createdAt: a.created_at.toISOString() })),
    needsAttention: {
      failedPayouts: failedPayouts.map((p) => ({ id: p.id, orderId: p.order_id, amountKobo: p.amount_kobo, error: p.last_error })),
      flaggedOrders: flagged.map((o) => ({ id: o.id, title: o.title })),
      disputesDue: dueSoon.map((d) => ({ id: d.id, number: `DSP-${d.number}`, dueAt: d.response_due_at.toISOString() })),
    },
    health: { dbOk: true, emailSent24h: email?.sent ?? 0, emailFailed24h: email?.failed ?? 0, lastJobTickAt: iso(lastJob?.at ?? null), paymentMode: env().PAYMENT_MODE, environment: env().NEXT_PUBLIC_APP_ENV },
  };
}

export async function listDisputes(f: { status?: string | undefined; reason?: string | undefined; q?: string | undefined; page?: number | undefined }): Promise<Page<Record<string, unknown>>> {
  const w = new Where();
  if (f.status) w.add("d.status = ?", f.status);
  if (f.reason) w.add("d.reason = ?", f.reason);
  if (f.q) { w.params.push(like(f.q)); w.parts.push(`(o.title ILIKE $${w.params.length} OR ('DSP-' || d.number) ILIKE $${w.params.length})`); }
  const { page, pageSize, offset } = pageArgs(f.page);
  const base = `FROM disputes d JOIN orders o ON o.id=d.order_id JOIN milestones m ON m.id=d.milestone_id JOIN users u ON u.id=o.seller_id ${w.sql}`;
  const total = (await q1<{ n: number }>(undefined, `SELECT count(*)::int AS n ${base}`, w.params))!.n;
  const rows = await q<{ id: string; number: number; status: string; reason: string; opened_by: string; response_due_at: Date; opened_at: Date; outcome: string | null; order_id: string; title: string; m_title: string; amount_kobo: number; seller: string }>(undefined,
    `SELECT d.id, d.number, d.status, d.reason, d.opened_by, d.response_due_at, d.opened_at, d.outcome, o.id AS order_id, o.title, m.title AS m_title, m.amount_kobo, u.name AS seller ${base}
     ORDER BY (d.status='resolved'), d.response_due_at LIMIT ${pageSize} OFFSET ${offset}`, w.params);
  return { page, pageSize, total, items: rows.map((r) => ({ id: r.id, number: `DSP-${r.number}`, status: r.status, reason: r.reason, openedBy: r.opened_by, responseDueAt: r.response_due_at.toISOString(),
    openedAt: r.opened_at.toISOString(), outcome: r.outcome, orderId: r.order_id, orderTitle: r.title, milestoneTitle: r.m_title, amountKobo: r.amount_kobo, sellerName: r.seller })) };
}

export async function getDispute(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("NOT_FOUND", "We couldn't find this dispute.");
  const d = await q1<Record<string, unknown> & { order_id: string; milestone_id: string }>(undefined, "SELECT * FROM disputes WHERE id=$1", [id]);
  if (!d) throw new AppError("NOT_FOUND", "We couldn't find this dispute.");
  const [g] = await loadGraphs(undefined, "o.id = $1", [d.order_id]);
  const order = toSellerOrder(g!);
  const seller = await q1<{ id: string; name: string; email: string; phone: string; trust_score: number | null; trust_level: string }>(undefined, "SELECT id, name, email, phone, trust_score, trust_level FROM users WHERE id=$1", [g!.order.seller_id]);
  const evidence = await q<{ id: string; submitted_by: string; type: string; content: string; created_at: Date }>(undefined, "SELECT * FROM evidence WHERE dispute_id=$1 ORDER BY created_at", [id]);
  const timeline = await q<{ action: string; actor_label: string; created_at: Date; after: unknown }>(undefined, "SELECT action, actor_label, created_at, after FROM audit_log WHERE target_type='dispute' AND target_id=$1 ORDER BY created_at", [id]);
  const m = order.milestones.find((x) => x.id === d.milestone_id)!;
  return {
    id, number: `DSP-${d.number}`, status: d.status, reason: d.reason, openedBy: d.opened_by, note: d.note, responseDueAt: iso(d.response_due_at as Date), openedAt: iso(d.opened_at as Date),
    outcome: d.outcome ?? null, splitToSellerKobo: d.split_to_seller_kobo ?? null, decisionReason: d.decision_reason ?? null, decidedEarly: d.decided_early, resolvedAt: iso((d.resolved_at as Date | null) ?? null),
    order: { id: order.id, token: order.token, title: order.title, totalKobo: order.totalKobo, status: order.status, feeKobo: order.feeKobo },
    milestone: { id: m.id, title: m.title, amountKobo: m.amountKobo, feeKobo: m.feeKobo, status: m.status, proof: m.proof ?? null, deliveredAt: m.deliveredAt ?? null },
    seller: seller ? { id: seller.id, name: seller.name, email: seller.email, phone: seller.phone, trustScore: seller.trust_score, trustLevel: seller.trust_level } : null,
    buyer: { email: order.buyerContact?.email ?? null, phone: order.buyerContact?.phone ?? null },
    evidence: evidence.map((e) => ({ id: e.id, submittedBy: e.submitted_by, type: e.type, content: e.content, createdAt: e.created_at.toISOString() })),
    timeline: timeline.map((t) => ({ action: t.action, actor: t.actor_label, at: t.created_at.toISOString() })),
  };
}

export async function listOrders(f: { status?: string | undefined; q?: string | undefined; seller?: string | undefined; page?: number | undefined }): Promise<Page<unknown>> {
  const w = new Where();
  if (f.status) w.add("o.status = ?", f.status);
  if (f.seller) w.add("o.seller_id = ?", f.seller);
  if (f.q) { w.params.push(like(f.q)); w.parts.push(`(o.title ILIKE $${w.params.length} OR o.id::text ILIKE $${w.params.length} OR o.token ILIKE $${w.params.length} OR u.name ILIKE $${w.params.length})`); }
  const { page, pageSize, offset } = pageArgs(f.page);
  const total = (await q1<{ n: number }>(undefined, `SELECT count(*)::int AS n FROM orders o JOIN users u ON u.id=o.seller_id ${w.sql}`, w.params))!.n;
  const ids = await q<{ id: string }>(undefined, `SELECT o.id FROM orders o JOIN users u ON u.id=o.seller_id ${w.sql} ORDER BY o.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, w.params);
  const gs = ids.length ? await loadGraphs(undefined, "o.id = ANY($1) ORDER BY o.created_at DESC", [ids.map((i) => i.id)]) : [];
  return { page, pageSize, total, items: gs.map((g) => ({ ...toSellerOrder(g), sellerId: g.order.seller_id, sellerEmail: undefined })) };
}

export async function getAdminOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  const [g] = await loadGraphs(undefined, "o.id = $1", [id]);
  if (!g) throw new AppError("NOT_FOUND", "We couldn't find this order.");
  const [seller, payments, ledger, payouts, receipts, audit] = await Promise.all([
    q1<{ id: string; name: string; email: string; phone: string }>(undefined, "SELECT id, name, email, phone FROM users WHERE id=$1", [g.order.seller_id]),
    q<{ id: string; provider: string; provider_reference: string; amount_kobo: number; status: string; received_at: Date }>(undefined, "SELECT id, provider, provider_reference, amount_kobo, status, received_at FROM payments WHERE order_id=$1 ORDER BY received_at", [id]),
    q<{ id: string; milestone_id: string | null; type: string; amount_kobo: number; reference: string; created_at: Date }>(undefined, "SELECT id, milestone_id, type, amount_kobo, reference, created_at FROM ledger_entries WHERE order_id=$1 ORDER BY created_at, type", [id]),
    q<{ id: string; milestone_id: string | null; kind: string; amount_kobo: number; status: string; attempts: number; last_error: string | null; provider_reference: string | null; paga_reference_number: string | null; reversal_id: string | null }>(undefined, "SELECT id, milestone_id, kind, amount_kobo, status, attempts, last_error, provider_reference, paga_reference_number, reversal_id FROM payouts WHERE order_id=$1 ORDER BY created_at", [id]),
    q<{ number: string; public_token: string; type: string; issued_at: Date; snapshot: { amountKobo: number } }>(undefined, "SELECT number, public_token, type, issued_at, snapshot FROM receipts WHERE order_id=$1 ORDER BY issued_at", [id]),
    q<{ id: string; actor_label: string; action: string; before: unknown; after: unknown; created_at: Date }>(undefined, `SELECT id, actor_label, action, before, after, created_at FROM audit_log WHERE (target_type='order' AND target_id=$1)
      OR (target_type='dispute' AND target_id IN (SELECT id::text FROM disputes WHERE order_id=$1)) ORDER BY created_at`, [id]),
  ]);
  const held = ledger.reduce((s, l) => s + (l.type === "funding" ? l.amount_kobo : -l.amount_kobo), 0);
  return {
    order: toSellerOrder(g), seller, heldKobo: held,
    payments: payments.map((p) => ({ id: p.id, provider: p.provider, reference: p.provider_reference, amountKobo: p.amount_kobo, status: p.status, receivedAt: p.received_at.toISOString() })),
    ledger: ledger.map((l) => ({ id: l.id, milestoneId: l.milestone_id, type: l.type, amountKobo: l.amount_kobo, reference: l.reference, createdAt: l.created_at.toISOString() })),
    payouts: payouts.map((p) => ({ id: p.id, milestoneId: p.milestone_id, kind: p.kind, amountKobo: p.amount_kobo, status: p.status, attempts: p.attempts, lastError: p.last_error, reference: p.provider_reference, pagaReference: p.paga_reference_number, reversalId: p.reversal_id })),
    receipts: receipts.map((r) => ({ number: r.number, token: r.public_token, type: r.type, amountKobo: r.snapshot.amountKobo, issuedAt: r.issued_at.toISOString() })),
    audit: audit.map((a) => ({ id: a.id, actor: a.actor_label, action: a.action, before: a.before, after: a.after, createdAt: a.created_at.toISOString() })),
  };
}

export interface LedgerFilter { type?: string | undefined; orderId?: string | undefined; from?: string | undefined; to?: string | undefined; page?: number | undefined }
async function ledgerQuery(f: LedgerFilter, limitSql: string) {
  const w = new Where();
  if (f.type) w.add("l.type = ?", f.type);
  if (f.orderId) w.add("l.order_id = ?", f.orderId);
  if (f.from) w.add("l.created_at >= ?::timestamptz", f.from);
  if (f.to) w.add("l.created_at < (?::date + 1)::timestamptz", f.to);
  const rows = await q<{ id: string; order_id: string; title: string; milestone_id: string | null; type: string; amount_kobo: number; reference: string; created_at: Date }>(undefined,
    `SELECT l.id, l.order_id, o.title, l.milestone_id, l.type, l.amount_kobo, l.reference, l.created_at FROM ledger_entries l JOIN orders o ON o.id=l.order_id ${w.sql} ORDER BY l.created_at DESC, l.id ${limitSql}`, w.params);
  return { rows, w };
}
export async function listLedger(f: LedgerFilter): Promise<Page<unknown> & { heldKobo: number }> {
  const { page, pageSize, offset } = pageArgs(f.page, 50);
  const { rows, w } = await ledgerQuery(f, `LIMIT ${pageSize} OFFSET ${offset}`);
  const total = (await q1<{ n: number }>(undefined, `SELECT count(*)::int AS n FROM ledger_entries l ${w.sql}`, w.params))!.n;
  const held = (await q1<{ n: number }>(undefined, "SELECT COALESCE(SUM(CASE WHEN type='funding' THEN amount_kobo ELSE -amount_kobo END),0)::bigint AS n FROM ledger_entries"))!.n;
  return { page, pageSize, total, heldKobo: held, items: rows.map((r) => ({ id: r.id, orderId: r.order_id, orderTitle: r.title, milestoneId: r.milestone_id, type: r.type, amountKobo: r.amount_kobo, reference: r.reference, createdAt: r.created_at.toISOString() })) };
}
const csvCell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function ledgerCsv(f: LedgerFilter): Promise<string> {
  const { rows } = await ledgerQuery(f, "LIMIT 10000");
  const lines = ["id,created_at,order_id,order_title,milestone_id,type,amount_kobo,reference", ...rows.map((r) => [r.id, r.created_at.toISOString(), r.order_id, r.title, r.milestone_id, r.type, r.amount_kobo, r.reference].map(csvCell).join(","))];
  return lines.join("\n") + "\n";
}

export async function listPayouts(f: { status?: string | undefined; kind?: string | undefined; page?: number | undefined }): Promise<Page<unknown>> {
  const w = new Where();
  if (f.status) w.add("p.status = ?", f.status);
  if (f.kind) w.add("p.kind = ?", f.kind);
  const { page, pageSize, offset } = pageArgs(f.page);
  const total = (await q1<{ n: number }>(undefined, `SELECT count(*)::int AS n FROM payouts p ${w.sql}`, w.params))!.n;
  const rows = await q<{ id: string; order_id: string; title: string; milestone_id: string | null; kind: string; amount_kobo: number; status: string; attempts: number; last_error: string | null; provider_reference: string | null; paga_reference_number: string | null; reversal_id: string | null; updated_at: Date }>(undefined,
    `SELECT p.id, p.order_id, o.title, p.milestone_id, p.kind, p.amount_kobo, p.status, p.attempts,
      p.last_error, p.provider_reference, p.paga_reference_number, p.reversal_id, p.updated_at
     FROM payouts p JOIN orders o ON o.id=p.order_id ${w.sql} ORDER BY p.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, w.params);
  return { page, pageSize, total, items: rows.map((r) => ({ id: r.id, orderId: r.order_id, orderTitle: r.title, milestoneId: r.milestone_id, kind: r.kind, amountKobo: r.amount_kobo, status: r.status, attempts: r.attempts, lastError: r.last_error, reference: r.provider_reference, pagaReference: r.paga_reference_number, reversalId: r.reversal_id, updatedAt: r.updated_at.toISOString() })) };
}

export async function retryPayout(admin: { id: string; label: string }, payoutId: string) {
  const status = await withTx(async (tx) => {
    const p = await q1<{
      status: string;
      attempts: number;
      paga_reference_number: string | null;
      paga_transaction_id: string | null;
      reversal_id: string | null;
      provider_reference: string | null;
    }>(tx, "SELECT status, attempts, paga_reference_number, paga_transaction_id, reversal_id, provider_reference FROM payouts WHERE id=$1 FOR UPDATE", [payoutId]);
    if (!p || (p.status !== "failed" && p.status !== "reversed")) {
      throw new AppError("INVALID_STATE", "Only a failed or returned payout can be retried.");
    }
    if (p.status === "reversed") {
      await q(tx, "UPDATE payouts SET status='failed', paga_transaction_id=NULL, reversal_id=NULL, provider_reference=NULL, updated_at=now() WHERE id=$1", [payoutId]);
    }
    await writeAudit(tx, { actorType: "admin", actorId: admin.id, actorLabel: admin.label, action: "payout.retry", targetType: "payout", targetId: payoutId,
      before: { status: p.status, attempts: p.attempts, pagaReference: p.paga_reference_number, transactionId: p.paga_transaction_id, reversalId: p.reversal_id, providerReference: p.provider_reference },
      after: { status: "retrying" } });
    return p.status;
  });
  void status;
  const result = await processPayout(payoutId);
  return { result };
}

export async function listSellers(f: { q?: string | undefined; status?: string | undefined; page?: number | undefined }): Promise<Page<unknown>> {
  const w = new Where();
  w.parts.push("u.email_verified_at IS NOT NULL");
  if (f.status) w.add("u.status = ?", f.status);
  if (f.q) { w.params.push(like(f.q)); w.parts.push(`(u.name ILIKE $${w.params.length} OR u.email ILIKE $${w.params.length} OR u.business_name ILIKE $${w.params.length})`); }
  const { page, pageSize, offset } = pageArgs(f.page);
  const total = (await q1<{ n: number }>(undefined, `SELECT count(*)::int AS n FROM users u ${w.sql}`, w.params))!.n;
  const rows = await q<{ id: string; name: string; email: string; phone: string; business_name: string | null; status: string; status_reason: string | null; trust_score: number | null; trust_level: string; created_at: Date; orders: number; disputes: number; released: number }>(undefined,
    `SELECT u.id, u.name, u.email, u.phone, u.business_name, u.status, u.status_reason, u.trust_score, u.trust_level, u.created_at,
       (SELECT count(*)::int FROM orders o WHERE o.seller_id=u.id) AS orders,
       (SELECT count(*)::int FROM disputes d JOIN orders o ON o.id=d.order_id WHERE o.seller_id=u.id) AS disputes,
       (SELECT COALESCE(SUM(l.amount_kobo),0)::bigint FROM ledger_entries l JOIN orders o ON o.id=l.order_id WHERE o.seller_id=u.id AND l.type='release') AS released
     FROM users u ${w.sql} ORDER BY u.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, w.params);
  return { page, pageSize, total, items: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, businessName: r.business_name, status: r.status, statusReason: r.status_reason,
    trustScore: r.trust_score, trustLevel: r.trust_level, joinedAt: r.created_at.toISOString(), orderCount: r.orders, disputeCount: r.disputes, totalReleasedKobo: r.released })) };
}

export async function setSellerStatus(admin: { id: string; label: string }, sellerId: string, status: SellerStatus, reason: string, ip?: string) {
  const prev = await q1<{ status: string; email: string; name: string }>(undefined, "SELECT status, email, name FROM users WHERE id=$1", [sellerId]);
  if (!prev) throw new AppError("NOT_FOUND", "We couldn't find this seller.");
  if (prev.status === status) throw new AppError("INVALID_STATE", `This seller is already ${status}.`);
  await withTx(async (tx) => {
    await q(tx, "UPDATE users SET status=$2, status_reason=$3, updated_at=now() WHERE id=$1", [sellerId, status, reason]);
    if (status === "suspended") await revokeUserSessions(sellerId, null, tx);
    await writeAudit(tx, { actorType: "admin", actorId: admin.id, actorLabel: admin.label, action: `seller.status.${status}`, targetType: "user", targetId: sellerId, before: { status: prev.status }, after: { status, reason }, ...(ip ? { ip } : {}) });
  });
  const text = status === "active" ? "Your PaySafr account has been reactivated." : status === "limited" ? `Your PaySafr account has been limited. You can finish existing orders but cannot publish new ones. Reason: ${reason}` : `Your PaySafr account has been suspended. Reason: ${reason}`;
  await sendEmail({ to: prev.email, template: "account_status", content: notification("Your account status changed", text) });
  return { updated: true as const };
}

type Check = { key: string; label: string; pass: boolean; offending: string[] };
export async function reconciliation(): Promise<{ ok: boolean; issueCount: number; checks: Check[]; note: string; generatedAt: string }> {
  const ids = async (sql: string) => (await q<{ id: string }>(undefined, sql)).map((r) => r.id);
  const defs: [string, string, string][] = [
    ["held_non_negative", "Held balance is never negative", `SELECT order_id::text AS id FROM ledger_entries GROUP BY order_id HAVING SUM(CASE WHEN type='funding' THEN amount_kobo ELSE -amount_kobo END) < 0`],
    ["funded_matches_ledger", "Order funded amount equals funding ledger entries", `SELECT o.id::text FROM orders o WHERE o.amount_funded_kobo <> COALESCE((SELECT SUM(amount_kobo) FROM ledger_entries l WHERE l.order_id=o.id AND l.type='funding'),0)`],
    ["released_matches_ledger", "Released milestones match release + fee entries", `SELECT m.id::text FROM milestones m WHERE m.status='released' AND m.amount_kobo <> COALESCE((SELECT SUM(amount_kobo) FROM ledger_entries l WHERE l.milestone_id=m.id AND l.type IN ('release','fee','refund')),0)`],
    ["released_has_payout", "Every released milestone has a seller payout", `SELECT m.id::text FROM milestones m WHERE m.status='released' AND NOT EXISTS (SELECT 1 FROM payouts p WHERE p.milestone_id=m.id AND p.kind='seller_payout')`],
    ["completed_settled", "Completed orders have every milestone settled", `SELECT o.id::text FROM orders o WHERE o.status='completed' AND EXISTS (SELECT 1 FROM milestones m WHERE m.order_id=o.id AND m.status NOT IN ('released','refunded'))`],
    ["funded_has_receipt", "Funded and completed orders have a payment receipt", `SELECT o.id::text FROM orders o WHERE o.status IN ('funded','completed') AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id=o.id AND r.type='payment')`],
    ["refund_flags", "Orders flagged for refund (action needed)", `SELECT id::text FROM orders WHERE needs_refund_flag`],
  ];
  const checks: Check[] = [];
  for (const [key, label, sql] of defs) { const offending = await ids(sql); checks.push({ key, label, pass: offending.length === 0, offending }); }
  const issueCount = checks.reduce((s, c) => s + c.offending.length, 0);
  return { ok: issueCount === 0, issueCount, checks, generatedAt: new Date().toISOString(), note: "Internal integrity checks. Comparison with Paga statements arrives with the Paga integration." };
}

export async function listAudit(f: { actor?: string | undefined; action?: string | undefined; target?: string | undefined; from?: string | undefined; to?: string | undefined; page?: number | undefined }): Promise<Page<unknown>> {
  const w = new Where();
  if (f.actor) w.add("actor_label ILIKE ?", like(f.actor));
  if (f.action) w.add("action ILIKE ?", like(f.action));
  if (f.target) w.add("target_id ILIKE ?", like(f.target));
  if (f.from) w.add("created_at >= ?::timestamptz", f.from);
  if (f.to) w.add("created_at < (?::date + 1)::timestamptz", f.to);
  const { page, pageSize, offset } = pageArgs(f.page, 50);
  const total = (await q1<{ n: number }>(undefined, `SELECT count(*)::int AS n FROM audit_log ${w.sql}`, w.params))!.n;
  const rows = await q<{ id: string; actor_label: string; actor_type: string; action: string; target_type: string | null; target_id: string | null; before: unknown; after: unknown; created_at: Date }>(undefined,
    `SELECT id, actor_label, actor_type, action, target_type, target_id, before, after, created_at FROM audit_log ${w.sql} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, w.params);
  return { page, pageSize, total, items: rows.map((r) => ({ id: r.id, actor: r.actor_label, actorType: r.actor_type, action: r.action, targetType: r.target_type, target: r.target_id ?? "", before: r.before, after: r.after, createdAt: r.created_at.toISOString() })) };
}

export async function getAdminSettings() {
  return { settings: await getSettings(), feeTiers: { thresholdKobo: FEE_TIER_THRESHOLD_KOBO, lowerRate: LOWER_FEE_RATE, higherRate: HIGHER_FEE_RATE } };
}
export async function putAdminSettings(admin: { id: string; label: string }, patch: Partial<PlatformSettings>) {
  const before = await getSettings();
  await withTx(async (tx) => {
    await updateSettings(tx, patch, admin.label);
    await writeAudit(tx, { actorType: "admin", actorId: admin.id, actorLabel: admin.label, action: "settings.updated", targetType: "settings", targetId: "platform", before, after: { ...before, ...patch } });
  });
  return getAdminSettings();
}

export async function simulatePayment(admin: { id: string; label: string }, input: { orderId?: string | undefined; token?: string | undefined; amountKobo?: number | undefined }) {
  if (env().PAYMENT_MODE !== "simulator") throw new AppError("NOT_FOUND", "Not found.");
  const o = input.orderId
    ? await q1<{ id: string; total_kobo: number; amount_funded_kobo: number; status: string }>(undefined, "SELECT id, total_kobo, amount_funded_kobo, status FROM orders WHERE id=$1", [input.orderId])
    : await q1<{ id: string; total_kobo: number; amount_funded_kobo: number; status: string }>(undefined, "SELECT id, total_kobo, amount_funded_kobo, status FROM orders WHERE token=$1", [input.token ?? ""]);
  if (!o) throw new AppError("NOT_FOUND", "We couldn't find that order.");
  const amount = input.amountKobo ?? Math.max(o.total_kobo - o.amount_funded_kobo, 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError("VALIDATION", "Enter an amount greater than zero.", { amountKobo: "Enter an amount greater than zero." });
  const ref = `SIM-${randomToken(9)}`;
  const result = await recordFunding({ orderId: o.id, amountKobo: amount, provider: "simulator", providerReference: ref, raw: { simulated: true, by: admin.label } });
  await writeAudit(undefined, { actorType: "admin", actorId: admin.id, actorLabel: admin.label, action: "sandbox.simulate_payment", targetType: "order", targetId: o.id, after: { amountKobo: amount, reference: ref } });
  return { ...result, reference: ref, amountKobo: amount };
}

export async function adminRefundUnallocated(admin: { id: string; label: string }, orderId: string) {
  const r = await refundUnallocated(orderId);
  await writeAudit(undefined, { actorType: "admin", actorId: admin.id, actorLabel: admin.label, action: "order.refund_unallocated", targetType: "order", targetId: orderId, after: r });
  return r;
}
