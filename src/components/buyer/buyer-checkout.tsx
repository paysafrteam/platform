"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  Flag,
  HelpCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/states";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { Logo } from "@/components/brand/logo";
import { CopyField } from "@/components/ui/copy-field";
import { Countdown, useCurrentTime } from "@/components/ui/countdown";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareActions } from "@/components/share/share-actions";
import { checkPayment, confirmMilestone, contactSeller, getPayOrder, requestChanges, simulatePayment } from "@/lib/api";
import { formatLagosDate } from "@/lib/format/dates";
import type { Milestone, PublicOrder as Order } from "@/lib/domain/types";

const protectionRules = [
  "Your money is held before work starts.",
  "The seller is paid only when you confirm, or when your review time ends with no dispute.",
  "If something goes wrong, the money stays on hold while we review.",
];

export function BuyerCheckout({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [loadingError, setLoadingError] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  const [sheet, setSheet] = useState<"trouble" | "changes" | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [contact, setContact] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const dialog = useStatusDialog();

  const reload = useCallback(async () => {
    setLoadingError(false);
    try {
      setOrder(await getPayOrder(initialOrder.token));
    } catch (error) {
      setLoadingError(true);
      console.error("Buyer order refresh failed", error);
    }
  }, [initialOrder.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    if (order.status !== "awaiting_payment") return;
    const timer = window.setInterval(() => void reload(), 8000);
    return () => window.clearInterval(timer);
  }, [order.status, reload]);

  const activeMilestone = useMemo(
    () => order.milestones.find((item) => item.status === "delivered" || item.status === "disputed") ?? order.milestones[0],
    [order.milestones],
  );
  const isPartial = order.status === "awaiting_payment" && order.amountFundedKobo > 0 && order.amountFundedKobo < order.totalKobo;
  const isOverpaid = order.overpaidKobo > 0;
  const hasDelivered = order.milestones.some((milestone) => milestone.status === "delivered");
  const isDisputed = order.milestones.some((milestone) => milestone.status === "disputed");
  const allRefunded = order.milestones.length > 0 && order.milestones.every((milestone) => milestone.status === "refunded");
  const allReleased = order.milestones.length > 0 && order.milestones.every((milestone) => ["released", "refunded"].includes(milestone.status));
  const primaryMilestone = activeMilestone;

  async function markTransfer() {
    dialog.show({ variant: "loading", title: "We're checking for your payment…", description: "This can take a moment. Please keep this page open." });
    try {
      const result = await checkPayment(order.token);
      setOrder(result.order);
      if (result.status === "funded") {
        dialog.show({ variant: "success", title: "Payment received.", description: "Your money is held safely. The seller can now start the work.", primaryAction: { label: "Continue" } });
      } else {
        dialog.show({ variant: "warning", title: "We haven't received it yet.", description: "Bank transfers can take a few minutes. Keep this page open; it updates by itself once your payment arrives.", primaryAction: { label: "OK" } });
      }
    } catch (error) {
      dialog.show({ variant: "danger", title: "We couldn't confirm that yet.", description: error instanceof Error ? error.message : "Try again in a moment.", primaryAction: { label: "Try again", onClick: () => void markTransfer() } });
    }
  }

  async function releaseMilestone() {
    if (!primaryMilestone) return;
    const confirmed = await dialog.confirm({
      variant: "warning",
      title: `Release ${formatAmount(primaryMilestone.amountKobo)} to ${order.seller.name}?`,
      description: "This can't be undone. Confirm only if the delivery is right.",
      primaryAction: { label: "Release payment" },
      secondaryAction: { label: "Go back" },
    });
    if (!confirmed) return;
    try {
      const updated = await confirmMilestone(order.token, primaryMilestone.id);
      setOrder(updated);
      dialog.show({ variant: "success", title: "Delivery confirmed.", description: "The payment has been released to the seller.", primaryAction: { label: "Done" } });
    } catch (error) {
      dialog.show({ variant: "danger", title: "We couldn't release this payment.", description: error instanceof Error ? error.message : "Try again in a moment.", primaryAction: { label: "Close" } });
    }
  }

  async function sandboxPay() {
    dialog.show({ variant: "loading", title: "Simulating your bank transfer…", description: "Sandbox only. No real money moves." });
    try {
      await simulatePayment(order.token);
      await reload();
      dialog.show({ variant: "success", title: "Sandbox payment received.", description: "The order is funded and your money is held safely.", primaryAction: { label: "Continue" } });
    } catch (error) {
      dialog.show({ variant: "danger", title: "The sandbox payment failed.", description: error instanceof Error ? error.message : "Try again.", primaryAction: { label: "Close" } });
    }
  }

  async function sendChangeRequest() {
    if (!primaryMilestone) return;
    try {
      await requestChanges(order.token, primaryMilestone.id, changeNote);
      setSheet(null);
      setChangeNote("");
      dialog.show({ variant: "success", title: "Request sent.", description: "The seller can now review your note and update the delivery.", primaryAction: { label: "Done" } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't send that request.");
    }
  }

  async function saveContact() {
    setSavingContact(true);
    try {
      const input = contact.includes("@") ? { email: contact.trim() } : { phone: contact.trim() };
      await contactSeller(order.token, input);
      toast.success("Updates will be sent to you.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your contact details.");
    } finally {
      setSavingContact(false);
    }
  }

  const summaryContent = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--ps-grey-600)]">Order summary</p>
          <h1 className="font-display mt-2 text-3xl leading-tight">{order.title}</h1>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--ps-green-400)]/20"><ShieldCheck size={21} /></span>
      </div>
      <p className={`mt-3 text-sm leading-6 text-[var(--ps-grey-600)] ${summaryExpanded ? "" : "line-clamp-2"}`}>{order.description}</p>
      {order.description.length > 120 ? <button type="button" className="mt-1 text-sm underline underline-offset-4" onClick={() => setSummaryExpanded(!summaryExpanded)}>{summaryExpanded ? "Read less" : "Read more"}</button> : null}
      <p className="money mt-5 text-4xl tracking-[-0.03em] sm:text-5xl"><Money kobo={order.totalKobo} /></p>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--ps-grey-200)]/25 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--ps-green-900)] text-sm text-white">{initials(order.seller.name)}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm">{order.seller.name}</p><p className="text-xs text-[var(--ps-grey-600)]">{order.seller.completedOrders} completed orders</p></div>
        {order.seller.trustScore === null ? <span className="rounded-full border border-[var(--ps-grey-600)] px-2.5 py-1 text-xs">New seller</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ps-green-400)]/25 px-2.5 py-1 text-xs"><BadgeCheck size={13} />{capitalize(order.seller.trustLevel)} · {order.seller.trustScore}</span>}
      </div>
      <div className="mt-4 flex items-start gap-2 text-sm text-[var(--ps-grey-600)]"><Clock3 size={16} className="mt-0.5 shrink-0" /><span>Delivery by {formatLagosDate(order.deliveryDeadline)}</span></div>
      {order.milestones.length > 1 ? <div className="mt-5 border-t border-[var(--ps-grey-200)] pt-4"><h2 className="text-sm">Delivery milestones</h2><ol className="mt-3 space-y-3">{order.milestones.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 text-sm"><span>{item.title}<span className="mt-1 block"><StatusBadge status={item.status} /></span></span><Money kobo={item.amountKobo} /></li>)}</ol></div> : null}
      <div className="mt-5 border-t border-[var(--ps-grey-200)] pt-3">
        <button type="button" className="flex min-h-11 w-full items-center justify-between text-left text-sm" aria-expanded={protectionOpen} onClick={() => setProtectionOpen(!protectionOpen)}>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> How PaySafr protects you</span><ChevronDown size={17} className={protectionOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
        {protectionOpen ? <ol className="mt-2 space-y-2 pl-1 text-sm leading-5 text-[var(--ps-grey-600)]">{protectionRules.map((rule, index) => <li key={rule} className="flex gap-2"><span className="money flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ps-green-400)]/25 text-xs text-[var(--ps-green-900)]">{index + 1}</span>{rule}</li>)}</ol> : null}
      </div>
    </>
  );

  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15 pb-24 md:pb-10">
      <header className="border-b border-[var(--ps-grey-200)] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="PaySafr home"><Logo variant="mark" /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1.5 text-xs"><ShieldCheck size={14} /> Protected by PaySafr</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Payment progress" className="mx-auto mb-7 max-w-xl">
          <ol className="flex items-center justify-center gap-2 sm:gap-4">
            {["Review", "Pay", "Confirm"].map((item, index) => {
              const activeIndex = allReleased || allRefunded ? 2 : order.status === "awaiting_payment" || order.status === "expired" || order.status === "cancelled" ? 1 : hasDelivered || isDisputed ? 2 : 1;
              const active = index <= activeIndex;
              return <li key={item} className="flex items-center gap-2 text-xs sm:text-sm"><span className={`flex size-7 items-center justify-center rounded-full ${active ? "bg-[var(--ps-green-900)] text-white" : "border border-[var(--ps-grey-200)] text-[var(--ps-grey-600)]"}`}>{index < activeIndex ? <Check size={14} /> : index + 1}</span><span className={active ? "" : "text-[var(--ps-grey-600)]"}>{item}</span>{index < 2 ? <span className="mx-1 h-px w-8 bg-[var(--ps-grey-200)] sm:w-16" /> : null}</li>;
            })}
          </ol>
        </nav>
        {loadingError ? <div className="mb-5"><ErrorState retry={() => void reload()} /></div> : null}
        <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
          <section className="surface-card h-fit p-5 sm:p-7">{summaryContent}</section>
          <section className="space-y-4">
            {order.status === "awaiting_payment" ? (
              <PaymentPanel order={order} partial={isPartial} onPaid={markTransfer} onSandboxPay={() => void sandboxPay()} onTrouble={() => setSheet("trouble")} contact={contact} setContact={setContact} onSaveContact={saveContact} savingContact={savingContact} />
            ) : null}
            {order.status === "expired" || order.status === "cancelled" ? <ClosedPanel order={order} expired={order.status === "expired"} /> : null}
            {order.status === "completed" && allRefunded ? <CompletionPanel order={order} refunded /> : null}
            {order.status === "completed" && !allRefunded ? <CompletionPanel order={order} /> : null}
            {order.status === "funded" && !hasDelivered && !isDisputed ? (
              <FundedPanel order={order} overpaid={isOverpaid} />
            ) : null}
            {hasDelivered && !isDisputed ? <DeliveredPanel order={order} milestone={primaryMilestone} onConfirm={releaseMilestone} onChanges={() => setSheet("changes")} /> : null}
            {isDisputed ? <DisputedPanel order={order} /> : null}
          </section>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--ps-grey-600)]">PaySafr home</Link>
          <PoweredByPaga variant="footer" />
        </div>
      </div>
      {order.status === "awaiting_payment" ? <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--ps-grey-200)] bg-white/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:hidden"><button type="button" onClick={markTransfer} className="min-h-12 w-full rounded-full bg-[var(--ps-green-400)] px-5 text-[var(--ps-green-900)]">I&apos;ve made the transfer</button></div> : null}
      {hasDelivered && !isDisputed ? <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--ps-grey-200)] bg-white/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:hidden"><button type="button" onClick={() => void releaseMilestone()} className="min-h-12 w-full rounded-full bg-[var(--ps-green-400)] px-5 text-[var(--ps-green-900)]">Confirm and release {primaryMilestone ? formatAmount(primaryMilestone.amountKobo) : ""}</button></div> : null}
      {sheet ? <ActionSheet title={sheet === "trouble" ? "Having trouble paying?" : "Ask for changes"} onClose={() => setSheet(null)}>
        {sheet === "trouble" ? <div className="space-y-4 text-sm leading-6 text-[var(--ps-grey-600)]"><p>Use your bank app or wallet to transfer the exact amount shown to the account above.</p><p>The bank may take a little time to confirm a transfer. Keep this page open and check again.</p><p>A screenshot does not mark the order as paid. Only a verified bank confirmation does.</p></div> : <div><label className="block text-sm" htmlFor="change-note">What would you like the seller to change?</label><textarea id="change-note" rows={4} value={changeNote} onChange={(event) => setChangeNote(event.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--ps-grey-200)] p-3" placeholder="Tell the seller what needs a closer look." /><button type="button" onClick={() => void sendChangeRequest()} className="mt-4 min-h-12 w-full rounded-full bg-[var(--ps-green-400)]">Send request</button></div>}
      </ActionSheet> : null}
    </main>
  );
}

function PaymentPanel({ order, partial, onPaid, onSandboxPay, onTrouble, contact, setContact, onSaveContact, savingContact }: {
  order: Order; partial: boolean; onPaid: () => void; onSandboxPay: () => void; onTrouble: () => void; contact: string;
  setContact: (value: string) => void; onSaveContact: () => void; savingContact: boolean;
}) {
  const remaining = Math.max(0, order.totalKobo - order.amountFundedKobo);
  const account = order.orderAccount;
  return (
    <article className="surface-card p-5 sm:p-7">
      {partial ? <div className="mb-5 rounded-2xl border border-[var(--ps-warning)]/50 bg-[var(--ps-warning)]/15 p-4"><div className="flex items-start gap-2 text-sm"><CircleAlert size={18} /><p>We received <Money kobo={order.amountFundedKobo} />. <Money kobo={remaining} /> left to pay.</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[var(--ps-green-900)]" style={{ width: `${Math.min(100, (order.amountFundedKobo / order.totalKobo) * 100)}%` }} /></div></div> : null}
      <h2 className="font-display text-2xl leading-tight">Pay <Money kobo={partial ? remaining : order.totalKobo} /> by bank transfer</h2>
      <p className="mt-2 text-sm text-[var(--ps-grey-600)]">Use these details in your bank app. Your order account is for this order only.</p>
      <div className="mt-4 rounded-2xl border border-[var(--ps-grey-200)] px-4">
        <CopyField label="Bank" value={account?.bankName ?? ""} />
        <CopyField label="Account number" value={account?.accountNumber ?? ""} large />
        <CopyField label="Account name" value={account?.accountName ?? ""} />
        <CopyField label="Amount to send" value={formatAmount(partial ? remaining : order.totalKobo)} large />
        <div className="flex items-center justify-between gap-3 border-t border-[var(--ps-grey-200)] py-3 text-sm"><span className="text-[var(--ps-grey-600)]">Pay within</span><span className="money"><Countdown target={account?.expiresAt ?? order.expiresAt ?? order.createdAt} label="Payment link expires" /></span></div>
      </div>
      <div className="mt-4"><PoweredByPaga /></div>
      <ol className="mt-5 space-y-3">
        {["Open your bank app", `Send exactly ${formatAmount(partial ? remaining : order.totalKobo)} to this account`, "We'll detect it automatically"].map((step, index) => <li key={step} className="flex items-center gap-3 text-sm"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ps-grey-200)]/50 text-xs">{index + 1}</span>{step}</li>)}
      </ol>
      <p className="mt-4 text-xs leading-5 text-[var(--ps-grey-600)]">Only the bank&apos;s confirmation counts. A screenshot can&apos;t mark an order as paid.</p>
      <button type="button" onClick={onPaid} className="mt-5 hidden min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 text-[var(--ps-green-900)] md:inline-flex">I&apos;ve made the transfer <ArrowRight size={17} /></button>
      <button type="button" onClick={onTrouble} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--ps-grey-600)]"><HelpCircle size={16} /> Having trouble?</button>
      <div className="mt-5 border-t border-[var(--ps-grey-200)] pt-4">
        <div className="flex items-center gap-2 text-sm"><Mail size={15} /> Get updates <span className="text-xs text-[var(--ps-grey-600)]">Optional</span></div>
        <div className="mt-2 flex gap-2"><input aria-label="Email or phone number for updates" value={contact} onChange={(event) => setContact(event.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--ps-grey-200)] px-3 text-sm" placeholder="Email or phone number" /><button type="button" onClick={onSaveContact} disabled={!contact || savingContact} className="min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50">{savingContact ? "Saving" : "Save"}</button></div>
      </div>
      {process.env.NEXT_PUBLIC_APP_ENV !== "production" ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--ps-warning)] bg-[var(--ps-warning)]/10 p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--ps-grey-600)]">Sandbox only</p>
          <p className="mt-1 text-sm">This is a test environment. Don&apos;t send real money to the account above.</p>
          <button type="button" onClick={onSandboxPay} className="mt-3 min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm">Simulate this bank transfer</button>
        </div>
      ) : null}
    </article>
  );
}

function FundedPanel({ order, overpaid }: { order: Order; overpaid: boolean }) {
  return (
    <article className="surface-card overflow-hidden">
      {overpaid ? <div className="border-b border-[var(--ps-warning)]/50 bg-[var(--ps-warning)]/15 p-4 text-sm"><CircleAlert size={16} className="mr-2 inline" />You sent <Money kobo={order.overpaidKobo} /> extra. We&apos;ll refund it unless the seller agrees to keep it for this order.</div> : null}
      <div className="bg-[var(--ps-green-900)] p-6 text-white sm:p-7">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--ps-green-400)] text-[var(--ps-green-900)]"><Check size={25} /></span>
        <h2 className="font-display mt-4 text-3xl">Money is held safely.</h2>
        <p className="mt-2 text-sm text-white/75">Your payment is confirmed. The seller can start work.</p>
      </div>
      <div className="p-5 sm:p-7">
        <ol className="space-y-4 border-l border-[var(--ps-grey-200)] pl-5">
          <TimelineItem done title="You paid" detail={`Payment verified · ${formatLagosDate(order.fundedAt ?? order.createdAt)}`} />
          <TimelineItem title="Seller is working" detail={`Delivery by ${formatLagosDate(order.deliveryDeadline)}`} />
          <TimelineItem title="You review" detail={`${order.reviewWindowHours} hours to review after delivery`} />
          <TimelineItem title="Done" detail="Payment releases when you confirm or review time ends." />
        </ol>
        <div className="mt-6 rounded-2xl border border-[var(--ps-grey-200)] p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[var(--ps-grey-600)]">Payment receipt</p><p className="mt-1 text-sm">{order.paymentReceipt?.number ?? "Issuing…"}</p></div><FileCheck2 size={20} /></div>
          <p className="money mt-3 text-2xl"><Money kobo={order.totalKobo} /></p>
          <p className="mt-1 text-xs text-[var(--ps-grey-600)]">Paid · {formatLagosDate(order.fundedAt ?? order.createdAt)}</p>
          {order.paymentReceipt ? <div className="mt-4"><ShareActions kind="receipt" copyUrl={`/r/${order.paymentReceipt.publicToken}`} shareText={`PaySafr receipt ${order.paymentReceipt.number}`} /></div> : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--ps-grey-600)]">Your money is safe with PaySafr. It is only released when you confirm, or when the review time ends.</p>
        <div className="mt-4"><PoweredByPaga /></div>
      </div>
    </article>
  );
}

function DeliveredPanel({ order, milestone, onConfirm, onChanges }: { order: Order; milestone?: Milestone; onConfirm: () => void; onChanges: () => void }) {
  const now = useCurrentTime(60_000);
  if (!milestone) return null;
  const proof = milestone.proof;
  return (
    <article className="surface-card p-5 sm:p-7">
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--ps-warning)]/15 p-4"><FileCheck2 size={19} /><p className="text-sm">{order.seller.name.replace(/\.$/, "")} marked this as delivered.</p></div>
      <div className="mt-5 rounded-2xl border border-[var(--ps-grey-200)] p-4">
        <p className="text-xs text-[var(--ps-grey-600)]">Delivery proof</p>
                {proof?.kind === "link" ? <a className="mt-2 block break-all text-sm underline" href={safeHttpUrl(proof.content)} target="_blank" rel="noopener noreferrer">{proof.content}</a> : null}
        <p className="mt-2 text-sm leading-6">{proof?.content ?? "The seller has marked this item as delivered and is ready for your review."}</p>
      </div>
      {milestone.releaseAt ? <div className="mt-4 rounded-2xl bg-[var(--ps-green-900)] p-4 text-white"><div className="flex items-center gap-2 text-sm"><Clock3 size={17} /> Money is released in <Countdown target={milestone.releaseAt} label="Automatic release" /></div><p className="mt-1 text-xs text-white/70">unless you respond before then</p></div> : null}
      {now > 0 && milestone.releaseAt && Date.parse(milestone.releaseAt) > now && Date.parse(milestone.releaseAt) - now < 24 * 3_600_000 ? <p className="mt-3 text-sm text-[var(--ps-warning)]"><CircleAlert size={16} className="mr-1 inline" />Reminder: auto-release is in less than 24 hours.</p> : null}
      <div className="mt-5 space-y-2">
        <button type="button" onClick={onConfirm} className="min-h-12 w-full rounded-full bg-[var(--ps-green-400)] px-5 text-[var(--ps-green-900)]">Confirm and release <Money kobo={milestone.amountKobo} /></button>
        <button type="button" onClick={onChanges} className="min-h-12 w-full rounded-full border border-[var(--ps-green-900)] px-5">Ask for changes</button>
        <Link href={`/pay/${order.token}/dispute?milestone=${encodeURIComponent(milestone.id)}`} className="flex min-h-11 items-center justify-center gap-2 text-sm text-[var(--ps-danger)]"><Flag size={16} /> Open a dispute</Link>
      </div>
    </article>
  );
}

function DisputedPanel({ order }: { order: Order }) {
  return (
    <article className="surface-card p-5 sm:p-7">
      <div className="rounded-2xl bg-[var(--ps-green-900)] p-5 text-white"><span className="flex size-11 items-center justify-center rounded-full bg-white/10"><LockKeyhole size={21} /></span><h2 className="font-display mt-4 text-2xl">Your money is on hold while we review.</h2><p className="mt-2 text-sm text-white/70">The seller has time to respond. A PaySafr reviewer then decides, with a written reason both sides can read.</p></div>
      <ol className="mt-6 space-y-4">
        <TimelineItem done title="Dispute opened" detail="The payment is held safely." />
        <TimelineItem title="Seller response" detail="They have 48 hours to respond." />
        <TimelineItem title="Evidence review" detail="Both sides can share useful details." />
        <TimelineItem title="Admin decision" detail="Release, refund or split, with a written reason." />
      </ol>
      <Link href={`/pay/${order.token}/dispute`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-4 text-sm">View dispute details <ArrowRight size={16} /></Link>
    </article>
  );
}

function CompletionPanel({ order, refunded = false }: { order: Order; refunded?: boolean }) {
  return (
    <article className="surface-card overflow-hidden">
      <div className={`p-6 text-white ${refunded ? "bg-[var(--ps-green-800)]" : "bg-[var(--ps-green-900)]"}`}>
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--ps-green-400)] text-[var(--ps-green-900)]"><Check size={25} /></span>
        <h2 className="font-display mt-4 text-3xl">{refunded ? "Your money was returned." : "All done."}</h2>
        <p className="money mt-2 text-xl"><Money kobo={order.totalKobo} /> {refunded ? "was returned to you." : `was paid out to ${order.seller.name}.`}</p>
      </div>
      <div className="p-5 sm:p-7"><p className="text-xs text-[var(--ps-grey-600)]">Completion receipt · {order.completionReceipt?.number ?? "Issuing…"}</p><p className="money mt-2 text-2xl"><Money kobo={order.totalKobo} /></p><p className="mt-1 text-xs text-[var(--ps-grey-600)]">{formatLagosDate(order.completedAt ?? order.createdAt)}</p>{order.completionReceipt ? <div className="mt-4"><ShareActions kind="receipt" copyUrl={`/r/${order.completionReceipt.publicToken}`} shareText={`PaySafr receipt ${order.completionReceipt.number}`} /></div> : null}<Link href={`/pay/${order.token}/receipt`} className="mt-3 inline-flex min-h-10 items-center text-sm underline">View all receipts</Link><div className="mt-5"><PoweredByPaga /></div></div>
    </article>
  );
}

function ClosedPanel({ order, expired }: { order: Order; expired: boolean }) {
  return (
    <article className="surface-card p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--ps-grey-200)]/50"><Clock3 size={22} /></span>
      <h2 className="font-display mt-4 text-3xl">{expired ? "This payment link has expired." : "This order was cancelled."}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ps-grey-600)]">{expired ? "Ask the seller for a new payment link. Already sent money? Don't worry. We'll flag it and refund you." : "Ask the seller if you need a new order link."}</p>
      <p className="mt-4 text-sm">Contact {order.seller.name} directly for a new link.</p>
    </article>
  );
}

function TimelineItem({ done = false, title, detail }: { done?: boolean; title: string; detail: string }) {
  return <li className="relative -ml-[26px] flex items-start gap-3"><span className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${done ? "border-[var(--ps-green-900)] bg-[var(--ps-green-900)] text-white" : "border-[var(--ps-grey-200)] bg-white"}`}>{done ? <Check size={13} /> : <span className="size-1.5 rounded-full bg-[var(--ps-grey-600)]" />}</span><span><span className="block text-sm">{title}</span><span className="mt-1 block text-xs text-[var(--ps-grey-600)]">{detail}</span></span></li>;
}

function ActionSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(17_43_0_/_40%)] backdrop-blur-sm sm:items-center" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-t-[28px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-[28px] sm:p-7">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl">{title}</h2><button type="button" className="flex size-10 items-center justify-center rounded-full border border-[var(--ps-grey-200)]" onClick={onClose} aria-label="Close sheet"><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

function formatAmount(kobo: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(kobo / 100);
}

function initials(name: string) {
  return name.replace(/\./g, "").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return "#";
  }
  return "#";
}
