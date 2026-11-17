"use client";

import { ExternalLink, FilePlus2, Flag, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { CopyField } from "@/components/ui/copy-field";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareActions } from "@/components/share/share-actions";
import { addSellerEvidence, cancelOrder, deliverMilestone, openSellerDispute, publishOrder } from "@/lib/api";
import { formatLagosDate } from "@/lib/format/dates";
import type { DisputeSummary, SellerOrder } from "@/lib/domain/types";

const reasonLabel = { not_delivered: "Not delivered", not_as_described: "Not as described", delivered_late: "Delivered late", other: "Other" } as const;
const field = "mt-2 w-full rounded-xl border border-[var(--ps-grey-200)] p-3 text-sm";

export function OrderDetail({ order, onChange }: { order: SellerOrder; onChange: (o: SellerOrder) => void }) {
  const dialog = useStatusDialog();
  const [origin, setOrigin] = useState("");
  const [kind, setKind] = useState<"note" | "link">("note");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setOrigin(window.location.origin), 0); return () => window.clearTimeout(t); }, []);

  const payPath = `/pay/${order.token}`;
  const live = order.status !== "draft";
  const nextPending = order.status === "funded" ? order.milestones.find((m) => m.status === "pending") : undefined;
  const nothingDelivered = !order.milestones.some((m) => m.status === "delivered" || m.status === "disputed");
  const redeliver = order.status === "funded" ? order.milestones.find((m) => m.status === "delivered" && m.changeRequestCount > 0) : undefined;
  const target = redeliver ?? (nothingDelivered ? nextPending : undefined);

  async function run<T>(fn: () => Promise<T>, failTitle: string, ok?: (r: T) => void) {
    setBusy(true);
    try { const r = await fn(); ok?.(r); }
    catch (e) { dialog.show({ variant: "danger", title: failTitle, description: e instanceof Error ? e.message : "Try again.", primaryAction: { label: "Close" } }); }
    finally { setBusy(false); }
  }

  const publish = () => run(() => publishOrder(order.id), "We couldn't publish this order.", (o) => { onChange(o); toast.success("Order published. Share the link with your buyer."); });
  const cancel = async () => {
    const yes = await dialog.confirm({ variant: "danger", title: "Cancel this unpaid order?", description: "The payment link will stop working.", primaryAction: { label: "Cancel order" }, secondaryAction: { label: "Keep order" } });
    if (yes) await run(() => cancelOrder(order.id), "We couldn't cancel the order.", (o) => { onChange(o); toast.success("Order cancelled."); });
  };
  const deliver = () => {
    if (!target) return;
    return run(() => deliverMilestone(order.id, target.id, { kind, content: proof.trim() }), "We couldn't mark this as delivered.", (o) => {
      onChange(o); setProof("");
      dialog.show({ variant: "success", title: redeliver ? "Updated delivery sent." : "Delivery marked.", description: "The buyer has been notified and their review window has started.", primaryAction: { label: "Done" } });
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-5">
        <section className="surface-card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs text-[var(--ps-grey-600)]">Order {order.id.slice(0, 8)}</p><h2 className="font-display mt-2 text-2xl">{order.title}</h2></div>
            <StatusBadge status={order.status} />
          </div>
          {order.description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ps-grey-600)]">{order.description}</p> : null}
          <div className="mt-5 grid gap-3 border-t border-[var(--ps-grey-200)] pt-5 sm:grid-cols-4">
            <div><p className="text-xs text-[var(--ps-grey-600)]">Total</p><p className="mt-1"><Money kobo={order.totalKobo} /></p></div>
            <div><p className="text-xs text-[var(--ps-grey-600)]">PaySafr fee (you pay)</p><p className="mt-1"><Money kobo={order.feeKobo} /></p></div>
            <div><p className="text-xs text-[var(--ps-grey-600)]">Delivery deadline</p><p className="mt-1 text-sm">{formatLagosDate(order.deliveryDeadline)}</p></div>
            <div><p className="text-xs text-[var(--ps-grey-600)]">Review window</p><p className="mt-1 text-sm">{order.reviewWindowHours} hours</p></div>
          </div>
          {order.amountFundedKobo > 0 && order.status === "awaiting_payment" ? <p className="mt-4 rounded-xl bg-[var(--ps-warning)]/15 p-3 text-sm">Part-paid: <Money kobo={order.amountFundedKobo} /> of <Money kobo={order.totalKobo} /> received.</p> : null}
          {order.needsRefundFlag ? <p className="mt-4 rounded-xl bg-[var(--ps-warning)]/15 p-3 text-sm">Extra money arrived on this order. PaySafr will refund the buyer.</p> : null}
        </section>

        <section className="surface-card p-5 sm:p-7">
          <h2 className="font-display text-xl">Milestones</h2>
          <div className="mt-4 space-y-3">
            {order.milestones.map((m) => (
              <div key={m.id} className="rounded-xl bg-[var(--ps-grey-200)]/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm">{m.position}. {m.title}</p><p className="mt-1 text-sm"><Money kobo={m.amountKobo} /></p></div>
                  <StatusBadge status={m.status} />
                </div>
                {m.proof ? <p className="mt-3 break-all text-xs text-[var(--ps-grey-600)]">Your proof ({m.proof.kind}): {m.proof.content}</p> : null}
                {m.status === "delivered" && m.releaseAt ? <p className="mt-2 text-xs text-[var(--ps-grey-600)]">Auto-releases {formatLagosDate(m.releaseAt)} unless the buyer responds.</p> : null}
                {m.payoutStatus ? <p className="mt-2 text-xs text-[var(--ps-grey-600)]">Payout: {m.payoutStatus}</p> : null}
                {m.changeRequests.map((c) => <p key={c.id} className="mt-2 rounded-lg bg-[var(--ps-warning)]/15 p-2 text-xs">Buyer asked for changes ({formatLagosDate(c.createdAt)}): {c.note}</p>)}
                {order.status === "funded" && m.status === "delivered" ? <OpenDispute orderId={order.id} milestoneId={m.id} onDone={(o) => onChange(o)} /> : null}
              </div>
            ))}
          </div>
        </section>

        {order.disputes.length ? (
          <section className="surface-card p-5 sm:p-7">
            <h2 className="font-display text-xl">Disputes</h2>
            <div className="mt-4 space-y-4">{order.disputes.map((d) => <DisputeCard key={d.id} orderId={order.id} dispute={d} evidence={order.evidence[d.id] ?? []} onSaved={onChange} />)}</div>
          </section>
        ) : null}
      </div>

      <aside className="space-y-4">
        {live && order.status !== "cancelled" && order.status !== "expired" ? (
          <section className="surface-card p-5">
            <h2 className="font-display text-xl">Share with your buyer</h2>
            <div className="mt-3"><CopyField label="Payment link" value={`${origin}${payPath}`} /></div>
            <div className="mt-3"><ShareActions kind="link" copyUrl={payPath} shareText={`Pay for "${order.title}" safely with PaySafr:`} /></div>
            {order.status === "awaiting_payment" && order.orderAccount ? <p className="mt-3 text-xs text-[var(--ps-grey-600)]">Order account: {order.orderAccount.bankName} · {order.orderAccount.accountNumber}. Expires {formatLagosDate(order.orderAccount.expiresAt)}.</p> : null}
          </section>
        ) : null}

        <section className="surface-card p-5">
          <h2 className="font-display text-xl">Next step</h2>
          {order.status === "draft" ? <button type="button" disabled={busy} onClick={() => void publish()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--ps-green-400)] disabled:opacity-50"><Send size={16} /> Publish order</button> : null}
          {target ? (
            <>
              <p className="mt-3 text-sm">{redeliver ? `Send an updated delivery for “${target.title}”.` : `Deliver “${target.title}”.`}</p>
              <div className="mt-3 flex gap-2">{(["note", "link"] as const).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`min-h-10 rounded-full border px-4 text-sm ${kind === k ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/20" : "border-[var(--ps-grey-200)]"}`}>{k === "note" ? "Note" : "Link"}</button>)}</div>
              <textarea value={proof} onChange={(e) => setProof(e.target.value)} rows={4} className={field} placeholder={kind === "link" ? "https://… link to your files" : "Describe what you delivered."} aria-label="Delivery proof" />
              <button type="button" disabled={busy || !proof.trim()} onClick={() => void deliver()} className="mt-4 min-h-11 w-full rounded-full bg-[var(--ps-green-400)] disabled:opacity-50">{redeliver ? "Send updated delivery" : "Mark as delivered"}</button>
            </>
          ) : null}
          {order.status === "awaiting_payment" || order.status === "draft" ? <button type="button" disabled={busy} onClick={() => void cancel()} className="mt-3 min-h-11 w-full rounded-full border border-[var(--ps-grey-200)] disabled:opacity-50">Cancel unpaid order</button> : null}
          {order.status === "awaiting_payment" ? <p className="mt-3 text-sm text-[var(--ps-grey-600)]">Waiting for your buyer to pay. You will be notified the moment the money is held.</p> : null}
          {order.status === "funded" && !target ? <p className="mt-3 text-sm text-[var(--ps-grey-600)]">No action needed right now. The buyer is reviewing, or a dispute is open.</p> : null}
          {order.status === "completed" || order.status === "expired" || order.status === "cancelled" ? <p className="mt-3 text-sm text-[var(--ps-grey-600)]">This order is closed.</p> : null}
          {live ? <Link href={payPath} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm underline"><ExternalLink size={16} /> View buyer page</Link> : null}
          {live ? <Link href={`/i/${order.token}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 text-sm underline"><FilePlus2 size={16} /> View invoice</Link> : null}
        </section>

        {order.receipts.length ? (
          <section className="surface-card p-5"><h2 className="font-display text-xl">Receipts</h2><ul className="mt-3 space-y-2 text-sm">{order.receipts.map((r) => <li key={r.publicToken}><Link className="underline" href={`/r/${r.publicToken}`} target="_blank">{r.number}</Link> <span className="text-[var(--ps-grey-600)]">· {r.type}</span></li>)}</ul></section>
        ) : null}
      </aside>
    </div>
  );
}

function OpenDispute({ orderId, milestoneId, onDone }: { orderId: string; milestoneId: string; onDone: (o: SellerOrder) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs underline"><Flag size={14} /> Open a dispute</button>;
  async function go() {
    setBusy(true);
    try {
      await openSellerDispute(orderId, { milestoneId, reason: "other", note: note.trim() });
      const { getOrder } = await import("@/lib/api");
      onDone(await getOrder(orderId));
      toast.success("Dispute opened. The money is frozen.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "We couldn't open the dispute."); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={field} placeholder="Explain the problem (at least 20 characters)." aria-label="Dispute note" />
      <div className="mt-2 flex gap-2"><button type="button" disabled={busy || note.trim().length < 20} onClick={() => void go()} className="min-h-10 rounded-full bg-[var(--ps-green-400)] px-4 text-sm disabled:opacity-50">Open dispute</button><button type="button" onClick={() => setOpen(false)} className="min-h-10 px-3 text-sm underline">Cancel</button></div>
    </div>
  );
}

const outcomeText = { release_to_seller: "Released to you", refund_to_buyer: "Refunded to the buyer", split: "Split between you and the buyer" } as const;

function DisputeCard({ orderId, dispute, evidence, onSaved }: { orderId: string; dispute: DisputeSummary; evidence: SellerOrder["evidence"][string]; onSaved: (o: SellerOrder) => void }) {
  const [type, setType] = useState<"text" | "link">("text");
  const [content, setContent] = useState("");
  const resolved = dispute.status === "resolved";
  async function add() {
    try {
      await addSellerEvidence(orderId, dispute.id, { type, content: content.trim() });
      const { getOrder } = await import("@/lib/api");
      onSaved(await getOrder(orderId)); setContent(""); toast.success("Evidence added.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "We couldn't save that."); }
  }
  return (
    <article className="rounded-2xl border border-[var(--ps-grey-200)] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{dispute.number} · {reasonLabel[dispute.reason]}</strong><StatusBadge status={dispute.status} /></div>
      <p className="mt-2 leading-6">{dispute.note}</p>
      <p className="mt-1 text-xs text-[var(--ps-grey-600)]">Opened by the {dispute.openedBy} · {resolved ? `decided ${formatLagosDate(dispute.resolvedAt!)}` : `respond by ${formatLagosDate(dispute.responseDueAt)}`}</p>
      {resolved ? <div className="mt-3 rounded-xl bg-[var(--ps-green-400)]/15 p-3"><p>Outcome: <strong>{dispute.outcome ? outcomeText[dispute.outcome] : ""}</strong></p>{dispute.decisionReason ? <p className="mt-1">Reason: {dispute.decisionReason}</p> : null}</div> : null}
      {evidence.length ? <ul className="mt-3 space-y-1 text-xs">{evidence.map((e) => <li key={e.id} className="rounded-lg bg-[var(--ps-grey-200)]/25 p-2"><span className="uppercase text-[var(--ps-grey-600)]">{e.submittedBy}</span> · <span className="break-all">{e.content}</span></li>)}</ul> : null}
      {!resolved ? (
        <div className="mt-3">
          <div className="flex gap-2">{(["text", "link"] as const).map((k) => <button key={k} type="button" onClick={() => setType(k)} className={`min-h-9 rounded-full border px-3 text-xs ${type === k ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/20" : "border-[var(--ps-grey-200)]"}`}>{k === "text" ? "Note" : "Link"}</button>)}</div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className={field} placeholder={type === "link" ? "https://…" : "Add your side of the story or a detail."} aria-label="Evidence" />
          <button type="button" disabled={!content.trim()} onClick={() => void add()} className="mt-2 min-h-10 rounded-full border border-[var(--ps-green-900)] px-4 text-sm disabled:opacity-50">Add evidence</button>
        </div>
      ) : null}
    </article>
  );
}
