"use client";

import { useEffect, useState } from "react";
import { InvoiceTemplate } from "@/components/share/invoice-template";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";
import { SkeletonCard } from "@/components/feedback/states";
import { getOrder } from "@/lib/api";
import type { Order } from "@/lib/domain/types";

export function PublicInvoice({ token }: { token: string }) {
  const [order, setOrder] = useState<Order>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getOrder(token)
        .then((result) => {
          setOrder(result);
          setLoaded(true);
        })
        .catch((error: unknown) => {
          console.error("Invoice lookup failed", error);
          setLoaded(true);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token]);

  if (!loaded)
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <SkeletonCard />
      </main>
    );
  if (!order) return <InvalidPaymentLink />;
  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15 px-4 py-8 sm:py-12">
      <InvoiceTemplate
        order={order}
        publicUrl={`/i/${encodeURIComponent(token)}`}
      />
    </main>
  );
}
