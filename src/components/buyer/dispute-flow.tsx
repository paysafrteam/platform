"use client";

import { ArrowRight, Check, FilePlus2, Link2, LockKeyhole, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { ApiPlaceholder } from "@/components/feedback/api-placeholder";
import { openDispute } from "@/lib/api";
import { useCurrentTime } from "@/components/ui/countdown";
import type { DisputeReason, Evidence, Order } from "@/lib/domain/types";

const reasons: { id: DisputeReason; label: string; detail: string }[] = [
  { id: "not_delivered", label: "Not delivered", detail: "The agreed work or item has not arrived." },
  { id: "not_as_described", label: "Not as described", detail: "What arrived is different from the order." },
  { id: "delivered_late", label: "Delivered late", detail: "The delivery missed the agreed deadline." },
  { id: "other", label: "Other", detail: "Something else happened." },
];

export function DisputeFlow({ order, milestoneId }: { order: Order; milestoneId?: string }) {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialog = useStatusDialog();
  const router = useRouter();
  const now = useCurrentTime(60_000);
  const milestone = order.milestones.find((item) => item.id === milestoneId) ?? order.milestones.find((item) => item.status === "delivered");
  const canDispute = milestone?.status === "delivered" && Boolean(milestone.releaseAt) && (!now || Date.parse(milestone.releaseAt!) > now);

  function addEvidence(type: Evidence["type"], content: string) {
    if (!content.trim() || evidence.length >= 5) return;
    setEvidence((current) => [...current, {
      id: `evi-${Date.now()}`,
      submittedBy: "buyer",
      type,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }]);
  }

  function onFile(file?: File) {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      dialog.show({ variant: "warning", title: "Choose an image or PDF.", description: "For this demo, evidence can be a JPG, PNG, WebP or PDF file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      dialog.show({ variant: "warning", title: "This file is too large.", description: "Choose a file smaller than 5 MB." });
      return;
    }
    addEvidence("file", file.name);
  }

  async function submit() {
    if (!reason || !milestone || note.trim().length < 20) return;
    setSubmitting(true);
    try {
      await openDispute({ token: order.token, milestoneId: milestone.id, reason, note: note.trim(), evidence });
      dialog.show({
        variant: "success",
        title: "Your dispute is open.",
        description: "Your money stays frozen. The seller has 48 hours to respond.",
        primaryAction: { label: "View order", onClick: () => router.push(`/pay/${order.token}`) },
      });
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
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ps-grey-600)]">Dispute · {step + 1} of 4</p>
        <h1 className="font-display mt-2 text-4xl">Let&apos;s work through this.</h1>
        <p className="mt-2 text-[var(--ps-grey-600)]">Order: {order.title}</p>
        {!canDispute ? (
          <div className="surface-card mt-7 p-6"><h2 className="text-xl">A dispute is not available for this delivery.</h2><p className="mt-2 text-sm leading-6 text-[var(--ps-grey-600)]">You can open a dispute only while a delivery is under review and before the release time. If the seller missed the delivery deadline, contact support to request a refund.</p><Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-4" href={`/pay/${order.token}`}>Return to order <ArrowRight size={16} /></Link></div>
        ) : (
          <section className="surface-card mt-7 p-5 sm:p-8">
            <div className="mb-7 flex gap-2" aria-label="Dispute steps">{["Reason", "Details", "Evidence", "Review"].map((item, index) => <span key={item} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[var(--ps-green-900)]" : "bg-[var(--ps-grey-200)]"}`} aria-label={item} />)}</div>
            {step === 0 ? <div><h2 className="font-display text-2xl">What went wrong?</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Choose the reason that best fits this order.</p><div className="mt-5 space-y-3">{reasons.map((item) => <button key={item.id} type="button" onClick={() => setReason(item.id)} className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-4 text-left ${reason === item.id ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : "border-[var(--ps-grey-200)]"}`}><span className={`flex size-5 items-center justify-center rounded-full border ${reason === item.id ? "border-[var(--ps-green-900)] bg-[var(--ps-green-900)] text-white" : "border-[var(--ps-grey-600)]"}`}>{reason === item.id ? <Check size={13} /> : null}</span><span><span className="block text-sm">{item.label}</span><span className="mt-1 block text-xs text-[var(--ps-grey-600)]">{item.detail}</span></span></button>)}</div></div> : null}
            {step === 1 ? <div><h2 className="font-display text-2xl">Tell us a little more.</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Share the facts and what you expected. At least 20 characters.</p><label htmlFor="dispute-note" className="mt-5 block text-sm">Your note<textarea id="dispute-note" value={note} onChange={(event) => setNote(event.target.value.slice(0, 1000))} rows={6} className="mt-2 w-full rounded-2xl border border-[var(--ps-grey-200)] p-4" placeholder="Describe what happened and what you agreed with the seller." /></label><p className="mt-2 text-right text-xs text-[var(--ps-grey-600)]">{note.length}/1000</p>{note.trim().length > 0 && note.trim().length < 20 ? <p className="mt-1 text-sm text-[var(--ps-danger)]">Please add a little more detail. {20 - note.trim().length} characters to go.</p> : null}</div> : null}
            {step === 2 ? <div><h2 className="font-display text-2xl">Add evidence (optional).</h2><p className="mt-2 text-sm text-[var(--ps-grey-600)]">Add up to five useful files or links. Images and PDFs up to 5 MB.</p><label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ps-grey-600)] bg-[var(--ps-grey-200)]/15 p-5 text-center"><Upload size={23} /><span className="mt-2 text-sm">Choose a file to attach</span><span className="mt-1 text-xs text-[var(--ps-grey-600)]">JPG, PNG, WebP or PDF</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} /></label><div className="mt-4 flex gap-2"><input aria-label="Evidence link" value={link} onChange={(event) => setLink(event.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--ps-grey-200)] px-3 text-sm" placeholder="https://..." /><button type="button" disabled={!link || evidence.length >= 5} onClick={() => { addEvidence("link", link); setLink(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50"><Link2 size={16} /> Add link</button></div><ul className="mt-4 space-y-2">{evidence.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ps-grey-200)]/30 p-3 text-sm"><span className="flex min-w-0 items-center gap-2"><FilePlus2 size={16} /><span className="truncate">{item.content}</span></span><button type="button" onClick={() => setEvidence((list) => list.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.content}`}><X size={16} /></button></li>)}</ul><p className="mt-3 text-xs text-[var(--ps-grey-600)]">{evidence.length}/5 items. Upload progress is simulated in this demo.</p></div> : null}
            {step === 3 ? <div><h2 className="font-display text-2xl">Review your dispute.</h2><div className="mt-5 space-y-4 rounded-2xl bg-[var(--ps-grey-200)]/25 p-4"><div><p className="text-xs text-[var(--ps-grey-600)]">Reason</p><p className="mt-1 text-sm">{reasons.find((item) => item.id === reason)?.label}</p></div><div><p className="text-xs text-[var(--ps-grey-600)]">Your note</p><p className="mt-1 text-sm leading-6">{note}</p></div><div><p className="text-xs text-[var(--ps-grey-600)]">Evidence</p><p className="mt-1 text-sm">{evidence.length ? evidence.map((item) => item.content).join(", ") : "No files or links added."}</p></div></div><p className="mt-5 rounded-2xl bg-[var(--ps-green-400)]/20 p-4 text-sm"><LockKeyhole className="mr-2 inline" size={16} />Your money stays frozen. The seller has 48 hours to respond.</p></div> : null}
            <div className="mt-7 flex justify-between gap-3"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || submitting} className="min-h-12 rounded-full border border-[var(--ps-grey-200)] px-5 disabled:opacity-40">Back</button>{step < 3 ? <button type="button" onClick={() => setStep((current) => Math.min(3, current + 1))} disabled={(step === 0 && !reason) || (step === 1 && note.trim().length < 20)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-40">Continue <ArrowRight size={17} /></button> : <button type="button" onClick={() => void submit()} disabled={submitting} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-50">{submitting ? "Sending…" : "Submit dispute"} <ArrowRight size={17} /></button>}</div>
            <div className="mt-5"><ApiPlaceholder endpoint="POST /api/pay/:token/dispute" /></div>
          </section>
        )}
      </div>
    </main>
  );
}
