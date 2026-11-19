import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { env } from "@/server/env";
import { listPagaBanks, pagaProvider, getCollectPaymentStatus } from "@/server/payments/paga";

async function main() {
  const config = env();
  if (config.PAGA_ENV !== "sandbox") {
    throw new Error("The Paga smoke test is sandbox-only; set PAGA_ENV=sandbox.");
  }
  const phone = process.env.PAGA_SMOKE_PHONE?.trim();
  const email = process.env.PAGA_SMOKE_EMAIL?.trim();
  if (!phone || !email) throw new Error("Set PAGA_SMOKE_PHONE and PAGA_SMOKE_EMAIL to sandbox buyer details.");

  const banks = await listPagaBanks();
  if (!banks.length) throw new Error("Paga returned no banks.");

  const reference = `PS-SMOKE-${randomUUID().replace(/-/g, "")}`;
  const account = await pagaProvider.createCollectionAccount({
    orderId: reference,
    amountKobo: 1_000,
    reference,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    buyerPhone: phone,
    buyerEmail: email,
  });
  const status = await getCollectPaymentStatus(reference);
  if (status.responseCode !== "0") throw new Error(`Paga status lookup failed: ${status.responseMessage}`);

  console.log(JSON.stringify({
    reference,
    bankCount: banks.length,
    bankName: account.bankName,
    accountLastFour: account.accountNumber.slice(-4),
    totalPaymentAmountKobo: account.totalPaymentAmountKobo,
    expiresAt: account.expiresAt.toISOString(),
    paymentStatusCode: String(status.data.statusCode ?? "unknown"),
    moneyTransferred: false,
  }, null, 2));
}

loadEnvConfig(process.cwd());
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Paga smoke test failed.");
  process.exitCode = 1;
});
