"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";
import { SkeletonCard } from "@/components/feedback/states";
import { ReceiptTemplate } from "@/components/share/receipt-template";
import { getBuyerReceipt } from "@/lib/api";
import type { Order, Receipt } from "@/lib/domain/types";

export function ReceiptByToken({ token }: { token: string }) {
  const [data, setData] = useState<{ order: Order; receipt?: Receipt }>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getBuyerReceipt(token)
        .then((result) => {
          setData(result);
          setLoaded(true);
        })
        .catch((error: unknown) => {
          console.error("Buyer receipt lookup failed", error);
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
  if (!data) return <InvalidPaymentLink />;
  if (!data.receipt)
    return (
      <main className="mx-auto max-w-xl px-5 py-12">
        <div className="surface-card p-6">
          <h1 className="font-display text-2xl">
            Your receipt is not ready yet.
          </h1>
          <p className="mt-2 text-sm text-[var(--ps-grey-600)]">
            A receipt appears after the bank confirms payment.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center underline"
            href={`/pay/${token}`}
          >
            Return to payment
          </Link>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <ReceiptTemplate
          order={data.order}
          receipt={data.receipt}
          publicUrl={`/r/${encodeURIComponent(data.receipt.number)}`}
        />
      </div>
    </main>
  );
}
