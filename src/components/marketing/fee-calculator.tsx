"use client";

import { useState } from "react";
import { calcFee, calcSellerReceives } from "@/lib/domain/rules";
import { formatNaira, parseNairaInput } from "@/lib/format/money";

export function FeeCalculator() {
  const [amount, setAmount] = useState("100,000");
  const kobo = parseNairaInput(amount);
  const fee = calcFee(kobo);
  return (
    <div className="surface-card grid gap-6 p-5 sm:p-7 md:grid-cols-[0.8fr_1.2fr]">
      <label className="text-sm">
        Order amount
        <div className="mt-2 flex h-12 items-center rounded-2xl border border-[var(--ps-grey-200)] px-4">
          <span className="money mr-2">₦</span>
          <input
            className="money w-full bg-transparent outline-none"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^\d.]/g, "");
              const [whole = "", fraction] = digits.split(".");
              const formatted = Number(whole || 0).toLocaleString("en-NG");
              setAmount(fraction === undefined ? formatted : `${formatted}.${fraction.slice(0, 2)}`);
            }}
            aria-label="Order amount in naira"
          />
        </div>
        <span className="mt-2 block text-xs text-[var(--ps-grey-600)]">Example fee rate: 2%, paid by the seller.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[var(--ps-grey-200)]/30 p-4">
          <p className="text-xs text-[var(--ps-grey-600)]">Buyer pays</p>
          <p className="money mt-1 text-xl">{formatNaira(kobo)}</p>
        </div>
        <div className="rounded-2xl bg-[var(--ps-grey-200)]/30 p-4">
          <p className="text-xs text-[var(--ps-grey-600)]">PaySafr fee</p>
          <p className="money mt-1 text-xl">{formatNaira(fee)}</p>
        </div>
        <div className="rounded-2xl bg-[var(--ps-green-400)]/20 p-4">
          <p className="text-xs text-[var(--ps-grey-600)]">Seller receives</p>
          <p className="money mt-1 text-xl">{formatNaira(calcSellerReceives(kobo))}</p>
        </div>
      </div>
    </div>
  );
}
