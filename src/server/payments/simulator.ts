import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/server/env";
import type { PaymentProvider } from "@/server/payments/provider";
import { pagaProvider } from "@/server/payments/paga";

/** Sandbox rail. Clearly fake account details; funding goes through the same recordFunding() Paga will call. */
export const simulator: PaymentProvider = {
  name: "simulator",
  async createCollectionAccount({ orderId, expiresAt }) {
    // Deterministic, unique-per-order fake NUBAN-style number (prefix 99 marks it as sandbox).
    const n = parseInt(createHash("sha256").update(orderId).digest("hex").slice(0, 12), 16) % 100_000_000;
    return {
      bankName: "PaySafr Sandbox Bank",
      accountNumber: `99${n.toString().padStart(8, "0")}`,
      accountName: "PaySafr Sandbox Collection",
      expiresAt,
    };
  },
  async initiatePayout({ payoutId, accountNumber }) {
    if (env().SIMULATOR_FAIL_PAYOUTS === "true") return { status: "failed", reference: `SIMPAY-${payoutId}`, error: "Simulated payout failure" };
    if (!accountNumber) return { status: "failed", reference: `SIMPAY-${payoutId}`, error: "No payout account on file" };
    return { status: "paid", reference: `SIMPAY-${payoutId}` };
  },
  async initiateRefund({ payoutId }) {
    return { status: "paid", reference: `SIMREF-${payoutId}` };
  },
};

export function getPaymentProvider(): PaymentProvider {
  if (env().PAYMENT_MODE === "paga") return pagaProvider;
  return simulator;
}
