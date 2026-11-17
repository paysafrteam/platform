import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { SafrPills } from "@/components/brand/safr-pills";

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Link className="text-sm underline" href="/">
        PaySafr home
      </Link>
      <p className="mt-10 text-xs font-semibold tracking-[0.14em] text-[var(--ps-grey-600)] uppercase">
        Development only · UI foundations
      </p>
      <h1 className="font-display mt-2 text-5xl">Component gallery</h1>
      <section className="surface-card mt-8 space-y-8 p-6">
        <div>
          <h2 className="mb-4 text-lg">Brand</h2>
          <div className="flex flex-wrap items-center gap-8">
            <Logo />
            <span className="brand-glow rounded-2xl p-4">
              <Logo tone="on-dark" />
            </span>
            <SafrPills />
            <PoweredByPaga />
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-lg">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--ps-green-400)] px-5 text-[var(--ps-green-900)]">
              Primary action{" "}
              <span className="rounded-full bg-[var(--ps-green-900)] p-1.5 text-white">
                <ArrowUpRight size={16} />
              </span>
            </button>
            <button className="min-h-12 rounded-full border border-[var(--ps-green-900)] px-5">
              Secondary
            </button>
            <button className="min-h-12 rounded-full border border-[var(--ps-grey-200)] px-5 text-[var(--ps-grey-600)]">
              Quiet action
            </button>
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-lg">Input and feedback</h2>
          <label className="block max-w-sm text-sm" htmlFor="sample-email">
            Email address
            <input
              id="sample-email"
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--ps-grey-200)] px-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-green-400)]"
              placeholder="name@example.com"
              type="email"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-[var(--ps-green-400)] px-3 py-1 text-sm text-[var(--ps-green-900)]">
              <Check className="mr-1 inline" size={14} />
              Money held safely
            </span>
            <span className="rounded-full border border-[var(--ps-grey-600)] px-3 py-1 text-sm">
              <ShieldCheck className="mr-1 inline" size={14} />
              Protected
            </span>
            <span className="rounded-full bg-[var(--ps-grey-200)]/40 px-3 py-1 text-sm text-[var(--ps-grey-600)]">
              <CircleAlert className="mr-1 inline" size={14} />
              Waiting for payment
            </span>
            <span className="rounded-full bg-[var(--ps-grey-200)]/40 px-3 py-1 font-mono text-xs">
              <Plug className="mr-1 inline" size={12} />
              API placeholder
            </span>
          </div>
        </div>
        <div className="surface-card max-w-sm p-5">
          <p className="text-sm text-[var(--ps-grey-600)]">Order total</p>
          <p className="money mt-1 text-3xl">₦150,000</p>
          <p className="mt-2 text-sm">Logo design for Zuri</p>
        </div>
      </section>
    </main>
  );
}
