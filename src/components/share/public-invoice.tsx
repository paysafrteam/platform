"use client";

import { useEffect, useState } from "react";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";
import { SkeletonCard } from "@/components/feedback/states";
import { InvoiceTemplate } from "@/components/share/invoice-template";
import { getPublicInvoice } from "@/lib/api";
import type { PublicInvoice as PublicInvoiceDto } from "@/lib/domain/types";

export function PublicInvoice({ token }: { token: string }) {
  const [data, setData] = useState<PublicInvoiceDto>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getPublicInvoice(token).then((r) => { if (!cancelled) { setData(r); setLoaded(true); } }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [token]);
  if (!loaded) return <main className="mx-auto max-w-2xl px-5 py-12"><SkeletonCard /></main>;
  if (!data) return <InvalidPaymentLink />;
  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl"><InvoiceTemplate invoice={data} publicUrl={`/i/${encodeURIComponent(token)}`} /></div>
    </main>
  );
}
