import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BellRing,
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  Flag,
  LockKeyhole,
  Mail,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { FeeCalculator } from "@/components/marketing/fee-calculator";
import { FaqList } from "@/components/marketing/faq-list";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { SafrPills } from "@/components/brand/safr-pills";
import { formatNaira } from "@/lib/format/money";

const problems = [
  { icon: <Wallet />, title: "Work gets done before payment is clear.", copy: "Freelancers should not have to chase money after delivery." },
  { icon: <ShieldCheck />, title: "Paying a new seller can feel risky.", copy: "Buyers need a clear next step if a deal goes wrong." },
  { icon: <Banknote />, title: "A screenshot is not a payment.", copy: "Sellers deserve to rely on verified bank confirmation." },
  { icon: <FileCheck2 />, title: "Good records should come standard.", copy: "Orders, receipts and delivery details belong in one place." },
];

const featureCards = [
  { icon: <Layers3Icon />, title: "Milestones", copy: "Break a larger project into clear delivery steps." },
  { icon: <MessageCircle />, title: "Easy payment links", copy: "Share one clear order page in the places you already chat." },
  { icon: <BellRing />, title: "Review reminders", copy: "Buyers get time to review before auto-release." },
  { icon: <Flag />, title: "Fair dispute flow", copy: "Both sides can share evidence while funds stay on hold." },
  { icon: <FileCheck2 />, title: "Receipts and invoices", copy: "Keep tidy records for every payment and release." },
  { icon: <BadgeCheck />, title: "Trust built on real work", copy: "A seller profile grows with completed orders and delivery history." },
  { icon: <ArrowDownRight />, title: "Income history", copy: "See what is held, released and paid out over time." },
];

function Layers3Icon() {
  return <BookOpenCheck aria-hidden="true" />;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ps-green-900)]">{children}</span>;
}

function SectionHeading({ tag, title, copy }: { tag: string; title: string; copy?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Tag>{tag}</Tag>
      <h2 className="font-display mt-5 text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl">{title}</h2>
      {copy ? <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--ps-grey-600)]">{copy}</p> : null}
    </div>
  );
}

export default function Home() {
  const showSocialProof = process.env.NEXT_PUBLIC_SHOW_SOCIAL_PROOF === "true";

  return (
    <MarketingShell>
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-16 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-8 md:pt-20 md:pb-24">
        <div className="relative z-10">
          <Tag><ShieldCheck size={14} /> Escrow for freelancers and online sellers</Tag>
          <h1 className="font-display mt-6 max-w-3xl text-[clamp(2.5rem,7vw,4.75rem)] leading-[1.02] tracking-[-0.03em]">Work delivered.<br className="hidden sm:block" /> Payments secured.</h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-[var(--ps-grey-600)] sm:text-xl">
            Get paid without chasing. Pay without worrying. PaySafr holds the money safely until the work is done.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/get-started" className="inline-flex min-h-14 items-center gap-3 rounded-full bg-[var(--ps-green-400)] px-6 text-[var(--ps-green-900)]">
              Get Started <span className="flex size-8 items-center justify-center rounded-full bg-[var(--ps-green-900)] text-[var(--ps-green-400)]"><ArrowRight size={17} /></span>
            </Link>
            <Link href="/how-it-works" className="inline-flex min-h-14 items-center rounded-full border border-[var(--ps-green-900)] px-6">See how it works</Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[var(--ps-grey-600)]">
            <span className="inline-flex items-center gap-2"><Check size={16} /> No signup for buyers</span>
            <span className="inline-flex items-center gap-2"><Check size={16} /> Pay from any bank</span>
            <span className="inline-flex items-center gap-2"><Check size={16} /> Money held safely</span>
          </div>
          <div className="mt-6"><PoweredByPaga /></div>
        </div>
        <div className="brand-glow relative min-h-[440px] overflow-hidden rounded-[32px] p-5 text-white sm:p-8">
          <div className="absolute -top-20 right-2 size-72 rounded-full border border-[var(--ps-green-400)]/20" />
          <div className="absolute top-0 right-12 size-52 rounded-full border border-[var(--ps-green-400)]/10" />
          <div className="relative mx-auto max-w-[330px] rounded-[30px] border border-white/20 bg-[var(--ps-green-800)] p-5 shadow-2xl sm:mt-8">
            <div className="flex items-center justify-between"><Logo tone="on-dark" /><span className="rounded-full bg-[var(--ps-green-400)] px-3 py-1 text-xs text-[var(--ps-green-900)]">Protected</span></div>
            <div className="mt-6 rounded-2xl bg-white p-5 text-[var(--ps-green-900)]">
              <p className="text-xs text-[var(--ps-grey-600)]">Payment link</p>
              <h2 className="mt-2 text-lg">Logo design for Zuri</h2>
              <p className="money mt-2 text-3xl">{formatNaira(15_000_000)}</p>
              <div className="mt-4 flex items-center gap-3 border-t border-[var(--ps-grey-200)] pt-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-[var(--ps-green-900)] text-white">TA</span>
                <span className="flex-1"><span className="block text-sm">Tolu A.</span><span className="text-xs text-[var(--ps-grey-600)]">Graphic designer</span></span>
                <span className="rounded-full bg-[var(--ps-green-400)]/30 px-2 py-1 text-xs">Trusted · 78</span>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--ps-green-400)]/20 p-3 text-sm"><ShieldCheck size={18} /> Money is held safely</div>
            </div>
          </div>
          <div className="absolute top-14 left-3 hidden rounded-2xl border border-white/15 bg-[var(--ps-green-800)] p-3 shadow-xl sm:block md:left-[-18px]">
            <p className="text-xs text-white/70">Payment verified</p><p className="money mt-1 text-lg">{formatNaira(15_000_000)}</p>
          </div>
          <div className="absolute right-4 bottom-20 hidden rounded-2xl border border-white/15 bg-[var(--ps-green-800)] p-3 shadow-xl sm:block md:right-[-12px]">
            <p className="text-xs text-white/70">Released to seller</p><p className="money mt-1 text-lg">{formatNaira(7_350_000)}</p><p className="text-[10px] text-white/60">2% fee deducted</p>
          </div>
          <div className="absolute right-8 bottom-5"><SafrPills /></div>
        </div>
      </section>

      <section className="border-y border-[var(--ps-grey-200)] bg-[var(--ps-grey-200)]/15 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-4 sm:px-6 md:justify-between md:px-8">
          <p className="text-sm text-[var(--ps-grey-600)]">Share your link on</p>
          <span className="inline-flex items-center gap-2 text-sm"><MessageCircle size={18} /> WhatsApp</span>
          <span className="inline-flex items-center gap-2 text-sm"><InstagramMark /> Instagram</span>
          <span className="inline-flex items-center gap-2 text-sm"><Mail size={18} /> Email</span>
          <span className="inline-flex items-center gap-2 text-sm"><MessageSquare size={18} /> SMS</span>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <SectionHeading tag="The problem" title="Trust shouldn't be a gamble." copy="Online deals work better when everyone knows what happens next." />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((item, index) => (
            <article key={item.title} className="surface-card p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--ps-green-400)]/20">{item.icon}</span>
              <span className="mt-5 block text-xs text-[var(--ps-grey-600)]">0{index + 1}</span>
              <h3 className="mt-2 text-xl leading-tight">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--ps-grey-600)]">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[var(--ps-grey-200)]/20 px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <SectionHeading tag="How it works" title="Three steps. No signup for buyers." copy="A clear order page keeps the deal moving from payment to delivery." />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            ["01", "Create and share", "Set the amount, deadline and delivery steps. Send your payment link."],
            ["02", "Buyer pays, money is held", "The buyer transfers from any bank. We wait for bank confirmation."],
            ["03", "Deliver and get paid", "The buyer confirms delivery, or the money releases when review time ends."],
          ].map(([number, title, copy]) => (
            <article key={number} className="surface-card p-6 md:p-8">
              <span className="flex size-10 items-center justify-center rounded-full bg-[var(--ps-green-900)] text-sm text-white">{number}</span>
              <div className="mt-8 rounded-2xl bg-[var(--ps-grey-200)]/30 p-4">
                {number === "01" ? <div className="flex items-center justify-between"><span className="text-sm">Order link</span><ArrowRight size={18} /></div> : null}
                {number === "02" ? <div className="flex items-center gap-3"><Banknote /><span><span className="block text-sm">Bank transfer</span><span className="money text-xs text-[var(--ps-grey-600)]">{formatNaira(15_000_000)}</span></span></div> : null}
                {number === "03" ? <div className="flex items-center gap-3"><ShieldCheck className="text-[var(--ps-green-900)]" /><span className="text-sm">Funds released safely</span></div> : null}
              </div>
              <h3 className="mt-5 text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--ps-grey-600)]">{copy}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5">
          <div><p className="text-sm text-[var(--ps-grey-600)]">Choose your example</p><div className="mt-2 flex gap-2"><span className="rounded-full bg-[var(--ps-green-400)] px-4 py-1.5 text-sm">Freelancer · Logo project</span><span className="rounded-full border border-[var(--ps-grey-200)] px-4 py-1.5 text-sm">Vendor · Shoes</span></div></div>
          <p className="money text-xl">{formatNaira(15_000_000)} · 2 milestones</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <SectionHeading tag="Built for real work" title="Everything for a clearer deal." copy="Thoughtful tools for payment, delivery and the moments in between." />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((item, index) => (
            <article key={item.title} className={`surface-card p-6 ${index === 0 || index === 4 ? "lg:col-span-2" : ""} ${index === 2 ? "bg-[var(--ps-green-900)] text-white" : ""}`}>
              <span className={`flex size-11 items-center justify-center rounded-2xl ${index === 2 ? "bg-white/10" : "bg-[var(--ps-green-400)]/20"}`}>{item.icon}</span>
              <h3 className="mt-5 text-xl">{item.title}</h3><p className={`mt-2 max-w-md text-sm leading-6 ${index === 2 ? "text-white/70" : "text-[var(--ps-grey-600)]"}`}>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 md:px-8 md:pb-24">
        <div className="brand-glow mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[32px] p-7 text-white sm:p-10 md:grid-cols-[0.7fr_1.3fr] md:items-center md:p-14">
          <div className="flex justify-center">
            <div className="relative flex size-48 items-center justify-center rounded-full border-[10px] border-[var(--ps-green-400)]/25">
              <div className="absolute inset-0 rounded-full border-[10px] border-[var(--ps-green-400)] border-r-transparent" />
              <div className="text-center"><p className="money text-4xl">78</p><p className="text-sm text-white/70">Trusted</p></div>
            </div>
          </div>
          <div>
            <Tag>Trust score</Tag>
            <h2 className="font-display mt-5 text-4xl">Built from work, not promises.</h2>
            <p className="mt-4 max-w-2xl text-white/75">New sellers are shown as “New seller”, never as a zero. Your score is built only from real, completed orders. It cannot be bought or edited.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-white/20 px-3 py-1">New</span><span className="rounded-full border border-white/20 px-3 py-1">Rising</span><span className="rounded-full bg-[var(--ps-green-400)] px-3 py-1 text-[var(--ps-green-900)]">Trusted</span><span className="rounded-full border border-white/20 px-3 py-1">Verified</span></div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ps-grey-200)]/20 px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <Tag>Our promise</Tag><h2 className="font-display mt-5 text-4xl leading-tight">Security in plain words.</h2>
            <p className="mt-4 text-[var(--ps-grey-600)]">No guesswork. Every step has a clear record and a clear next action.</p>
            <div className="mt-6"><PoweredByPaga variant="card" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [<LockKeyhole key="a" />, "Money is held before work starts."],
              [<Clock3 key="b" />, "Released when you confirm, or when time runs out with no dispute."],
              [<FileCheck2 key="c" />, "Every step is recorded."],
              [<BadgeCheck key="d" />, "A payment counts only when the bank confirms it."],
            ].map(([icon, text]) => <div key={String(text)} className="surface-card flex items-start gap-3 p-5"><span className="mt-0.5 text-[var(--ps-green-900)]">{icon}</span><p className="text-sm leading-6">{text}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><Tag>Clear pricing</Tag><h2 className="font-display mt-4 text-4xl">One small fee per order.</h2><p className="mt-3 text-[var(--ps-grey-600)]">Paid by the seller by default. No hidden surprises.</p></div>
          <Link href="/pricing" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-4 text-sm">See pricing <ChevronRight size={16} /></Link>
        </div>
        <FeeCalculator />
      </section>

      {showSocialProof ? (
        <section className="px-4 py-16 sm:px-6 md:px-8"><div className="mx-auto max-w-7xl rounded-[32px] bg-[var(--ps-green-900)] p-8 text-white"><Tag>Sample</Tag><h2 className="font-display mt-5 text-4xl">A calmer way to work together.</h2><p className="mt-2 text-white/70">Sample content for layout review only. Not a real customer quote.</p></div></section>
      ) : null}

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <SectionHeading tag="FAQs" title="You have questions. We have answers." />
        <FaqList limit={6} />
        <div className="mt-6 text-center"><Link href="/faqs" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-5 text-sm">View all FAQs <ArrowRight size={16} /></Link></div>
      </section>

      <section className="px-4 pb-4 sm:px-6 md:px-8">
        <div className="mx-auto max-w-7xl rounded-[32px] bg-[var(--ps-green-400)] px-6 py-10 text-center text-[var(--ps-green-900)] sm:py-14">
          <SafrPills />
          <h2 className="font-display mx-auto mt-6 max-w-3xl text-4xl leading-tight sm:text-5xl">Work delivered. Payments secured.</h2>
          <p className="mx-auto mt-3 max-w-xl">Make your next online deal feel clearer for everyone.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/get-started" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-900)] px-5 text-white">Get Started <ArrowRight size={16} /></Link><Link href="/sign-in" className="inline-flex min-h-12 items-center rounded-full border border-[var(--ps-green-900)] px-5">Sign In</Link></div>
          <span className="sr-only"><Smartphone /> <CircleHelp /></span>
        </div>
      </section>
    </main>
    </MarketingShell>
  );
}

function InstagramMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" /></svg>;
}
