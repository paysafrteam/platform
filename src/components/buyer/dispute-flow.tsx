"use client";

import { ArrowRight, Check, FilePlus2, Link2, LockKeyhole, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { useCurrentTime } from "@/components/ui/countdown";
import { Money } from "@/components/ui/money";
import { addBuyerEvidence, openDispute } from "@/lib/api";
import { formatLagosDate } from "@/lib/format/dates";
import type { DisputeReason, DisputeSummary, PublicOrder } from "@/lib/domain/types";

const reasons: { id: DisputeReason; label: string; detail: string }[] = [
  { id: "not_delivered", label: "Not delivered", detail: "The agreed work or item has not arrived." },
  { id: "not_as_described", label: "Not as described", detail: "What arrived is different from the order." },
  { id: "delivered_late", label: "Delivered late", detail: "The delivery missed the agreed deadline." },
  { id: "other", label: "Other", detail: "Something else happened." },
];
type Item = { id: string; type: "text" | "link"; content: string };

export function DisputeFlow({ order, milestoneId }: { order: PublicOrder; milestoneId?: string }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<Item[]>([]);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialog = useStatusDialog();
  const router = useRouter();
  const now = useCurrentTime(60_000);

  const existing = order.disputes.find((d) => (milestoneId ? d.milestoneId === milestoneId : true) && d.status !== "resolved") ?? order.disputes.at(-1);
  const milestone = order.milestones.find((m) => m.id === milestoneId) ?? order.milestones.find((m) => m.status === "delivered" || m.status === "disputed") ?? order.milestones.find((m) => m.status === "pending");
  const underReview = milestone?.status === "delivered" && Boolean(milestone.releaseAt) && (!now || Date.parse(milestone.releaseAt!) > now);
  const missedDeadline = milestone?.status === "pending" && order.status === "funded" && Boolean(now) && Date.parse(order.deliveryDeadline) < now;
  const canDispute = underReview || missedDeadline;

  function add(type: Item["type"], content: string) {
    const value = content.trim();
    if (!value || evidence.length >= 5) return;
    if (type === "link" && !/^https?:\/\/\S+$/i.test(value)) { toast.error("Evidence links must start with http:// or https://."); return; }
    setEvidence((cur) => [...cur, { id: `${Date.now()}-${cur.length}`, type, content: value }]);
  }

  async function submit() {
    if (!reason || !milestone || note.trim().length < 20) return;
    setSubmitting(true);
    try {
      await openDispute({ token: order.token, milestoneId: milestone.id, reason, note: note.trim(), evidence: evidence.map(({ type, content }) => ({ type, content })) });
      dialog.show({ variant: "success", title: "Your dispute is open.", description: "Your money stays frozen. The seller has 48 hours to respond.", primaryAction: { label: "View order", onClick: () => { router.push(`/pay/${order.token}`); router.refresh(); } } });
    } catch (error) {
      dialog.show({ variant: "danger", title: "We couldn't open the dispute.", description: error instanceof Error ? error.message : "Try again in a moment.", primaryAction: { label: "Close" } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15">
      <header className="border-b border-[var(--ps-grey-200)] bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-end px-4 sm:px-6"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1.5 text-xs"><LockKeyhole size={14} /> Funds stay held</span></div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {existing && milestone?.status !== "delivered" && milestone?.status !== "pending" ? (
          <DisputeDetails order={order} dispute={existing} />
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ps-grey-600)]">Dispute · {step + 1} of 4</p>
            <h1 className="font-display mt-2 text-4xl">Let&apos;s work through this.</h1>
            <p className="mt-2 text-[var(--ps-grey-600)]">Order: {order.title}</p>
            {!canDispute ? (
              <div className="surface-card mt-7 p-6">
                <h2 className="text-xl">A dispute is not available for this delivery.</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ps-grey-600)]">You can open a dispute while a delivery is under review, before its release time. If the seller has not delivered by the agreed deadline, you can also open one after that date.</p>
                <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-4" href={`/pay/${order.token}`}>Return to order <ArrowRight size={16} /></Link>
              </div>
            ) : (
              <section className="surface-card mt-7 p-5 sm:p-8">
                <div className="mb-7 flex gap-2" aria-label="Dispute steps">{["Reason", "Details", "Evidence", "Review"].map((item, i) => <span key={item} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[var(--ps-green-900)]" : "bg-[var(--ps-grey-200)]"}`} aria-label={item} />)}</div>
                {milestone ? <p className="mb-5 rounded-2xl bg-[var(--ps-grey-200)]/25 p-3 text-sm">Disputing: {milestone.title} · <Money kobo={milestone.amountKobo} /></p> : null}
                {step === 0 ? <div><h2 className="font-display text-2xl">What went wrong?</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Choose the reason that best fits this order.</p><div className="mt-5 space-y-3">{reasons.filter((r) => !(missedDeadline && r.id === "not_as_described")).map((item) => <button key={item.id} type="button" onClick={() => setReason(item.id)} className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-4 text-left ${reason === item.id ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : "border-[var(--ps-grey-200)]"}`}><span className={`flex size-5 items-center justify-center rounded-full border ${reason === item.id ? "border-[var(--ps-green-900)] bg-[var(--ps-green-900)] text-white" : "border-[var(--ps-grey-600)]"}`}>{reason === item.id ? <Check size={13} /> : null}</span><span><span className="block text-sm">{item.label}</span><span className="mt-1 block text-xs text-[var(--ps-grey-600)]">{item.detail}</span></span></button>)}</div></div> : null}
                {step === 1 ? <div><h2 className="font-display text-2xl">Tell us a little more.</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Share the facts and what you expected. At least 20 characters.</p><label htmlFor="dispute-note" className="mt-5 block text-sm">Your note<textarea id="dispute-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={6} className="mt-2 w-full rounded-2xl border border-[var(--ps-grey-200)] p-4" placeholder="Describe what happened and what you agreed with the seller." /></label><p className="mt-2 text-right text-xs text-[var(--ps-grey-600)]">{note.length}/1000</p>{note.trim().length > 0 && note.trim().length < 20 ? <p className="mt-1 text-sm text-[var(--ps-danger)]">Please add a little more detail. {20 - note.trim().length} characters to go.</p> : null}</div> : null}
                {step === 2 ? <div><h2 className="font-display text-2xl">Add evidence (optional).</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Add up to five notes or links, such as a chat screenshot hosted online or a shared drive link.</p>
                  <div className="mt-5 flex gap-2"><input aria-label="Evidence note" value={text} onChange={(e) => setText(e.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--ps-grey-200)] px-3 text-sm" placeholder="Describe a piece of evidence" /><button type="button" disabled={!text || evidence.length >= 5} onClick={() => { add("text", text); setText(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50"><FilePlus2 size={16} /> Add note</button></div>
                  <div className="mt-3 flex gap-2"><input aria-label="Evidence link" value={link} onChange={(e) => setLink(e.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--ps-grey-200)] px-3 text-sm" placeholder="https://..." /><button type="button" disabled={!link || evidence.length >= 5} onClick={() => { add("link", link); setLink(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50"><Link2 size={16} /> Add link</button></div>
                  <ul className="mt-4 space-y-2">{evidence.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ps-grey-200)]/30 p-3 text-sm"><span className="flex min-w-0 items-center gap-2"><FilePlus2 size={16} /><span className="truncate">{item.content}</span></span><button type="button" onClick={() => setEvidence((l) => l.filter((x) => x.id !== item.id))} aria-label={`Remove ${item.content}`}><X size={16} /></button></li>)}</ul>
                  <p className="mt-3 text-xs text-[var(--ps-grey-600)]">{evidence.length}/5 items. File uploads are not available yet; link to your files instead.</p></div> : null}
                {step === 3 ? <div><h2 className="font-display text-2xl">Review your dispute.</h2><div className="mt-5 space-y-4 rounded-2xl bg-[var(--ps-grey-200)]/25 p-4"><div><p className="text-xs text-[var(--ps-grey-600)]">Reason</p><p className="mt-1 text-sm">{reasons.find((r) => r.id === reason)?.label}</p></div><div><p className="text-xs text-[var(--ps-grey-600)]">Your note</p><p className="mt-1 text-sm leading-6">{note}</p></div><div><p className="text-xs text-[var(--ps-grey-600)]">Evidence</p><p className="mt-1 text-sm">{evidence.length ? evidence.map((i) => i.content).join(", ") : "No evidence added."}</p></div></div><p className="mt-5 rounded-2xl bg-[var(--ps-green-400)]/20 p-4 text-sm"><LockKeyhole className="mr-2 inline" size={16} />Your money stays frozen. The seller has 48 hours to respond.</p></div> : null}
                <div className="mt-7 flex justify-between gap-3"><button type="button" onClick={() => setStep((c) => Math.max(0, c - 1))} disabled={step === 0 || submitting} className="min-h-12 rounded-full border border-[var(--ps-grey-200)] px-5 disabled:opacity-40">Back</button>{step < 3 ? <button type="button" onClick={() => setStep((c) => Math.min(3, c + 1))} disabled={(step === 0 && !reason) || (step === 1 && note.trim().length < 20)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-40">Continue <ArrowRight size={17} /></button> : <button type="button" onClick={() => void submit()} disabled={submitting} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-50">{submitting ? "Sending…" : "Submit dispute"} <ArrowRight size={17} /></button>}</div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const outcomeText = { release_to_seller: "Released to the seller", refund_to_buyer: "Refunded to you", split: "Split between you and the seller" } as const;

function DisputeDetails({ order, dispute }: { order: PublicOrder; dispute: DisputeSummary }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [saved, setSaved] = useState(0);
  const resolved = dispute.status === "resolved";
  async function send(type: "text" | "link", content: string) {
    try {
      await addBuyerEvidence(order.token, dispute.id, { type, content });
      setSaved((n) => n + 1);
      toast.success("Evidence added.");
      if (type === "text") setText(""); else setLink("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't save that.");
    }
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ps-grey-600)]">Dispute {dispute.number}</p>
      <h1 className="font-display mt-2 text-4xl">{resolved ? "A decision was made." : "Your dispute is under review."}</h1>
      <section className="surface-card mt-7 space-y-4 p-5 sm:p-8">
        <div><p className="text-xs text-[var(--ps-grey-600)]">Status</p><p className="mt-1 text-sm capitalize">{dispute.status.replace("_", " ")}</p></div>
        <div><p className="text-xs text-[var(--ps-grey-600)]">Reason given</p><p className="mt-1 text-sm leading-6">{dispute.note}</p></div>
        {resolved ? (
          <div className="rounded-2xl bg-[var(--ps-green-400)]/15 p-4 text-sm leading-6">
            <p>Outcome: <strong>{dispute.outcome ? outcomeText[dispute.outcome] : "Decided"}</strong></p>
            {dispute.decisionReason ? <p className="mt-2">Reason: {dispute.decisionReason}</p> : null}
            {dispute.resolvedAt ? <p className="mt-2 text-[var(--ps-grey-600)]">Decided {formatLagosDate(dispute.resolvedAt)}</p> : null}
          </div>
        ) : (
          <>
            <p className="rounded-2xl bg-[var(--ps-green-400)]/20 p-4 text-sm"><LockKeyhole className="mr-2 inline" size={16} />Your money stays frozen. The seller responds by {formatLagosDate(dispute.responseDueAt)}; then a PaySafr reviewer decides.</p>
            <div className="border-t border-[var(--ps-grey-200)] pt-4">
              <h2 className="font-display text-xl">Add more evidence</h2>
              <div className="mt-3 flex gap-2"><input aria-label="Evidence note" value={text} onChange={(e) => setText(e.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--ps-grey-200)] px-3 text-sm" placeholder="Add a note" /><button type="button" disabled={!text.trim()} onClick={() => void send("text", text)} className="min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50">Add note</button></div>
              <div className="mt-2 flex gap-2"><input aria-label="Evidence link" value={link} onChange={(e) => setLink(e.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--ps-grey-200)] px-3 text-sm" placeholder="https://..." /><button type="button" disabled={!link.trim()} onClick={() => void send("link", link)} className="min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50">Add link</button></div>
              {saved ? <p className="mt-2 text-xs text-[var(--ps-grey-600)]">{saved} item(s) added this visit.</p> : null}
            </div>
          </>
        )}
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm underline" href={`/pay/${order.token}`}>Return to order</Link>
      </section>
    </div>
  );
}
