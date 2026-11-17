"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/feedback/states";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { adminApi } from "@/lib/api";
import { formatLagosDate } from "@/lib/format/dates";
import type { DisputeOutcome, SellerOrder } from "@/lib/domain/types";

export type AdminPageName = "overview" | "disputes" | "dispute-detail" | "orders" | "order-detail" | "ledger" | "payouts" | "sellers" | "reconciliation" | "audit-log" | "settings";
const titles: Record<AdminPageName, string> = { overview: "Operations overview", disputes: "Disputes", "dispute-detail": "Dispute review", orders: "Orders", "order-detail": "Order record", ledger: "Ledger", payouts: "Payouts", sellers: "Sellers", reconciliation: "Reconciliation", "audit-log": "Audit log", settings: "Platform settings" };

type Params = Record<string, string | number | undefined>;
interface Paged<T> { items: T[]; page: number; pageSize: number; total: number }

function useAdminQuery<T>(path: string, params?: Params) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify(params ?? {});
  const load = useCallback(() => {
    adminApi.get<T>(path, JSON.parse(key) as Params).then((d) => { setData(d); setFailed(false); }).catch(() => setFailed(true));
  }, [path, key]);
  useEffect(() => { const t = window.setTimeout(load, 0); return () => window.clearTimeout(t); }, [load]);
  return { data, failed, reload: load };
}

const inputCls = "h-11 rounded-xl border border-[var(--ps-grey-200)] bg-white px-3 text-sm";
const btn = "min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50";
const btnPrimary = "min-h-11 rounded-full bg-[var(--ps-green-400)] px-5 text-sm disabled:opacity-50";

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead><tr className="border-b border-[var(--ps-grey-200)] text-xs text-[var(--ps-grey-600)]">{head.map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-[var(--ps-grey-200)]/60 [&_td]:px-4 [&_td]:py-3">{children}</tbody>
      </table>
    </div>
  );
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-[var(--ps-grey-600)]">
      <span>{total} result{total === 1 ? "" : "s"} · page {page} of {pages}</span>
      <span className="flex gap-2"><button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></span>
    </div>
  );
}

const short = (id: string) => id.slice(0, 8);
const reasonLabel: Record<string, string> = { not_delivered: "Not delivered", not_as_described: "Not as described", delivered_late: "Delivered late", other: "Other" };

export function AdminPage({ page, recordId }: { page: AdminPageName; recordId?: string }) {
  return (
    <div>
      <div className="mb-7"><p className="text-xs tracking-[0.12em] text-[var(--ps-grey-600)] uppercase">PaySafr operations</p><h1 className="font-display mt-2 text-3xl sm:text-4xl">{titles[page]}</h1></div>
      {page === "overview" ? <Overview /> : null}
      {page === "disputes" ? <Disputes /> : null}
      {page === "dispute-detail" && recordId ? <DisputeDetail id={recordId} /> : null}
      {page === "orders" ? <Orders /> : null}
      {page === "order-detail" && recordId ? <OrderDetail id={recordId} /> : null}
      {page === "ledger" ? <Ledger /> : null}
      {page === "payouts" ? <Payouts /> : null}
      {page === "sellers" ? <Sellers /> : null}
      {page === "reconciliation" ? <Reconciliation /> : null}
      {page === "audit-log" ? <AuditLog /> : null}
      {page === "settings" ? <Settings /> : null}
    </div>
  );
}

interface OverviewData {
  totalHeldKobo: number; fundedToday: { count: number; amountKobo: number }; openDisputes: { count: number; dueSoon: number; oldestAgeHours: number | null };
  payouts: { pending: number; failed: number }; ordersNeedingRefund: number; integrity: { ok: boolean; issueCount: number };
  users: { totalSellers: number; new7d: number; unverified: number; limited: number; suspended: number };
  ordersByStatus: Record<string, number>; volume14d: { day: string; kobo: number }[]; disputesByReason: Record<string, number>;
  recentOrders: SellerOrder[]; recentAudit: { id: string; actor: string; action: string; target: string; createdAt: string }[];
  needsAttention: { failedPayouts: { id: string; orderId: string; amountKobo: number; error: string | null }[]; flaggedOrders: { id: string; title: string }[]; disputesDue: { id: string; number: string; dueAt: string }[] };
  health: { dbOk: boolean; emailSent24h: number; emailFailed24h: number; lastJobTickAt: string | null; paymentMode: string; environment: string };
}

function Overview() {
  const { data, failed, reload } = useAdminQuery<OverviewData>("overview");
  if (failed) return <ErrorState retry={reload} />;
  if (!data) return <SkeletonCard />;
  const max = Math.max(1, ...data.volume14d.map((v) => v.kobo));
  const kpis: [string, React.ReactNode][] = [
    ["Money held", <Money key="h" kobo={data.totalHeldKobo} />],
    ["Funded today", <span key="f"><Money kobo={data.fundedToday.amountKobo} /> <span className="text-xs text-[var(--ps-grey-600)]">({data.fundedToday.count})</span></span>],
    ["Open disputes", `${data.openDisputes.count}${data.openDisputes.dueSoon ? ` · ${data.openDisputes.dueSoon} due soon` : ""}`],
    ["Payouts", `${data.payouts.pending} pending · ${data.payouts.failed} failed`],
    ["Needs refund", data.ordersNeedingRefund],
    ["Ledger integrity", data.integrity.ok ? "All checks pass" : `${data.integrity.issueCount} issue(s)`],
  ];
  const attention = data.needsAttention;
  const nothing = !attention.failedPayouts.length && !attention.flaggedOrders.length && !attention.disputesDue.length;
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{kpis.map(([l, v]) => <article key={l} className="surface-card p-5"><p className="text-sm text-[var(--ps-grey-600)]">{l}</p><p className="money mt-3 text-xl">{v}</p></article>)}</section>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface-card p-5"><h2 className="font-display text-xl">Needs attention</h2>
          {nothing ? <p className="mt-3 text-sm text-[var(--ps-grey-600)]">Nothing needs attention right now.</p> : <ul className="mt-3 space-y-2 text-sm">
            {attention.failedPayouts.map((p) => <li key={p.id}><Link className="underline" href="/admin/payouts">Failed payout <Money kobo={p.amountKobo} /></Link> {p.error ? `· ${p.error}` : ""}</li>)}
            {attention.flaggedOrders.map((o) => <li key={o.id}><Link className="underline" href={`/admin/orders/${o.id}`}>Refund needed: {o.title}</Link></li>)}
            {attention.disputesDue.map((d) => <li key={d.id}><Link className="underline" href={`/admin/disputes/${d.id}`}>{d.number} response due {formatLagosDate(d.dueAt)}</Link></li>)}
          </ul>}
        </section>
        <section className="surface-card p-5"><h2 className="font-display text-xl">Funded volume, last 14 days</h2>
          <div className="mt-4 flex h-32 items-end gap-1">{data.volume14d.map((v) => <div key={v.day} title={`${v.day}: ${v.kobo / 100}`} className="flex-1 rounded-t bg-[var(--ps-green-400)]" style={{ height: `${Math.max(2, (v.kobo / max) * 100)}%` }} />)}</div>
        </section>
        <section className="surface-card p-5"><h2 className="font-display text-xl">Orders by status</h2><ul className="mt-3 space-y-1 text-sm">{Object.entries(data.ordersByStatus).map(([k, n]) => <li key={k} className="flex justify-between"><span className="capitalize">{k.replace("_", " ")}</span><span className="money">{n}</span></li>)}</ul>
          <h2 className="font-display mt-5 text-xl">Disputes by reason</h2><ul className="mt-3 space-y-1 text-sm">{Object.entries(data.disputesByReason).map(([k, n]) => <li key={k} className="flex justify-between"><span>{reasonLabel[k] ?? k}</span><span className="money">{n}</span></li>)}</ul></section>
        <section className="surface-card p-5"><h2 className="font-display text-xl">Sellers &amp; system</h2>
          <ul className="mt-3 space-y-1 text-sm"><li>Verified sellers: {data.users.totalSellers} (+{data.users.new7d} this week)</li><li>Unverified sign-ups: {data.users.unverified} · limited {data.users.limited} · suspended {data.users.suspended}</li>
            <li>Mode: {data.health.paymentMode} · {data.health.environment}</li><li>Email last 24h: {data.health.emailSent24h} sent, {data.health.emailFailed24h} failed</li><li>Last job run: {data.health.lastJobTickAt ? formatLagosDate(data.health.lastJobTickAt) : "never (jobs are not scheduled)"}</li></ul></section>
      </div>
      <section className="surface-card p-5"><h2 className="font-display text-xl">Recent activity</h2><ul className="mt-3 space-y-1 text-sm">{data.recentAudit.map((a) => <li key={a.id}>{formatLagosDate(a.createdAt)} · {a.actor} · {a.action}</li>)}{!data.recentAudit.length ? <li className="text-[var(--ps-grey-600)]">No activity yet.</li> : null}</ul></section>
    </div>
  );
}

function Filters({ children }: { children: React.ReactNode }) { return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>; }

function Disputes() {
  const [status, setStatus] = useState(""); const [reason, setReason] = useState(""); const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const { data, failed, reload } = useAdminQuery<Paged<{ id: string; number: string; status: "open" | "awaiting_response" | "under_review" | "resolved"; reason: string; responseDueAt: string; orderTitle: string; milestoneTitle: string; amountKobo: number; sellerName: string }>>("disputes", { status, reason, q, page });
  return (
    <>
      <Filters>
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{["awaiting_response", "under_review", "resolved"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <select className={inputCls} value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }}><option value="">All reasons</option>{Object.entries(reasonLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className={inputCls} placeholder="Search order or DSP number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </Filters>
      {failed ? <ErrorState retry={reload} /> : !data ? <SkeletonCard /> : !data.items.length ? <EmptyState title="No disputes" description="Nothing matches these filters." /> : (
        <><Table head={["Dispute", "Order", "Seller", "Amount", "Reason", "Status", "Response due"]}>
          {data.items.map((d) => <tr key={d.id}><td><Link className="underline" href={`/admin/disputes/${d.id}`}>{d.number}</Link></td><td>{d.orderTitle}<span className="block text-xs text-[var(--ps-grey-600)]">{d.milestoneTitle}</span></td><td>{d.sellerName}</td><td><Money kobo={d.amountKobo} /></td><td>{reasonLabel[d.reason]}</td><td><StatusBadge status={d.status} /></td><td>{formatLagosDate(d.responseDueAt)}</td></tr>)}
        </Table><Pager {...data} onPage={setPage} /></>
      )}
    </>
  );
}

interface DisputeData {
  id: string; number: string; status: "open" | "awaiting_response" | "under_review" | "resolved"; reason: string; openedBy: string; note: string; responseDueAt: string; openedAt: string;
  outcome: string | null; splitToSellerKobo: number | null; decisionReason: string | null; decidedEarly: boolean; resolvedAt: string | null;
  order: { id: string; title: string; totalKobo: number; status: SellerOrder["status"] }; milestone: { id: string; title: string; amountKobo: number; feeKobo: number; proof: { kind: string; content: string } | null; deliveredAt: string | null };
  seller: { id: string; name: string; email: string; phone: string; trustScore: number | null; trustLevel: string } | null; buyer: { email: string | null; phone: string | null };
  evidence: { id: string; submittedBy: "buyer" | "seller"; type: string; content: string; createdAt: string }[]; timeline: { action: string; actor: string; at: string }[];
}

function DisputeDetail({ id }: { id: string }) {
  const { data, failed, reload } = useAdminQuery<DisputeData>(`disputes/${id}`);
  const dialog = useStatusDialog();
  const [outcome, setOutcome] = useState<DisputeOutcome>("release_to_seller");
  const [split, setSplit] = useState(""); const [reason, setReason] = useState(""); const [early, setEarly] = useState(false); const [busy, setBusy] = useState(false);
  const [nowMs] = useState(() => Date.now());
  if (failed) return <ErrorState retry={reload} />;
  if (!data) return <SkeletonCard />;
  const resolved = data.status === "resolved";
  const windowOpen = Date.parse(data.responseDueAt) > nowMs;
  const splitKobo = Math.round(Number(split || 0) * 100);
  async function decide() {
    const ok = await dialog.confirm({ variant: "warning", title: "Record this decision?", description: "Money moves immediately and this can't be undone. Both sides will see your written reason.", primaryAction: { label: "Decide" }, secondaryAction: { label: "Go back" } });
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi.post(`disputes/${id}/resolve`, { outcome, reason, ...(outcome === "split" ? { splitToSellerKobo: splitKobo } : {}), ...(early ? { decideEarly: true } : {}) });
      toast.success("Decision recorded."); reload();
    } catch (e) { dialog.show({ variant: "danger", title: "We couldn't record that decision.", description: e instanceof Error ? e.message : "Try again.", primaryAction: { label: "Close" } }); }
    finally { setBusy(false); }
  }
  async function review() {
    try { await adminApi.post(`disputes/${id}/start-review`); toast.success("Moved to review."); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
      <div className="space-y-5">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--ps-grey-600)]">{data.number} · opened by {data.openedBy}</p><h2 className="font-display mt-1 text-2xl">{data.order.title}</h2><p className="text-sm text-[var(--ps-grey-600)]">{data.milestone.title} · <Money kobo={data.milestone.amountKobo} /></p></div><StatusBadge status={data.status} /></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--ps-grey-600)]">Reason</dt><dd>{reasonLabel[data.reason]}</dd></div><div><dt className="text-xs text-[var(--ps-grey-600)]">Response due</dt><dd>{formatLagosDate(data.responseDueAt)}</dd></div></dl>
          <p className="mt-4 rounded-xl bg-[var(--ps-grey-200)]/25 p-3 text-sm leading-6">{data.note}</p>
          {data.milestone.proof ? <p className="mt-3 text-sm"><span className="text-xs text-[var(--ps-grey-600)]">Seller&apos;s delivery proof ({data.milestone.proof.kind})</span><br /><span className="break-all">{data.milestone.proof.content}</span></p> : <p className="mt-3 text-sm text-[var(--ps-grey-600)]">No delivery proof was submitted.</p>}
          <p className="mt-3 text-sm">Seller: {data.seller?.name} · {data.seller?.email} · trust {data.seller?.trustScore ?? "new"}<br />Buyer: {data.buyer.email ?? data.buyer.phone ?? "no contact given"}</p>
        </section>
        <section className="surface-card p-5 sm:p-6"><h2 className="font-display text-xl">Evidence</h2>
          {["buyer", "seller"].map((side) => <div key={side} className="mt-4"><p className="text-xs uppercase tracking-wider text-[var(--ps-grey-600)]">{side}</p><ul className="mt-2 space-y-2 text-sm">{data.evidence.filter((e) => e.submittedBy === side).map((e) => <li key={e.id} className="rounded-xl bg-[var(--ps-grey-200)]/25 p-3">{e.type === "link" ? <a className="break-all underline" href={e.content} target="_blank" rel="noopener noreferrer">{e.content}</a> : <span className="whitespace-pre-wrap">{e.content}</span>}<span className="block text-xs text-[var(--ps-grey-600)]">{formatLagosDate(e.createdAt)}</span></li>)}{!data.evidence.some((e) => e.submittedBy === side) ? <li className="text-[var(--ps-grey-600)]">Nothing submitted.</li> : null}</ul></div>)}
        </section>
        <section className="surface-card p-5 sm:p-6"><h2 className="font-display text-xl">Timeline</h2><ul className="mt-3 space-y-1 text-sm">{data.timeline.map((t, i) => <li key={i}>{formatLagosDate(t.at)} · {t.actor} · {t.action}</li>)}</ul></section>
      </div>
      <aside className="surface-card h-fit p-5 sm:p-6">
        <h2 className="font-display text-xl">Decision</h2>
        {resolved ? <div className="mt-3 space-y-2 text-sm"><p>Outcome: <strong>{data.outcome?.replaceAll("_", " ")}</strong>{data.splitToSellerKobo ? <> · seller share <Money kobo={data.splitToSellerKobo} /></> : null}</p><p>Reason: {data.decisionReason}</p><p className="text-[var(--ps-grey-600)]">{data.resolvedAt ? formatLagosDate(data.resolvedAt) : ""}{data.decidedEarly ? " · decided early" : ""}</p></div> : (
          <div className="mt-3 space-y-3 text-sm">
            {data.status === "awaiting_response" ? <button className={btn} onClick={() => void review()}>Start review</button> : null}
            {(["release_to_seller", "refund_to_buyer", "split"] as const).map((o) => <label key={o} className="flex min-h-11 items-center gap-2"><input type="radio" name="outcome" checked={outcome === o} onChange={() => setOutcome(o)} />{o === "release_to_seller" ? "Release to seller" : o === "refund_to_buyer" ? "Refund to buyer" : "Split"}</label>)}
            {outcome === "split" ? <label className="block">Seller&apos;s share (₦, of <Money kobo={data.milestone.amountKobo} />)<input className={`${inputCls} mt-1 w-full`} inputMode="decimal" value={split} onChange={(e) => setSplit(e.target.value)} />{splitKobo > 0 && splitKobo < data.milestone.amountKobo ? <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">Buyer is refunded <Money kobo={data.milestone.amountKobo - splitKobo} />.</span> : null}</label> : null}
            <label className="block">Written reason (both sides will read this)<textarea className="mt-1 w-full rounded-xl border border-[var(--ps-grey-200)] p-3" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            {windowOpen ? <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={early} onChange={(e) => setEarly(e.target.checked)} className="mt-1" />The response window is still open until {formatLagosDate(data.responseDueAt)}. Decide early and record that in the audit log.</label> : null}
            <button className={`${btnPrimary} w-full`} disabled={busy || reason.trim().length < 10 || (windowOpen && !early) || (outcome === "split" && !(splitKobo > 0 && splitKobo < data.milestone.amountKobo))} onClick={() => void decide()}>{busy ? "Recording…" : "Record decision"}</button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Orders() {
  const [status, setStatus] = useState(""); const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const { data, failed, reload } = useAdminQuery<Paged<SellerOrder & { sellerId: string }>>("orders", { status, q, page });
  return (
    <>
      <Filters>
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{["draft", "awaiting_payment", "funded", "completed", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <input className={inputCls} placeholder="Search title, id, token or seller" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </Filters>
      {failed ? <ErrorState retry={reload} /> : !data ? <SkeletonCard /> : !data.items.length ? <EmptyState title="No orders" description="Nothing matches these filters." /> : (
        <><Table head={["Order", "Seller", "Total", "Funded", "Status", "Created"]}>{data.items.map((o) => <tr key={o.id}><td><Link className="underline" href={`/admin/orders/${o.id}`}>{o.title}</Link><span className="block text-xs text-[var(--ps-grey-600)]">{short(o.id)}{o.needsRefundFlag ? " · refund needed" : ""}</span></td><td>{o.seller.name}</td><td><Money kobo={o.totalKobo} /></td><td><Money kobo={o.amountFundedKobo} /></td><td><StatusBadge status={o.status} /></td><td>{formatLagosDate(o.createdAt)}</td></tr>)}</Table><Pager {...data} onPage={setPage} /></>
      )}
    </>
  );
}

interface AdminOrderData {
  order: SellerOrder; seller: { id: string; name: string; email: string; phone: string } | null; heldKobo: number;
  payments: { id: string; provider: string; reference: string; amountKobo: number; status: string; receivedAt: string }[];
  ledger: { id: string; type: string; amountKobo: number; reference: string; createdAt: string }[];
  payouts: { id: string; kind: string; amountKobo: number; status: "queued" | "processing" | "paid" | "failed"; attempts: number; lastError: string | null }[];
  receipts: { number: string; token: string; type: string; amountKobo: number; issuedAt: string }[];
  audit: { id: string; actor: string; action: string; createdAt: string }[];
}

function OrderDetail({ id }: { id: string }) {
  const { data, failed, reload } = useAdminQuery<AdminOrderData>(`orders/${id}`);
  const dialog = useStatusDialog();
  if (failed) return <ErrorState retry={reload} />;
  if (!data) return <SkeletonCard />;
  const o = data.order;
  async function act(path: string, body: unknown, ok: string) {
    try { await adminApi.post(path, body); toast.success(ok); reload(); } catch (e) { dialog.show({ variant: "danger", title: "That didn't work.", description: e instanceof Error ? e.message : "Try again.", primaryAction: { label: "Close" } }); }
  }
  return (
    <div className="space-y-5">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--ps-grey-600)]">{o.id}</p><h2 className="font-display mt-1 text-2xl">{o.title}</h2><p className="text-sm text-[var(--ps-grey-600)]">Seller: {data.seller?.name} · {data.seller?.email} · Buyer: {o.buyerContact?.email ?? o.buyerContact?.phone ?? "no contact"}</p></div><StatusBadge status={o.status} /></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-xs text-[var(--ps-grey-600)]">Total</dt><dd><Money kobo={o.totalKobo} /></dd></div><div><dt className="text-xs text-[var(--ps-grey-600)]">Funded</dt><dd><Money kobo={o.amountFundedKobo} /></dd></div><div><dt className="text-xs text-[var(--ps-grey-600)]">Held now</dt><dd><Money kobo={data.heldKobo} /></dd></div><div><dt className="text-xs text-[var(--ps-grey-600)]">Fee</dt><dd><Money kobo={o.feeKobo} /></dd></div></dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {o.status === "awaiting_payment" ? <button className={btn} onClick={() => void act(`orders/${id}/simulate-payment`, {}, "Sandbox payment recorded.")}>Simulate full payment (sandbox)</button> : null}
          {o.status === "awaiting_payment" ? <button className={btn} onClick={() => { const v = window.prompt("Partial amount in naira"); if (v) void act(`orders/${id}/simulate-payment`, { amountKobo: Math.round(Number(v) * 100) }, "Sandbox payment recorded."); }}>Simulate partial payment</button> : null}
          {o.needsRefundFlag ? <button className={btnPrimary} onClick={() => void act(`orders/${id}/refund-unallocated`, {}, "Refund queued.")}>Refund unallocated funds</button> : null}
          <Link className={`${btn} inline-flex items-center`} href={`/pay/${o.token}`} target="_blank">Open buyer page</Link>
        </div>
      </section>
      <section><h2 className="font-display mb-2 text-xl">Milestones</h2><Table head={["#", "Title", "Amount", "Fee", "Status", "Payout"]}>{o.milestones.map((m) => <tr key={m.id}><td>{m.position}</td><td>{m.title}</td><td><Money kobo={m.amountKobo} /></td><td><Money kobo={m.feeKobo} /></td><td><StatusBadge status={m.status} /></td><td>{m.payoutStatus ?? "-"}</td></tr>)}</Table></section>
      <section><h2 className="font-display mb-2 text-xl">Ledger</h2><Table head={["Type", "Amount", "Reference", "When"]}>{data.ledger.map((l) => <tr key={l.id}><td className="capitalize">{l.type}</td><td><Money kobo={l.amountKobo} /></td><td className="font-mono text-xs">{l.reference}</td><td>{formatLagosDate(l.createdAt)}</td></tr>)}{!data.ledger.length ? <tr><td colSpan={4} className="text-[var(--ps-grey-600)]">No entries yet.</td></tr> : null}</Table></section>
      <section><h2 className="font-display mb-2 text-xl">Payments &amp; payouts</h2><Table head={["Kind", "Amount", "Status", "Detail"]}>{data.payments.map((p) => <tr key={p.id}><td>Payment in ({p.provider})</td><td><Money kobo={p.amountKobo} /></td><td>{p.status}</td><td className="font-mono text-xs">{p.reference}</td></tr>)}{data.payouts.map((p) => <tr key={p.id}><td>{p.kind.replace("_", " ")}</td><td><Money kobo={p.amountKobo} /></td><td><StatusBadge status={p.status} /></td><td className="text-xs">{p.attempts} attempt(s){p.lastError ? ` · ${p.lastError}` : ""}</td></tr>)}</Table></section>
      <section className="surface-card p-5"><h2 className="font-display text-xl">Receipts &amp; audit</h2><ul className="mt-3 space-y-1 text-sm">{data.receipts.map((r) => <li key={r.token}><a className="underline" href={`/r/${r.token}`} target="_blank" rel="noopener noreferrer">{r.number}</a> · {r.type} · <Money kobo={r.amountKobo} /></li>)}{data.audit.map((a) => <li key={a.id} className="text-[var(--ps-grey-600)]">{formatLagosDate(a.createdAt)} · {a.actor} · {a.action}</li>)}</ul></section>
    </div>
  );
}

function Ledger() {
  const [type, setType] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [page, setPage] = useState(1);
  const { data, failed, reload } = useAdminQuery<Paged<{ id: string; orderId: string; orderTitle: string; type: string; amountKobo: number; reference: string; createdAt: string }> & { heldKobo: number }>("ledger", { type, from, to, page });
  const qs = new URLSearchParams(Object.entries({ type, from, to }).filter(([, v]) => v)).toString();
  return (
    <>
      <Filters>
        <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All types</option>{["funding", "release", "fee", "refund"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <input type="date" className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From" />
        <input type="date" className={inputCls} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To" />
        <a className={`${btn} inline-flex items-center`} href={`/api/admin/ledger/export.csv${qs ? `?${qs}` : ""}`}>Export CSV</a>
      </Filters>
      {failed ? <ErrorState retry={reload} /> : !data ? <SkeletonCard /> : (
        <><p className="mb-3 text-sm">Total held across all orders: <strong><Money kobo={data.heldKobo} /></strong></p>
          {!data.items.length ? <EmptyState title="No ledger entries" description="Entries appear when money moves." /> : <><Table head={["When", "Type", "Amount", "Order", "Reference"]}>{data.items.map((l) => <tr key={l.id}><td>{formatLagosDate(l.createdAt)}</td><td className="capitalize">{l.type}</td><td><Money kobo={l.amountKobo} /></td><td><Link className="underline" href={`/admin/orders/${l.orderId}`}>{l.orderTitle}</Link></td><td className="font-mono text-xs">{l.reference}</td></tr>)}</Table><Pager {...data} onPage={setPage} /></>}</>
      )}
    </>
  );
}

function Payouts() {
  const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const { data, failed, reload } = useAdminQuery<Paged<{ id: string; orderId: string; orderTitle: string; kind: string; amountKobo: number; status: "queued" | "processing" | "paid" | "failed"; attempts: number; lastError: string | null; updatedAt: string }>>("payouts", { status, page });
  async function retry(id: string) { try { await adminApi.post(`payouts/${id}/retry`, {}); toast.success("Retry attempted."); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Retry failed."); } }
  return (
    <>
      <Filters><select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{["queued", "processing", "paid", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}</select></Filters>
      {failed ? <ErrorState retry={reload} /> : !data ? <SkeletonCard /> : !data.items.length ? <EmptyState title="No payouts" description="Payouts appear when money is released or refunded." /> : (
        <><Table head={["Order", "Kind", "Amount", "Status", "Attempts", "Updated", ""]}>{data.items.map((p) => <tr key={p.id}><td><Link className="underline" href={`/admin/orders/${p.orderId}`}>{p.orderTitle}</Link></td><td>{p.kind.replace("_", " ")}</td><td><Money kobo={p.amountKobo} /></td><td><StatusBadge status={p.status} />{p.lastError ? <span className="block text-xs text-[var(--ps-danger)]">{p.lastError}</span> : null}</td><td>{p.attempts}</td><td>{formatLagosDate(p.updatedAt)}</td><td>{p.status === "failed" ? <button className={btn} onClick={() => void retry(p.id)}>Retry</button> : null}</td></tr>)}</Table><Pager {...data} onPage={setPage} /></>
      )}
    </>
  );
}

function Sellers() {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [editing, setEditing] = useState<string | null>(null);
  const [next, setNext] = useState("limited"); const [why, setWhy] = useState("");
  const { data, failed, reload } = useAdminQuery<Paged<{ id: string; name: string; email: string; businessName: string | null; status: string; statusReason: string | null; trustScore: number | null; trustLevel: string; orderCount: number; disputeCount: number; totalReleasedKobo: number }>>("sellers", { q, page });
  async function save(id: string) {
    try { await adminApi.post(`sellers/${id}/status`, { status: next, reason: why }); toast.success("Status updated."); setEditing(null); setWhy(""); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
  }
  return (
    <>
      <Filters><input className={inputCls} placeholder="Search name, email or business" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></Filters>
      {failed ? <ErrorState retry={reload} /> : !data ? <SkeletonCard /> : !data.items.length ? <EmptyState title="No sellers" description="Verified sellers appear here." /> : (
        <><Table head={["Seller", "Status", "Trust", "Orders", "Disputes", "Released", ""]}>{data.items.map((s) => <tr key={s.id}><td>{s.businessName ?? s.name}<span className="block text-xs text-[var(--ps-grey-600)]">{s.email}</span></td><td className="capitalize">{s.status}{s.statusReason ? <span className="block text-xs text-[var(--ps-grey-600)]">{s.statusReason}</span> : null}</td><td>{s.trustScore ?? "New"}</td><td>{s.orderCount}</td><td>{s.disputeCount}</td><td><Money kobo={s.totalReleasedKobo} /></td>
          <td>{editing === s.id ? <div className="flex min-w-56 flex-col gap-2"><select className={inputCls} value={next} onChange={(e) => setNext(e.target.value)}>{["active", "limited", "suspended"].filter((x) => x !== s.status).map((x) => <option key={x}>{x}</option>)}</select><input className={inputCls} placeholder="Reason (required)" value={why} onChange={(e) => setWhy(e.target.value)} /><span className="flex gap-2"><button className={btnPrimary} disabled={why.trim().length < 5} onClick={() => void save(s.id)}>Save</button><button className={btn} onClick={() => setEditing(null)}>Cancel</button></span></div> : <button className={btn} onClick={() => { setEditing(s.id); setNext(s.status === "active" ? "limited" : "active"); }}>Change status</button>}</td></tr>)}</Table><Pager {...data} onPage={setPage} /></>
      )}
    </>
  );
}

function Reconciliation() {
  const { data, failed, reload } = useAdminQuery<{ ok: boolean; issueCount: number; note: string; generatedAt: string; checks: { key: string; label: string; pass: boolean; offending: string[] }[] }>("reconciliation");
  if (failed) return <ErrorState retry={reload} />;
  if (!data) return <SkeletonCard />;
  return (
    <div className="space-y-4">
      <p className={`rounded-2xl p-4 text-sm ${data.ok ? "bg-[var(--ps-green-400)]/20" : "bg-[var(--ps-warning)]/20"}`}>{data.ok ? "All checks pass." : `${data.issueCount} item(s) need review.`} {data.note} <button className="ml-2 underline" onClick={reload}>Re-run</button></p>
      {data.checks.map((c) => <section key={c.key} className="surface-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-base">{c.label}</h2><span className={`rounded-full px-3 py-1 text-xs ${c.pass ? "bg-[var(--ps-green-400)]" : "bg-[var(--ps-danger)]/10 text-[var(--ps-danger)]"}`}>{c.pass ? "Pass" : `${c.offending.length} found`}</span></div>
        {c.offending.length ? <ul className="mt-3 space-y-1 text-sm">{c.offending.slice(0, 20).map((id) => <li key={id} className="font-mono text-xs">{c.key === "refund_flags" || c.key !== "released_matches_ledger" && c.key !== "released_has_payout" ? <Link className="underline" href={`/admin/orders/${id}`}>{id}</Link> : id}</li>)}</ul> : null}</section>)}
    </div>
  );
}

function AuditLog() {
  const [actor, setActor] = useState(""); const [action, setAction] = useState(""); const [target, setTarget] = useState(""); const [page, setPage] = useState(1);
  const { data, failed, reload } = useAdminQuery<Paged<{ id: string; actor: string; actorType: string; action: string; target: string; before: unknown; after: unknown; createdAt: string }>>("audit-log", { actor, action, target, page });
  return (
    <>
      <Filters>
        <input className={inputCls} placeholder="Actor" value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} />
        <input className={inputCls} placeholder="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        <input className={inputCls} placeholder="Target id" value={target} onChange={(e) => { setTarget(e.target.value); setPage(1); }} />
      </Filters>
      {failed ? <ErrorState retry={reload} /> : !data ? <SkeletonCard /> : !data.items.length ? <EmptyState title="No audit entries" description="Nothing matches these filters." /> : (
        <><Table head={["When", "Actor", "Action", "Target", "Change"]}>{data.items.map((a) => <tr key={a.id}><td>{formatLagosDate(a.createdAt)}</td><td>{a.actor}</td><td>{a.action}</td><td className="font-mono text-xs">{a.target.slice(0, 13)}</td><td>{a.before || a.after ? <details><summary className="cursor-pointer text-xs underline">View</summary><pre className="mt-1 max-w-xs overflow-x-auto text-[10px]">{JSON.stringify({ before: a.before, after: a.after }, null, 1)}</pre></details> : "-"}</td></tr>)}</Table><Pager {...data} onPage={setPage} /></>
      )}
    </>
  );
}

function Settings() {
  const { data, failed, reload } = useAdminQuery<{ settings: Record<string, number>; feeTiers: { thresholdKobo: number; lowerRate: number; higherRate: number } }>("settings");
  if (failed) return <ErrorState retry={reload} />;
  if (!data) return <SkeletonCard />;
  return <SettingsForm data={data} reload={reload} />;
}

function SettingsForm({ data, reload }: { data: { settings: Record<string, number>; feeTiers: { thresholdKobo: number; lowerRate: number; higherRate: number } }; reload: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, String(v)])));
  const [busy, setBusy] = useState(false);
  const labels: Record<string, string> = { review_window_hours: "Default review window (hours, 24 to 336)", unpaid_expiry_hours: "Unpaid order expiry (hours, 1 to 168)", dispute_response_hours: "Dispute response time (hours, 24 to 120)" };
  async function save() {
    setBusy(true);
    try { await adminApi.put("settings", Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)]))); toast.success("Settings saved."); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save."); } finally { setBusy(false); }
  }
  return (
    <section className="surface-card max-w-xl p-5 sm:p-7">
      {Object.keys(labels).map((k) => <label key={k} className="mt-4 block text-sm first:mt-0">{labels[k]}<input className={`${inputCls} mt-1 w-full`} inputMode="numeric" value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>)}
      <button className={`${btnPrimary} mt-5`} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save settings"}</button>
      <p className="mt-5 text-xs text-[var(--ps-grey-600)]">Fee tiers are fixed in code: {data.feeTiers.lowerRate * 100}% up to <Money kobo={data.feeTiers.thresholdKobo} />, then {data.feeTiers.higherRate * 100}%. Changes apply to new orders only.</p>
    </section>
  );
}
