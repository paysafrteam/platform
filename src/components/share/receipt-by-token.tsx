"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";
import { SkeletonCard } from "@/components/feedback/states";
import { ReceiptTemplate } from "@/components/share/receipt-template";
import { getBuyerReceipt } from "@/lib/api";
import type { PublicReceipt } from "@/lib/domain/types";

export function ReceiptByToken({ token }: { token: string }) {
  const [receipts, setReceipts] = useState<PublicReceipt[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getBuyerReceipt(token).then((r) => { if (!cancelled) { setReceipts(r.receipts); setLoaded(true); } }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [token]);
  if (!loaded) return <main className="mx-auto max-w-2xl px-5 py-12"><SkeletonCard /></main>;
  if (!receipts) return <InvalidPaymentLink />;
  if (!receipts.length)
    return (
      <main className="mx-auto max-w-xl px-5 py-12">
        <div className="surface-card p-6">
          <h1 className="font-display text-2xl">Your receipt is not ready yet.</h1>
          <p className="mt-2 text-sm text-[var(--ps-grey-600)]">A receipt appears after the bank confirms payment.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center underline" href={`/pay/${token}`}>Return to payment</Link>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        {[...receipts].reverse().map((r) => <ReceiptTemplate key={r.token} receipt={r} publicUrl={`/r/${encodeURIComponent(r.token)}`} />)}
      </div>
    </main>
  );
}
