"use client";

import { Activity, ArrowRight, BadgeCheck, Bell, CircleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/states";
import { OrderTable } from "@/components/seller/order-list";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { changePassword, markNotificationsRead, signOut, updateMe } from "@/lib/api";
import { formatLagosDate } from "@/lib/format/dates";
import { formatNaira } from "@/lib/format/money";
import type { DashboardData, IncomeData, Me, Notification, PayoutAccount, PublicInvoice, PublicReceipt, TrustData } from "@/lib/domain/types";

const input = "mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-3";
const primary = "min-h-11 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-50";

export function Dashboard({ data }: { data: DashboardData }) {
  const max = Math.max(1, ...data.incomeByMonth.map((m) => m.kobo));
  const kpis: [string, string | number][] = [
    ["Held safely", formatNaira(data.heldKobo)], ["Paid out", formatNaira(data.paidOutKobo)],
    ["Waiting for payment", data.awaitingPaymentCount], ["Open disputes", data.openDisputeCount],
  ];
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([l, v]) => <article key={l} className="surface-card p-5"><p className="text-sm text-[var(--ps-grey-600)]">{l}</p><p className="money mt-3 text-2xl">{v}</p></article>)}</section>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-3xl bg-[var(--ps-green-900)] p-6 text-white">
          <div className="flex items-start justify-between"><div><p className="text-xs text-white/65">Income, last 6 months</p><h2 className="font-display mt-1 text-2xl">Money moves with your work.</h2></div><Activity size={20} className="text-[var(--ps-green-400)]" /></div>
          <div className="mt-8 flex h-36 items-end gap-3">{data.incomeByMonth.map((m) => <div key={m.month} className="flex flex-1 flex-col items-center gap-2" title={formatNaira(m.kobo)}><div className="w-full rounded-t-lg bg-[var(--ps-green-400)]" style={{ height: `${Math.max(3, (m.kobo / max) * 100)}%` }} /><span className="text-[10px] text-white/60">{m.label}</span></div>)}</div>
          <p className="mt-3 text-xs text-white/60">Released to you after PaySafr fees, by month.</p>
        </section>
        <section className="surface-card p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl">Needs your action</h2><CircleAlert size={18} /></div>
          {data.needsAction.length ? <ul className="mt-4 space-y-3">{data.needsAction.map((a, i) => <li key={i}><Link href={`/orders/${a.orderId}`} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ps-grey-200)]/25 p-3 text-sm"><span>{a.title}<span className="block text-xs text-[var(--ps-grey-600)]">{a.detail}</span></span><ArrowRight size={16} /></Link></li>)}</ul> : <p className="mt-4 text-sm text-[var(--ps-grey-600)]">You&apos;re all caught up.</p>}
        </section>
      </div>
      <section className="surface-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl">Recent orders</h2><Link href="/orders" className="text-sm underline">View all</Link></div>
        {data.recentOrders.length ? <OrderTable orders={data.recentOrders} /> : <EmptyState title="No orders yet" description="Create your first order to get a payment link." action={<Link href="/orders/new" className="underline">Create an order</Link>} />}
      </section>
    </div>
  );
}

export function ReceiptList({ receipts }: { receipts: PublicReceipt[] }) {
  if (!receipts.length) return <EmptyState title="No receipts yet" description="Receipts appear when a buyer's payment is confirmed and when money is released." />;
  return (
    <div className="surface-card divide-y divide-[var(--ps-grey-200)]">
      {receipts.map((r) => (
        <Link key={r.token} href={`/r/${r.token}`} target="_blank" className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span><span className="block">{r.number}</span><span className="text-xs text-[var(--ps-grey-600)]">{r.title}{r.milestoneTitle ? ` · ${r.milestoneTitle}` : ""} · {r.type}</span></span>
          <span className="text-right"><Money kobo={r.amountKobo} /><span className="block text-xs text-[var(--ps-grey-600)]">{formatLagosDate(r.issuedAt)}</span></span>
        </Link>
      ))}
    </div>
  );
}

export function InvoiceList({ invoices }: { invoices: PublicInvoice[] }) {
  if (!invoices.length) return <EmptyState title="No invoices yet" description="An invoice is created for every published order." action={<Link href="/orders/new" className="underline">Create an order</Link>} />;
  return (
    <div className="surface-card divide-y divide-[var(--ps-grey-200)]">
      {invoices.map((i) => (
        <Link key={i.token} href={`/i/${i.token}`} target="_blank" className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span><span className="block">{i.title}</span><span className="text-xs text-[var(--ps-grey-600)]">INV-{i.token.slice(0, 8).toUpperCase()} · {formatLagosDate(i.createdAt)}</span></span>
          <span className="flex items-center gap-3"><Money kobo={i.totalKobo} /><StatusBadge status={i.status} /></span>
        </Link>
      ))}
    </div>
  );
}

export function Income({ data }: { data: IncomeData }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">{([["Received", formatNaira(data.receivedKobo)], ["PaySafr fees", formatNaira(data.feesKobo)], ["Completed orders", data.completedOrders]] as const).map(([l, v]) => <article key={l} className="surface-card p-5"><p className="text-sm text-[var(--ps-grey-600)]">{l}</p><p className="money mt-3 text-2xl">{v}</p></article>)}</section>
      {data.transactions.length ? (
        <section className="surface-card divide-y divide-[var(--ps-grey-200)]">{data.transactions.map((t) => <Link key={t.id} href={`/orders/${t.orderId}`} className="flex items-center justify-between gap-3 p-4 text-sm"><span>{t.orderTitle}<span className="block text-xs text-[var(--ps-grey-600)]">{t.type === "release" ? "Released to you" : "PaySafr fee"} · {formatLagosDate(t.createdAt)}</span></span><Money kobo={t.amountKobo} /></Link>)}</section>
      ) : <EmptyState title="No income yet" description="Released payments will show here as your verified income history." />}
    </div>
  );
}

export function Trust({ data }: { data: TrustData }) {
  const need = Math.max(0, data.qualifyingNeeded - data.qualifyingOrders);
  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="surface-card p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--ps-green-400)]/25"><BadgeCheck size={27} /></span>
        {data.score === null ? <><h2 className="font-display mt-4 text-3xl">New seller</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Complete {need} more qualifying order{need === 1 ? "" : "s"} to earn a score. New sellers are never shown a zero.</p></> : <><p className="money mt-4 text-5xl">{data.score}</p><p className="mt-1 capitalize">{data.level}</p></>}
        <p className="mt-4 text-xs text-[var(--ps-grey-600)]">{data.completedOrders} completed · {data.qualifyingOrders} counted toward your score</p>
      </section>
      <section className="surface-card p-6">
        <h2 className="font-display text-xl">How your score is built</h2>
        <ul className="mt-3 space-y-1 text-sm text-[var(--ps-grey-600)]"><li>Orders completed without a dispute: 35%</li><li>Dispute record: 25%</li><li>On-time delivery: 20%</li><li>Experience (number and value of orders): 10%</li></ul>
        <p className="mt-3 text-xs text-[var(--ps-grey-600)]">Only released orders of ₦1,000 or more count, and orders where buyer and seller look like the same person are ignored. The score comes only from PaySafr&apos;s ledger.</p>
        <h3 className="mt-5 text-sm">Recent changes</h3>
        {data.events.length ? <ul className="mt-2 space-y-1 text-sm">{data.events.map((e) => <li key={e.id}>{formatLagosDate(e.createdAt)} · {e.orderTitle ?? "Account"} · {e.delta >= 0 ? "+" : ""}{e.delta} → {e.scoreAfter ?? "New"}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--ps-grey-600)]">No changes yet.</p>}
      </section>
    </div>
  );
}

export function Notifications({ items, refresh }: { items: Notification[]; refresh: () => void }) {
  async function readAll() { try { await markNotificationsRead(); refresh(); } catch { toast.error("We couldn't update your notifications."); } }
  if (!items.length) return <EmptyState title="No notifications yet" description="We'll tell you when an order is funded, delivered, released or disputed." />;
  return (
    <section className="surface-card">
      <div className="flex items-center justify-between border-b border-[var(--ps-grey-200)] p-4"><span className="flex items-center gap-2 text-sm"><Bell size={16} /> {items.filter((n) => !n.read).length} unread</span><button type="button" className="text-sm underline" onClick={() => void readAll()}>Mark all as read</button></div>
      <ul className="divide-y divide-[var(--ps-grey-200)]">{items.map((n) => <li key={n.id} className={`p-4 text-sm ${n.read ? "" : "bg-[var(--ps-green-400)]/10"}`}>{n.orderId ? <Link href={`/orders/${n.orderId}`} className="block"><Row n={n} /></Link> : <Row n={n} />}</li>)}</ul>
    </section>
  );
}
const Row = ({ n }: { n: Notification }) => <><p>{n.title}</p><p className="mt-1 text-[var(--ps-grey-600)]">{n.message}</p><p className="mt-1 text-xs text-[var(--ps-grey-600)]">{formatLagosDate(n.createdAt)}</p></>;

export function PayoutAccountForm({ account, banks, onSave }: { account: PayoutAccount | null; banks: { code: string; name: string }[]; onSave: (v: { bankCode: string; accountNumber: string; accountName: string }) => Promise<void> }) {
  const [bankCode, setBankCode] = useState(account?.bankCode ?? banks[0]?.code ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [busy, setBusy] = useState(false);
  const ok = /^\d{10}$/.test(accountNumber) && accountName.trim().length >= 2 && bankCode;
  return (
    <section className="surface-card max-w-2xl p-5 sm:p-8">
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--ps-green-400)]/20 p-4 text-sm"><Wallet size={19} /><p>Payout details are shown only to you. Released money is sent to this account. Check the number carefully; automatic name matching arrives with the Paga integration.</p></div>
      <label className="mt-5 block text-sm">Bank<select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={`${input} px-3`}>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select></label>
      <label className="mt-4 block text-sm">Account number<input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} className={input} /></label>
      <label className="mt-4 block text-sm">Account name<input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={input} placeholder="Exactly as it appears on your bank account" /></label>
      <button type="button" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onSave({ bankCode, accountNumber, accountName: accountName.trim() }); } finally { setBusy(false); } }} className={`${primary} mt-5 w-full`}>{busy ? "Saving…" : "Save payout account"}</button>
    </section>
  );
}

export function SettingsPage({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone);
  const [business, setBusiness] = useState(me.businessName ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveProfile() {
    setBusy(true);
    try { await updateMe({ name, phone, businessName: business }); toast.success("Profile saved."); onSaved(); } catch (e) { toast.error(e instanceof Error ? e.message : "We couldn't save your profile."); } finally { setBusy(false); }
  }
  async function savePassword() {
    setBusy(true);
    try { await changePassword({ currentPassword: current, newPassword: next }); toast.success("Password changed. Other devices were signed out."); setCurrent(""); setNext(""); } catch (e) { toast.error(e instanceof Error ? e.message : "We couldn't change your password."); } finally { setBusy(false); }
  }
  async function leave() {
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't sign you out.");
    } finally {
      router.push("/sign-in");
      router.refresh();
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="surface-card p-5 sm:p-7">
        <h2 className="font-display text-xl">Profile details</h2>
        <label className="mt-4 block text-sm">Full name<input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="mt-4 block text-sm">Business name (optional)<input value={business} onChange={(e) => setBusiness(e.target.value)} className={input} /></label>
        <label className="mt-4 block text-sm">Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></label>
        <label className="mt-4 block text-sm">Email<input value={me.email} readOnly className={`${input} bg-[var(--ps-grey-200)]/30`} /></label>
        <button type="button" disabled={busy} onClick={() => void saveProfile()} className={`${primary} mt-5`}>Save changes</button>
      </section>
      <section className="surface-card p-5 sm:p-7">
        <h2 className="font-display text-xl">Password</h2>
        <label className="mt-4 block text-sm">Current password<input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} /></label>
        <label className="mt-4 block text-sm">New password<input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} /></label>
        <button type="button" disabled={busy || !current || !next} onClick={() => void savePassword()} className={`${primary} mt-5`}>Change password</button>
        <button type="button" onClick={() => void leave()} className="mt-5 flex min-h-11 items-center gap-2 text-sm underline">Sign out <ArrowRight size={15} /></button>
      </section>
    </div>
  );
}
