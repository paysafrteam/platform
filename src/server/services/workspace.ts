import "server-only";
import { q, q1 } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { writeAudit } from "@/server/audit";
import { sendEmail } from "@/server/email";
import { notification } from "@/server/email/templates";
import { loadGraphs, toSellerOrder } from "@/server/mappers/orders";
import { qualifyingOrders, QUALIFYING_MIN_ORDERS } from "@/server/services/trust";
import { nigerianBanks } from "@/content/nigerian-banks";
import type { DashboardData, IncomeData, Notification, PayoutAccount, PublicInvoice, TrustData, TrustLevel } from "@/lib/domain/types";
import type { SessionUser } from "@/server/auth/session";
import { validatePagaBankAccount } from "@/server/payments/paga";
import { env } from "@/server/env";

/** Last `count` Lagos calendar months (Lagos is UTC+1 with no DST), oldest first. */
export function lastMonths(now: Date, count = 6): { month: string; label: string }[] {
  const lagos = new Date(now.getTime() + 3_600_000);
  const out: { month: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth() - i, 1));
    out.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-NG", { month: "short", timeZone: "UTC" }) });
  }
  return out;
}

export async function getDashboard(sellerId: string): Promise<DashboardData> {
  const [held, paid, awaiting, disputes, recent, income] = await Promise.all([
    q1<{ n: number }>(undefined, `SELECT COALESCE(SUM(m.amount_kobo),0)::bigint AS n FROM milestones m JOIN orders o ON o.id=m.order_id
      WHERE o.seller_id=$1 AND o.status='funded' AND m.status IN ('pending','delivered','disputed')`, [sellerId]),
    q1<{ n: number }>(undefined, `SELECT COALESCE(SUM(l.amount_kobo),0)::bigint AS n FROM ledger_entries l JOIN orders o ON o.id=l.order_id WHERE o.seller_id=$1 AND l.type='release'`, [sellerId]),
    q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM orders WHERE seller_id=$1 AND status='awaiting_payment' AND expires_at > now()", [sellerId]),
    q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM disputes d JOIN orders o ON o.id=d.order_id WHERE o.seller_id=$1 AND d.status <> 'resolved'", [sellerId]),
    loadGraphs(undefined, "o.seller_id = $1 ORDER BY o.created_at DESC LIMIT 5", [sellerId]),
    q<{ month: string; kobo: number }>(undefined, `SELECT to_char(l.created_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM') AS month, SUM(l.amount_kobo)::bigint AS kobo
      FROM ledger_entries l JOIN orders o ON o.id=l.order_id WHERE o.seller_id=$1 AND l.type='release' GROUP BY 1`, [sellerId]),
  ]);
  const actionRows = await q<{ order_id: string; title: string; kind: "deliver" | "awaiting_buyer" | "awaiting_payment" | "dispute"; detail: string; at: Date | null }>(undefined, `
    SELECT * FROM (
      SELECT o.id AS order_id, o.title, 'dispute' AS kind, 'Dispute open: respond with evidence' AS detail, d.response_due_at AS at FROM disputes d JOIN orders o ON o.id=d.order_id WHERE o.seller_id=$1 AND d.status <> 'resolved'
      UNION ALL SELECT o.id, o.title, 'awaiting_buyer', 'Waiting for the buyer: ' || m.title, m.release_at FROM milestones m JOIN orders o ON o.id=m.order_id WHERE o.seller_id=$1 AND o.status='funded' AND m.status='delivered'
      UNION ALL SELECT o.id, o.title, 'deliver', 'Ready to deliver: ' || m.title, NULL FROM milestones m JOIN orders o ON o.id=m.order_id WHERE o.seller_id=$1 AND o.status='funded' AND m.status='pending'
        AND m.position = (SELECT min(position) FROM milestones x WHERE x.order_id=o.id AND x.status='pending')
      UNION ALL SELECT o.id, o.title, 'awaiting_payment', 'Waiting for the buyer to pay', o.expires_at FROM orders o WHERE o.seller_id=$1 AND o.status='awaiting_payment' AND o.expires_at > now()
    ) t LIMIT 5`, [sellerId]);
  const byMonth = new Map(income.map((r) => [r.month, r.kobo]));
  return {
    heldKobo: held?.n ?? 0, paidOutKobo: paid?.n ?? 0, awaitingPaymentCount: awaiting?.n ?? 0, openDisputeCount: disputes?.n ?? 0,
    needsAction: actionRows.map((r) => ({ orderId: r.order_id, title: r.title, kind: r.kind, detail: r.detail, ...(r.at ? { at: r.at.toISOString() } : {}) })),
    recentOrders: recent.map(toSellerOrder),
    incomeByMonth: lastMonths(new Date()).map((m) => ({ ...m, kobo: byMonth.get(m.month) ?? 0 })),
  };
}

export async function getIncome(sellerId: string, limit = 50): Promise<IncomeData> {
  const [sums, completed, tx] = await Promise.all([
    q1<{ received: number; fees: number }>(undefined, `SELECT COALESCE(SUM(l.amount_kobo) FILTER (WHERE l.type='release'),0)::bigint AS received,
      COALESCE(SUM(l.amount_kobo) FILTER (WHERE l.type='fee'),0)::bigint AS fees FROM ledger_entries l JOIN orders o ON o.id=l.order_id WHERE o.seller_id=$1`, [sellerId]),
    q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM orders WHERE seller_id=$1 AND status='completed'", [sellerId]),
    q<{ id: string; type: IncomeData["transactions"][number]["type"]; order_id: string; title: string; amount_kobo: number; created_at: Date }>(undefined,
      `SELECT l.id, l.type, o.id AS order_id, o.title, l.amount_kobo, l.created_at FROM ledger_entries l JOIN orders o ON o.id=l.order_id
       WHERE o.seller_id=$1 AND l.type IN ('release','fee') ORDER BY l.created_at DESC LIMIT $2`, [sellerId, Math.min(limit, 200)]),
  ]);
  return { receivedKobo: sums?.received ?? 0, feesKobo: sums?.fees ?? 0, completedOrders: completed?.n ?? 0,
    transactions: tx.map((t) => ({ id: t.id, type: t.type, orderId: t.order_id, orderTitle: t.title, amountKobo: t.amount_kobo, createdAt: t.created_at.toISOString() })) };
}

export async function getTrust(sellerId: string): Promise<TrustData> {
  const u = await q1<{ trust_score: number | null; trust_level: TrustLevel; completed_orders: number }>(undefined, "SELECT trust_score, trust_level, completed_orders FROM users WHERE id=$1", [sellerId]);
  const events = await q<{ id: string; event_type: string; delta: number; score_after: number | null; title: string | null; created_at: Date }>(undefined,
    `SELECT t.id, t.event_type, t.delta, t.score_after, o.title, t.created_at FROM trust_events t LEFT JOIN orders o ON o.id=t.order_id WHERE t.seller_id=$1 ORDER BY t.created_at DESC LIMIT 20`, [sellerId]);
  return { score: u?.trust_score ?? null, level: u?.trust_level ?? "new", completedOrders: u?.completed_orders ?? 0,
    qualifyingOrders: (await qualifyingOrders(undefined, sellerId)).length, qualifyingNeeded: QUALIFYING_MIN_ORDERS,
    events: events.map((e) => ({ id: e.id, eventType: e.event_type, delta: e.delta, scoreAfter: e.score_after, orderTitle: e.title, createdAt: e.created_at.toISOString() })) };
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const rows = await q<{ id: string; type: string; title: string; message: string; order_id: string | null; read_at: Date | null; created_at: Date }>(undefined,
    "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [userId]);
  return rows.map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, ...(n.order_id ? { orderId: n.order_id } : {}), read: !!n.read_at, createdAt: n.created_at.toISOString() }));
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await q(undefined, "UPDATE notifications SET read_at = now() WHERE user_id=$1 AND read_at IS NULL AND ($2::uuid[] IS NULL OR id = ANY($2))", [userId, ids?.length ? ids : null]);
  return { ok: true as const };
}

export const listBanks = () => nigerianBanks;

export async function resolveBank(input: { bankCode: string; accountNumber: string }) {
  if (!/^\d{10}$/.test(input.accountNumber)) throw new AppError("VALIDATION", "Enter a 10-digit account number.", { accountNumber: "Enter a 10-digit account number." });
  if (!nigerianBanks.some((b) => b.code === input.bankCode)) throw new AppError("VALIDATION", "Choose a bank from the list.", { bankCode: "Choose a bank." });
  if (env().BANK_RESOLVER === "paga") {
    const resolved = await validatePagaBankAccount(input);
    return { accountName: resolved.accountName, verified: true, manual: false as const };
  }
  return { accountName: null, verified: false, manual: true as const };
}

export async function savePayoutAccount(user: SessionUser, input: { bankCode: string; accountNumber: string; accountName: string }, ip: string): Promise<PayoutAccount> {
  const bank = nigerianBanks.find((b) => b.code === input.bankCode);
  if (!bank) throw new AppError("VALIDATION", "Choose a bank from the list.", { bankCode: "Choose a bank." });
  let accountName = input.accountName.trim();
  let verified = false;
  if (env().BANK_RESOLVER === "paga") {
    const resolved = await validatePagaBankAccount({ bankCode: input.bankCode, accountNumber: input.accountNumber });
    accountName = resolved.accountName;
    verified = true;
  }
  const prev = await q1<{ account_number: string; bank_code: string }>(undefined, "SELECT account_number, bank_code FROM payout_accounts WHERE user_id=$1", [user.id]);
  await q(undefined, `INSERT INTO payout_accounts (user_id, bank_code, bank_name, account_number, account_name, verified, verified_at) VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN now() ELSE NULL END)
    ON CONFLICT (user_id) DO UPDATE SET bank_code=EXCLUDED.bank_code, bank_name=EXCLUDED.bank_name, account_number=EXCLUDED.account_number,
      account_name=EXCLUDED.account_name, verified=EXCLUDED.verified, verified_at=EXCLUDED.verified_at, updated_at=now()`, [user.id, bank.code, bank.name, input.accountNumber, accountName, verified]);
  const mask = (n?: string) => (n ? `******${n.slice(-4)}` : null);
  await writeAudit(undefined, { actorType: "user", actorId: user.id, actorLabel: user.email.replace(/^(.).*(@.*)$/, "$1***$2"), action: "payout_account.changed",
    targetType: "user", targetId: user.id, before: { account: mask(prev?.account_number), bank: prev?.bank_code }, after: { account: mask(input.accountNumber), bank: bank.code }, ip });
  await sendEmail({ to: user.email, template: "payout_account_changed", content: notification("Payout account changed",
    `Your PaySafr payout account was set to ${bank.name} ending ${input.accountNumber.slice(-4)}. If this was not you, change your password and contact support now.`) });
  return { bankCode: bank.code, bankName: bank.name, accountNumber: input.accountNumber, accountName, verified };
}

export async function listInvoices(sellerId: string): Promise<PublicInvoice[]> {
  const gs = await loadGraphs(undefined, "o.seller_id = $1 AND o.status <> 'draft' ORDER BY o.created_at DESC", [sellerId]);
  return gs.map((g) => invoiceFromGraph(g));
}

function invoiceFromGraph(g: Awaited<ReturnType<typeof loadGraphs>>[number], masked = false): PublicInvoice {
  const o = g.order;
  const contact = o.buyer_email ?? o.buyer_phone ?? undefined;
  const status = (o.status === "awaiting_payment" && o.expires_at && o.expires_at.getTime() <= Date.now() ? "expired" : o.status) as PublicInvoice["status"];
  return {
    token: o.token, title: o.title, description: o.description, sellerName: o.seller_name, ...(o.seller_business ? { businessName: o.seller_business } : {}),
    ...(contact ? { buyerContact: masked ? maskContact(contact) : contact } : {}), totalKobo: o.total_kobo, feeKobo: o.fee_kobo, sellerReceivesKobo: o.total_kobo - o.fee_kobo,
    status, createdAt: o.created_at.toISOString(), dueAt: o.expires_at ? o.expires_at.toISOString() : null,
    milestones: g.milestones.map((m) => ({ title: m.title, amountKobo: m.amount_kobo })),
  };
}
const maskContact = (c: string) => (c.includes("@") ? c.replace(/^(.).*(@.*)$/, "$1***$2") : `${c.slice(0, 4)}****${c.slice(-3)}`);

export async function getPublicInvoice(token: string): Promise<PublicInvoice | null> {
  if (!token || token.length > 100) return null;
  const [g] = await loadGraphs(undefined, "o.token = $1 AND o.status <> 'draft'", [token]);
  return g ? invoiceFromGraph(g, true) : null;
}
