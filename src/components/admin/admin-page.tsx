"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Search } from "lucide-react";
import { toast } from "sonner";
import { ApiPlaceholder } from "@/components/feedback/api-placeholder";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/feedback/states";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { Countdown, useCurrentTime } from "@/components/ui/countdown";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminData, resolveDispute, retryPayout } from "@/lib/api";
import { formatLagosDate } from "@/lib/format/dates";
import { formatNaira } from "@/lib/format/money";
import type { AppStore, DisputeOutcome, Order } from "@/lib/domain/types";

export type AdminPageName = "overview" | "disputes" | "dispute-detail" | "orders" | "order-detail" | "ledger" | "payouts" | "sellers" | "reconciliation" | "audit-log" | "settings";

const EMPTY: AppStore = { orders: [], disputes: [], ledger: [], payouts: [], receipts: [], auditLog: [], notifications: [] };
const titles: Record<AdminPageName, string> = { overview: "Operations overview", disputes: "Disputes", "dispute-detail": "Dispute review", orders: "Orders", "order-detail": "Order record", ledger: "Ledger", payouts: "Payouts", sellers: "Sellers", reconciliation: "Reconciliation", "audit-log": "Audit log", settings: "Platform settings" };

export function AdminPage({ page, recordId }: { page: AdminPageName; recordId?: string }) {
  const [store, setStore] = useState<AppStore | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [outcome, setOutcome] = useState<DisputeOutcome>("release_to_seller");
  const [reason, setReason] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [fastForward, setFastForward] = useState(false);
  const [settings, setSettings] = useState({ review: "72", expiry: "48", response: "48" });
  const router = useRouter();
  const now = useCurrentTime(60_000);
  const dialog = useStatusDialog();
  const load = useCallback(() => {
    try { setStore(getAdminData()); setFailed(false); }
    catch (error) { console.error("Could not load admin demo data", error); setFailed(true); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const disputes = store?.disputes ?? EMPTY.disputes;
  const orders = store?.orders ?? EMPTY.orders;
  const ledger = store?.ledger ?? EMPTY.ledger;
  const payouts = store?.payouts ?? EMPTY.payouts;
  const searchFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return disputes.filter((item) => {
      const order = orders.find((row) => row.id === item.orderId);
      return (!query || `${item.id} ${order?.title ?? ""} ${order?.seller.name ?? ""} ${item.reason}`.toLowerCase().includes(query)) && (filter === "all" || item.status === filter || item.reason === filter);
    });
  }, [disputes, orders, search, filter]);
  const dispute = disputes.find((item) => item.id === recordId);
  const disputeOrder = dispute && orders.find((item) => item.id === dispute.orderId);
  const selectedOrder = orders.find((item) => item.id === recordId);
  const responseOpen = Boolean(dispute && (!now || Date.parse(dispute.responseDueAt) > now) && !fastForward);

  async function submitDecision() {
    if (!dispute || !reason.trim()) return;
    const confirmed = await dialog.confirm({ variant: "warning", title: "Submit this dispute decision?", description: "The outcome and written reason will be visible to the buyer and seller.", primaryAction: { label: "Submit decision" }, secondaryAction: { label: "Review again" } });
    if (!confirmed) return;
    try {
      await resolveDispute(dispute.id, { outcome, reason: reason.trim(), ...(outcome === "split" ? { splitToSellerKobo: Math.round(Number(splitAmount || 0) * 100) } : {}) });
      load();
      dialog.show({ variant: "success", title: "Dispute resolved.", description: "The decision has been recorded in the ledger and audit log.", primaryAction: { label: "Back to disputes", onClick: () => router.push("/admin/disputes") } });
    } catch (error) {
      dialog.show({ variant: "danger", title: "We couldn't resolve this dispute.", description: error instanceof Error ? error.message : "Try again." });
    }
  }

  async function retry(id: string) {
    const confirmed = await dialog.confirm({ variant: "warning", title: "Retry this payout?", description: "Retries are safe. A seller is never paid twice.", primaryAction: { label: "Retry payout" }, secondaryAction: { label: "Cancel" } });
    if (!confirmed) return;
    try { await retryPayout(id); load(); dialog.show({ variant: "success", title: "Payout queued for retry.", description: "The payout status is now processing." }); }
    catch (error) { dialog.show({ variant: "danger", title: "Payout retry failed.", description: error instanceof Error ? error.message : "Try again." }); }
  }

  if (failed) return <ErrorState retry={load} />;
  if (!store) return <SkeletonCard />;
  const heading = page === "dispute-detail" ? `${dispute?.id ?? "Dispute"} · Review` : page === "order-detail" && selectedOrder ? selectedOrder.title : titles[page];
  const headingNode = <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.12em] text-[var(--ps-grey-600)]">Administration · Sandbox</p><h1 className="font-display mt-2 text-3xl sm:text-4xl">{heading}</h1></div><span className="rounded-full bg-[var(--ps-warning)]/20 px-3 py-1.5 text-xs">Mock data</span></div>;

  if (page === "overview") return <>{headingNode}<Overview store={store} /><ApiPlaceholder endpoint="GET /api/admin/overview" /></>;
  if (page === "disputes") return <>{headingNode}<DisputeList disputes={searchFiltered} orders={orders} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} /></>;
  if (page === "dispute-detail") return <>{headingNode}{dispute && disputeOrder ? <DisputeReview dispute={dispute} order={disputeOrder} outcome={outcome} setOutcome={setOutcome} reason={reason} setReason={setReason} splitAmount={splitAmount} setSplitAmount={setSplitAmount} disabled={responseOpen} fastForward={fastForward} setFastForward={setFastForward} onSubmit={() => void submitDecision()} /> : <EmptyState title="Dispute not found" description="This record is not in the demo data." action={<Link href="/admin/disputes" className="underline">Back to disputes</Link>} />}</>;
  if (page === "orders") return <>{headingNode}<AdminOrders orders={orders} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} /></>;
  if (page === "order-detail") return <>{headingNode}{selectedOrder ? <AdminOrderDetail order={selectedOrder} store={store} /> : <EmptyState title="Order not found" description="This record is not in the demo data." />}</>;
  if (page === "ledger") return <>{headingNode}<Ledger ledger={ledger} orders={orders} /></>;
  if (page === "payouts") return <>{headingNode}<Payouts payouts={payouts} orders={orders} onRetry={(id) => void retry(id)} /></>;
  if (page === "sellers") return <>{headingNode}<Sellers store={store} /></>;
  if (page === "reconciliation") return <>{headingNode}<Reconciliation store={store} /></>;
  if (page === "audit-log") return <>{headingNode}<AuditLog store={store} search={search} setSearch={setSearch} /></>;
  return <>{headingNode}<AdminSettings settings={settings} setSettings={setSettings} onSave={() => dialog.confirm({ variant: "warning", title: "Save platform settings?", description: "This changes the demo configuration only.", primaryAction: { label: "Save settings" }, secondaryAction: { label: "Cancel" } }).then((ok) => { if (ok) toast.success("Settings saved in this demo."); })} /></>;
}

function Overview({ store }: { store: AppStore }) {
  const held = store.orders.filter((order) => order.status === "funded").reduce((sum, order) => sum + order.milestones.filter((item) => !["released", "refunded"].includes(item.status)).reduce((acc, item) => acc + item.amountKobo, 0), 0);
  const open = store.disputes.filter((item) => item.status !== "resolved");
  const pendingPayouts = store.payouts.filter((item) => ["queued", "processing"].includes(item.status)).length;
  const failedPayouts = store.payouts.filter((item) => item.status === "failed").length;
  return <div className="space-y-6"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[["Total held", formatNaira(held)], ["Funded today", String(store.orders.filter((item) => item.status === "funded").length)], ["Open disputes", String(open.length)], ["Payouts pending", String(pendingPayouts)], ["Failed payouts", String(failedPayouts)], ["Reconciliation", "Matched"]].map(([label, value]) => <article key={label} className="surface-card p-5"><p className="text-sm text-[var(--ps-grey-600)]">{label}</p><p className="money mt-3 text-2xl">{value}</p></article>)}</section><div className="grid gap-5 xl:grid-cols-2"><section className="rounded-3xl bg-[var(--ps-green-900)] p-6 text-white"><h2 className="font-display text-xl">Payment volume · 14 days</h2><div className="mt-6 flex h-36 items-end gap-2">{[38, 48, 34, 62, 58, 76, 52, 69, 47, 86, 59, 72, 64, 93].map((v, i) => <span key={i} className="flex-1 rounded-t-md bg-[var(--ps-green-400)]" style={{ height: `${v}%` }} />)}</div><p className="mt-3 text-xs text-white/60">Illustrative demo visualization.</p></section><section className="surface-card p-6"><h2 className="font-display text-xl">Disputes by reason</h2><div className="mt-5 space-y-3">{["not_delivered", "not_as_described", "delivered_late", "other"].map((reason) => { const count = store.disputes.filter((item) => item.reason === reason).length; return <div key={reason}><div className="flex justify-between text-sm"><span>{reason.replaceAll("_", " ")}</span><span>{count}</span></div><div className="mt-1 h-2 rounded-full bg-[var(--ps-grey-200)]"><span className="block h-full rounded-full bg-[var(--ps-green-900)]" style={{ width: `${count ? Math.max(12, count * 30) : 0}%` }} /></div></div>; })}</div></section></div><section className="surface-card p-5"><h2 className="font-display text-xl">Disputes needing a decision</h2>{open.length ? open.map((item) => { const order = store.orders.find((row) => row.id === item.orderId); return <Link key={item.id} href={`/admin/disputes/${item.id}`} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--ps-grey-200)]/25 p-4"><span><span className="block text-sm">{item.id} · {order?.title}</span><span className="mt-1 block text-xs text-[var(--ps-grey-600)]">{item.reason.replaceAll("_", " ")}</span></span><span className="inline-flex items-center gap-2 text-xs"><Countdown target={item.responseDueAt} /><ArrowRight size={16} /></span></Link>; }) : <p className="mt-3 text-sm text-[var(--ps-grey-600)]">No open disputes.</p>}</section><section className="surface-card p-5"><h2 className="font-display text-xl">Recent audit activity</h2>{store.auditLog.slice(0, 4).map((item) => <p key={item.id} className="mt-3 text-sm">{item.actor} · {item.action} <span className="text-xs text-[var(--ps-grey-600)]">{formatLagosDate(item.createdAt)}</span></p>)}</section></div>;
}

function DisputeList({ disputes, orders, search, setSearch, filter, setFilter }: { disputes: AppStore["disputes"]; orders: Order[]; search: string; setSearch: (v: string) => void; filter: string; setFilter: (v: string) => void }) {
  return <div className="space-y-4"><div className="surface-card flex flex-col gap-3 p-4 sm:flex-row"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border px-3"><Search size={16} /><span className="sr-only">Search disputes</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dispute, seller or order" className="w-full bg-transparent text-sm outline-none" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border px-3 text-sm" aria-label="Filter disputes"><option value="all">All states and reasons</option>{["awaiting_response", "under_review", "resolved", "not_delivered", "not_as_described", "delivered_late", "other"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></div><section className="surface-card overflow-x-auto p-4"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b text-xs text-[var(--ps-grey-600)]">{["Dispute", "Order / milestone", "Reason", "Amount", "Status", "Response due"].map((item) => <th key={item} className="p-3 font-medium">{item}</th>)}</tr></thead><tbody>{disputes.map((item) => { const order = orders.find((row) => row.id === item.orderId); const milestone = order?.milestones.find((row) => row.id === item.milestoneId); return <tr key={item.id} className="border-b last:border-0"><td className="p-3"><Link className="underline" href={`/admin/disputes/${item.id}`}>{item.id}</Link></td><td className="p-3">{order?.title}<span className="block text-xs text-[var(--ps-grey-600)]">{milestone?.title}</span></td><td className="p-3 capitalize">{item.reason.replaceAll("_", " ")}</td><td className="money p-3"><Money kobo={milestone?.amountKobo ?? 0} /></td><td className="p-3"><StatusBadge status={item.status} /></td><td className="p-3"><Countdown target={item.responseDueAt} /></td></tr>; })}</tbody></table>{!disputes.length ? <EmptyState title="No disputes found" description="Try changing your filters." /> : null}</section><ApiPlaceholder endpoint="GET /api/admin/disputes" /></div>;
}

function DisputeReview({ dispute, order, outcome, setOutcome, reason, setReason, splitAmount, setSplitAmount, disabled, fastForward, setFastForward, onSubmit }: { dispute: AppStore["disputes"][number]; order: Order; outcome: DisputeOutcome; setOutcome: (v: DisputeOutcome) => void; reason: string; setReason: (v: string) => void; splitAmount: string; setSplitAmount: (v: string) => void; disabled: boolean; fastForward: boolean; setFastForward: (v: boolean) => void; onSubmit: () => void }) {
  const milestone = order.milestones.find((item) => item.id === dispute.milestoneId);
  return <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr_0.9fr]"><section className="surface-card p-5"><h2 className="font-display text-xl">Order record</h2><p className="mt-4 text-sm">{order.title}</p><p className="mt-2 text-xs text-[var(--ps-grey-600)]">{order.id} · {milestone?.title}</p><p className="money mt-3 text-2xl"><Money kobo={milestone?.amountKobo ?? 0} /></p><p className="mt-4 text-xs text-[var(--ps-grey-600)]">Opened {formatLagosDate(dispute.openedAt)}</p><p className="mt-2 text-xs text-[var(--ps-grey-600)]">Response due {formatLagosDate(dispute.responseDueAt)}</p><ol className="mt-5 space-y-3 border-l pl-4 text-sm"><li>Dispute opened</li><li>Seller response window</li><li>PaySafr review</li><li>Decision recorded</li></ol></section><section className="space-y-4"><article className="surface-card p-5"><h2 className="font-display text-xl">Buyer evidence</h2><p className="mt-2 text-sm leading-6">{dispute.note}</p><p className="mt-2 text-xs text-[var(--ps-grey-600)]">Submitted {formatLagosDate(dispute.openedAt)}</p></article><article className="surface-card p-5"><h2 className="font-display text-xl">Evidence items</h2>{dispute.evidence.length ? dispute.evidence.map((item) => <div key={item.id} className="mt-3 rounded-xl bg-[var(--ps-grey-200)]/30 p-3"><p className="text-xs capitalize">{item.submittedBy} · {item.type} · {formatLagosDate(item.createdAt)}</p>{item.type === "link" && /^https?:\/\//i.test(item.content) ? <a href={item.content} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm underline">{item.content}</a> : <p className="mt-2 text-sm">{item.content}</p>}</div>) : <p className="mt-3 text-sm text-[var(--ps-grey-600)]">No additional evidence attached.</p>}</article><ApiPlaceholder endpoint="GET /api/admin/disputes/:id" /></section><section className="surface-card h-fit p-5"><h2 className="font-display text-xl">Decision</h2>{disabled ? <div className="mt-3 rounded-xl bg-[var(--ps-warning)]/20 p-3 text-sm"><Clock3 className="mr-1 inline" size={16} />Response period is still open. Wait until it ends before deciding.<button type="button" onClick={() => setFastForward(!fastForward)} className="mt-2 block min-h-10 text-xs underline">Demo control: {fastForward ? "restore response timer" : "fast-forward 48 hours"}</button></div> : null}<div className="mt-4 space-y-2">{[["release_to_seller", "Release to seller"], ["refund_to_buyer", "Refund to buyer"], ["split", "Split the funds"]].map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${outcome === value ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : ""}`}><input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value as DisputeOutcome)} />{label}</label>)}</div>{outcome === "split" ? <label className="mt-4 block text-sm">Seller share (₦)<input type="number" min="0" max={(milestone?.amountKobo ?? 0) / 100} value={splitAmount} onChange={(event) => setSplitAmount(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3" /><span className="mt-1 block text-xs text-[var(--ps-grey-600)]">Buyer refund: {formatNaira(Math.max(0, (milestone?.amountKobo ?? 0) - Math.round(Number(splitAmount || 0) * 100)))}</span></label> : null}<label className="mt-4 block text-sm">Written reason, visible to both sides<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border p-3" /></label><div className="mt-4 rounded-xl bg-[var(--ps-grey-200)]/25 p-3 text-xs"><p className="font-semibold">Ledger preview</p><p className="mt-1">{outcome === "refund_to_buyer" ? "Refund buyer" : outcome === "split" ? "Release seller share and refund the balance" : "Release funds to seller"} · {formatNaira(milestone?.amountKobo ?? 0)}</p><p className="mt-1 text-[var(--ps-grey-600)]">A new append-only entry will be recorded.</p></div><button type="button" disabled={disabled || !reason.trim()} onClick={onSubmit} className="mt-4 min-h-11 w-full rounded-full bg-[var(--ps-green-400)] disabled:opacity-45">Submit decision</button><p className="mt-3 text-xs text-[var(--ps-grey-600)]">The outcome and written reason can be seen by the buyer and seller.</p></section></div>;
}

function AdminOrders({ orders, search, setSearch, filter, setFilter }: { orders: Order[]; search: string; setSearch: (v: string) => void; filter: string; setFilter: (v: string) => void }) {
  const rows = orders.filter((order) => (!search || `${order.id} ${order.title} ${order.seller.name}`.toLowerCase().includes(search.toLowerCase())) && (filter === "all" || order.status === filter));
  return <div className="space-y-4"><div className="surface-card flex gap-3 p-4"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border px-3"><Search size={16} /><span className="sr-only">Search orders</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search id, title or seller" className="w-full bg-transparent text-sm outline-none" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border px-3 text-sm" aria-label="Order status"><option value="all">All status</option>{["awaiting_payment", "funded", "completed", "expired", "cancelled"].map((item) => <option key={item}>{item}</option>)}</select></div><section className="surface-card p-5"><div className="space-y-3">{rows.map((order) => <div key={order.id} className="grid gap-2 border-b pb-3 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><Link href={`/admin/orders/${order.id}`} className="text-sm underline">{order.title}</Link><p className="mt-1 text-xs text-[var(--ps-grey-600)]">{order.id} · {order.seller.name}</p></div><Money kobo={order.totalKobo} /><StatusBadge status={order.status} /></div>)}</div></section></div>;
}

function AdminOrderDetail({ order, store }: { order: Order; store: AppStore }) {
  const ledgerRows = store.ledger.filter((item) => item.orderId === order.id);
  const payoutRows = store.payouts.filter((item) => item.orderId === order.id);
  const receiptRows = store.receipts.filter((item) => item.orderId === order.id);

  return <div className="space-y-5"><section className="surface-card p-5"><h2 className="font-display text-xl">{order.title}</h2><p className="mt-2 text-sm">{order.id} · {order.seller.name} · {order.buyerContact?.email ?? "Guest buyer"}</p><div className="mt-4 flex flex-wrap gap-4"><Money kobo={order.totalKobo} /><StatusBadge status={order.status} /></div></section><section className="surface-card p-5"><h2 className="font-display text-xl">Milestones and events</h2>{order.milestones.map((item) => <div key={item.id} className="mt-3 flex justify-between rounded-xl bg-[var(--ps-grey-200)]/25 p-3 text-sm"><span>{item.title} · {item.status}</span><Money kobo={item.amountKobo} /></div>)}</section><section className="surface-card p-5"><h2 className="font-display text-xl">Payments</h2><p className="mt-3 text-sm text-[var(--ps-grey-600)]">Manual refund and manual release are coming later.</p></section><section className="surface-card p-5"><h2 className="font-display text-xl">Ledger</h2>{ledgerRows.map((item) => <p key={item.id} className="mt-3 text-sm">{item.id} · {item.type} · <Money kobo={item.amountKobo} /></p>)}</section><section className="surface-card p-5"><h2 className="font-display text-xl">Payouts</h2>{payoutRows.map((item) => <p key={item.id} className="mt-3 text-sm">{item.id} · {item.status} · <Money kobo={item.amountKobo} /></p>)}</section><section className="surface-card p-5"><h2 className="font-display text-xl">Receipts</h2>{receiptRows.map((item) => <p key={item.id} className="mt-3 text-sm">{item.number} · <Money kobo={0} /></p>)}</section></div>;
}

function Ledger({ ledger, orders }: { ledger: AppStore["ledger"]; orders: Order[] }) {
  const held = orders.filter((order) => order.status === "funded").reduce((sum, order) => sum + order.milestones.filter((item) => !["released", "refunded"].includes(item.status)).reduce((acc, item) => acc + item.amountKobo, 0), 0);
  return <div className="space-y-4"><article className="surface-card flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-sm text-[var(--ps-grey-600)]">Held total</p><p className="money mt-2 text-2xl"><Money kobo={held} /></p></div><p className="rounded-xl bg-[var(--ps-green-400)]/20 p-3 text-sm">Entries are never edited or deleted. Mistakes are fixed by a reversing entry.</p></article><section className="surface-card overflow-x-auto p-4"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b text-xs">{["Type", "Order", "Amount", "Paga reference", "Time"].map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id} className="border-b last:border-0"><td className="p-3 capitalize">{entry.type}</td><td className="p-3">{orders.find((order) => order.id === entry.orderId)?.title}</td><td className="money p-3"><Money kobo={entry.amountKobo} /></td><td className="p-3">{entry.pagaReference}</td><td className="p-3">{formatLagosDate(entry.createdAt)}</td></tr>)}</tbody></table><button type="button" onClick={() => toast.info("Ledger export is coming later.")} className="mt-4 min-h-10 rounded-full border px-4 text-sm">Export · coming later</button></section><ApiPlaceholder endpoint="GET /api/admin/ledger" /></div>;
}

function Payouts({ payouts, orders, onRetry }: { payouts: AppStore["payouts"]; orders: Order[]; onRetry: (id: string) => void }) {
  return <div className="space-y-4"><p className="rounded-xl bg-[var(--ps-green-400)]/20 p-4 text-sm">Retries are safe: a seller is never paid twice.</p><section className="surface-card p-5">{payouts.map((item) => <div key={item.id} className="grid gap-3 border-b py-4 last:border-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div><p className="text-sm">{orders.find((order) => order.id === item.orderId)?.seller.name ?? "Seller"}</p><p className="mt-1 text-xs text-[var(--ps-grey-600)]">{item.pagaReference} · {item.attempts} attempts</p></div><Money kobo={item.amountKobo} /><StatusBadge status={item.status} />{item.status === "failed" ? <button type="button" onClick={() => onRetry(item.id)} className="min-h-10 rounded-full bg-[var(--ps-green-400)] px-4 text-sm">Retry</button> : null}</div>)}</section><ApiPlaceholder endpoint="GET /api/admin/payouts" /></div>;
}

function Sellers({ store }: { store: AppStore }) {
  const sellers = Array.from(new Map(store.orders.map((order) => [order.seller.id, order.seller])).values());
  return <section className="surface-card p-5"><div className="space-y-3">{sellers.map((seller) => { const orders = store.orders.filter((order) => order.seller.id === seller.id); const disputes = store.disputes.filter((dispute) => orders.some((order) => order.id === dispute.orderId)).length; return <details key={seller.id} className="rounded-xl border border-[var(--ps-grey-200)] p-4"><summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm"><span>{seller.name} · {seller.trustLevel}</span><span>{seller.trustScore ?? "New seller"} · {orders.length} orders · {disputes} disputes</span><span className="rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1 capitalize">{seller.status}</span></summary><p className="mt-4 text-sm">{seller.email} · {seller.phone}</p><p className="mt-2 text-xs text-[var(--ps-grey-600)]">Status changes are disabled in this demo. Trust scores are based on completed orders.</p></details>; })}</div><ApiPlaceholder endpoint="GET /api/admin/sellers" /></section>;
}

function Reconciliation({ store }: { store: AppStore }) {
  const total = store.ledger.reduce((sum, entry) => sum + entry.amountKobo, 0);
  return <section className="surface-card p-5"><div className="rounded-xl bg-[var(--ps-green-400)]/15 p-4 text-sm">Demo reconciliation rows are illustrative and do not represent provider statements.</div>{[0, 1, 2].map((day) => <details key={day} className="mt-3 rounded-xl border p-4"><summary className="cursor-pointer text-sm">{formatLagosDate(new Date(Date.now() - day * 86_400_000))} · {formatNaira(total)} · Matched</summary><p className="mt-3 text-xs text-[var(--ps-grey-600)]">No differing entries for this demo day.</p></details>)}</section>;
}

function AuditLog({ store, search, setSearch }: { store: AppStore; search: string; setSearch: (v: string) => void }) {
  const rows = store.auditLog.filter((item) => `${item.actor} ${item.action} ${item.target}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="surface-card p-5"><label className="flex min-h-11 items-center gap-2 rounded-xl border px-3"><Search size={16} /><span className="sr-only">Search audit log</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by actor or action" className="w-full bg-transparent text-sm outline-none" /></label><div className="mt-4 space-y-3">{rows.map((entry) => <article key={entry.id} className="rounded-xl bg-[var(--ps-grey-200)]/20 p-4"><p className="text-sm">{entry.actor} · {entry.action}</p><p className="mt-1 text-xs text-[var(--ps-grey-600)]">Target: {entry.target} · {formatLagosDate(entry.createdAt)}</p>{entry.before || entry.after ? <p className="mt-2 text-xs">Before: {entry.before ?? "—"} → After: {entry.after ?? "—"}</p> : null}</article>)}</div></section>;
}

type AdminSettingKey = "review" | "expiry" | "response";
type AdminSettingsState = { review: string; expiry: string; response: string };

function AdminSettings({ settings, setSettings, onSave }: { settings: AdminSettingsState; setSettings: (v: AdminSettingsState) => void; onSave: () => void }) {
  const fields: Array<{ key: AdminSettingKey; label: string; min: number; max: number; hint: string }> = [
    { key: "review", label: "Default review window (hours)", min: 24, max: 336, hint: "24 to 336" },
    { key: "expiry", label: "Unpaid order expiry (hours)", min: 1, max: 168, hint: "1 to 168" },
    { key: "response", label: "Dispute response time (hours)", min: 24, max: 120, hint: "24 to 120" },
  ];

  return <section className="surface-card max-w-2xl space-y-4 p-5 sm:p-7"><div className="rounded-xl bg-[var(--ps-green-400)]/15 p-4 text-sm"><h2 className="font-medium">Automatic fee tiers</h2><p className="mt-1 text-[var(--ps-grey-600)]">Orders up to ₦50,000 are charged 1.5%. Orders above ₦50,000 are charged 2%.</p></div>{fields.map(({ key, label, min, max, hint }) => <label key={key} className="block text-sm">{label}<input type="number" min={min} max={max} value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} className="mt-2 h-11 w-full rounded-xl border px-3" /><span className="mt-1 block text-xs text-[var(--ps-grey-600)]">Allowed: {hint}</span></label>)}<button type="button" onClick={onSave} className="min-h-11 rounded-full bg-[var(--ps-green-400)] px-5">Save settings</button><ApiPlaceholder endpoint="PUT /api/admin/settings" /></section>;
}
