import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export function InvalidPaymentLink() {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--ps-grey-200)]/15">
      <header className="border-b border-[var(--ps-grey-200)] bg-white px-5 py-4">
        <div className="mx-auto max-w-5xl"><Logo /></div>
      </header>
      <section className="mx-auto my-auto w-full max-w-xl px-5 py-12">
        <div className="surface-card p-7 text-center sm:p-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--ps-grey-200)]/45"><AlertCircle size={26} /></span>
          <h1 className="font-display mt-5 text-3xl">This payment link isn&apos;t available.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ps-grey-600)]">It may have expired, been cancelled, or the address may be incorrect. Check the link with the person who shared it with you.</p>
          <Link href="/" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 text-sm"><ArrowLeft size={16} /> Go to PaySafr</Link>
        </div>
      </section>
      <p className="pb-6 text-center text-xs text-[var(--ps-grey-600)]">Never transfer money using a link you don&apos;t trust.</p>
    </main>
  );
}
