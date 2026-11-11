import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Check,
  Clock3,
  FileCheck2,
  LockKeyhole,
} from "lucide-react";
import { FeeCalculator } from "@/components/marketing/fee-calculator";
import { FaqList } from "@/components/marketing/faq-list";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { ContactForm as ContactFormPanel } from "@/components/marketing/contact-form";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";

type MarketingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  kind: "how" | "pricing" | "faqs" | "security" | "contact" | "legal";
};

const steps = [
  ["Create your order", "Add a clear title, amount, delivery deadline and review window."],
  ["Share your payment link", "Send the link by WhatsApp, email, Instagram or SMS."],
  ["Buyer reviews the order", "The buyer checks the seller, terms and amount before paying."],
  ["Buyer transfers the exact amount", "They pay from any Nigerian bank or wallet to the order account."],
  ["Bank confirms the payment", "A screenshot is not enough. We wait for provider confirmation."],
  ["Money is held safely", "The buyer sees a clear payment receipt and progress timeline."],
  ["Seller delivers the work or item", "For larger projects, each milestone is delivered separately."],
  ["Buyer reviews the delivery", "The buyer can confirm, ask for a change or open a dispute."],
  ["Seller is paid", "Funds are released on confirmation or after review time ends with no dispute."],
  ["Both sides keep a record", "Receipts, order details and updates stay easy to find."],
];

export function MarketingPage({ eyebrow, title, description, kind }: MarketingPageProps) {
  return (
    <MarketingShell>
      <main>
        <section className="px-5 py-16 text-center sm:px-8 md:py-24">
          <div className="mx-auto max-w-4xl">
            <span className="rounded-full bg-[var(--ps-green-400)]/20 px-4 py-2 text-sm">{eyebrow}</span>
            <h1 className="font-display mt-6 text-5xl leading-[1.05] tracking-[-0.03em] sm:text-6xl">{title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--ps-grey-600)]">{description}</p>
          </div>
        </section>

        {kind === "how" ? (
          <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 md:grid-cols-[1fr_0.7fr] md:px-8">
            <ol className="space-y-4">
              {steps.map(([heading, copy], index) => (
                <li key={heading} className="surface-card flex gap-4 p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ps-green-900)] text-sm text-white">{String(index + 1).padStart(2, "0")}</span>
                  <div><h2 className="text-lg">{heading}</h2><p className="mt-1 text-sm leading-6 text-[var(--ps-grey-600)]">{copy}</p></div>
                </li>
              ))}
            </ol>
            <aside className="h-fit space-y-4 md:sticky md:top-24">
              <div className="surface-card p-6"><h2 className="font-display text-2xl">If something goes wrong</h2><p className="mt-3 text-sm leading-6 text-[var(--ps-grey-600)]">Open a dispute before the review period ends. The money remains held while both sides share evidence and an admin records a written decision.</p><Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-4" href="/faqs">Read dispute FAQs <ArrowRight size={16} /></Link></div>
              <div className="surface-card p-6"><h2 className="text-lg">Typical timing</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-[var(--ps-grey-600)]">Unpaid link expiry</dt><dd>48 hours</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--ps-grey-600)]">Buyer review</dt><dd>72 hours by default</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--ps-grey-600)]">Dispute response</dt><dd>48 hours</dd></div></dl></div>
            </aside>
          </section>
        ) : null}

        {kind === "pricing" ? (
          <section className="mx-auto max-w-5xl px-5 pb-16 md:px-8">
            <div className="surface-card mb-8 grid gap-5 p-6 sm:grid-cols-3">
              {[
                ["Buyer pays", "The order amount, no added buyer fee in this example."],
                ["PaySafr fee", "Provisional example rate is 2% of each release."],
                ["Seller receives", "The remaining amount after the fee is deducted."],
              ].map(([label, copy]) => <div key={label}><h2 className="text-lg">{label}</h2><p className="mt-2 text-sm leading-6 text-[var(--ps-grey-600)]">{copy}</p></div>)}
            </div>
            <FeeCalculator />
            <p className="mt-3 text-xs text-[var(--ps-grey-600)]">Final fee to be confirmed. This calculator is an example, not a binding offer.</p>
            <div className="mt-10"><FaqList limit={3} /></div>
          </section>
        ) : null}

        {kind === "faqs" ? (
          <section className="mx-auto max-w-4xl px-5 pb-20 md:px-8"><FaqList /></section>
        ) : null}

        {kind === "security" ? (
          <section className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [<LockKeyhole key="a" />, "Money is held before work starts."],
                [<Clock3 key="b" />, "Released after confirmation or an undisputed review window."],
                [<FileCheck2 key="c" />, "Every order and payment step is recorded."],
                [<Banknote key="d" />, "A payment counts only when the bank confirms it."],
              ].map(([icon, text]) => <article key={String(text)} className="surface-card flex items-start gap-4 p-6"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ps-green-400)]/20">{icon}</span><p className="text-lg">{text}</p></article>)}
            </div>
            <div className="mt-10 rounded-[32px] bg-[var(--ps-green-900)] p-7 text-white sm:p-10"><h2 className="font-display text-3xl">What we never do</h2><ul className="mt-5 grid gap-3 text-sm text-white/80 sm:grid-cols-3"><li><Check className="mr-2 inline text-[var(--ps-green-400)]" size={16} />Store card details</li><li><Check className="mr-2 inline text-[var(--ps-green-400)]" size={16} />Trust a payment screenshot</li><li><Check className="mr-2 inline text-[var(--ps-green-400)]" size={16} />Share your data</li></ul><div className="mt-6"><PoweredByPaga variant="card" tone="on-dark" /></div></div>
          </section>
        ) : null}

        {kind === "contact" ? <ContactSection /> : null}
        {kind === "legal" ? <LegalCopy title={title} /> : null}

        <section className="px-5 pb-8 md:px-8"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 rounded-[32px] bg-[var(--ps-green-400)] p-7 text-center text-[var(--ps-green-900)] sm:flex-row sm:text-left sm:p-10"><div><h2 className="font-display text-3xl">Work delivered. Payments secured.</h2><p className="mt-2">Start with a clearer, safer online deal.</p></div><Link href="/get-started" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-900)] px-5 text-white">Get Started <ArrowRight size={16} /></Link></div></section>
      </main>
    </MarketingShell>
  );
}

function ContactSection() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 md:grid-cols-[1fr_0.7fr] md:px-8">
      <ContactFormPanel />
      <aside className="space-y-3">
        <div className="surface-card p-5"><p className="text-xs text-[var(--ps-grey-600)]">X</p><p className="mt-1">@usepaysafr</p></div>
        <div className="surface-card p-5"><p className="text-xs text-[var(--ps-grey-600)]">Instagram</p><p className="mt-1">@usepaysafr</p></div>
        <div className="surface-card p-5"><p className="text-xs text-[var(--ps-grey-600)]">Website</p><p className="mt-1">usepaysafr.com</p></div>
      </aside>
    </section>
  );
}

function LegalCopy({ title }: { title: string }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 md:grid-cols-[220px_1fr] md:px-8">
      <nav className="surface-card h-fit p-5"><h2 className="text-sm">On this page</h2><ul className="mt-3 space-y-2 text-sm text-[var(--ps-grey-600)]"><li><a href="#overview">Overview</a></li><li><a href="#payments">Payments</a></li><li><a href="#disputes">Disputes</a></li><li><a href="#contact">Contact</a></li></ul></nav>
      <article className="surface-card space-y-8 p-6 sm:p-9">
        {[["overview", "Overview"], ["payments", "Payments and releases"], ["disputes", "Disputes and refunds"], ["contact", "Questions"]].map(([id, heading]) => <section key={id} id={id}><h2 className="font-display text-2xl">{heading}</h2><p className="mt-3 text-sm leading-7 text-[var(--ps-grey-600)]">[LEGAL COPY TBC] This page is a placeholder for PaySafr&apos;s {title.toLowerCase()} and should be replaced with reviewed legal copy before launch. The examples on this site are mock data and do not describe an active financial service.</p></section>)}
      </article>
    </section>
  );
}
