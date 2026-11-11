"use client";

import { useEffect, useState } from "react";
import type { Order, Receipt } from "@/lib/domain/types";
import { getPublicReceipt } from "@/lib/api";
import { ReceiptTemplate } from "@/components/share/receipt-template";
import { SkeletonCard } from "@/components/feedback/states";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";

export function PublicReceipt({ number }: { number: string }) {
  const [data, setData] = useState<{ order: Order; receipt: Receipt }>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPublicReceipt(number)
        .then((result) => {
          setData(result);
          setLoaded(true);
        })
        .catch((error: unknown) => {
          console.error("Receipt lookup failed", error);
          setLoaded(true);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [number]);

  if (!loaded)
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <SkeletonCard />
      </main>
    );
  if (!data) return <InvalidPaymentLink />;
  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <ReceiptTemplate
          order={data.order}
          receipt={data.receipt}
          publicUrl={`/r/${encodeURIComponent(number)}`}
        />
      </div>
    </main>
  );
}
