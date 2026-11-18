import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/server/env";
import { pool } from "@/server/db";
import type { CollectionAccount, PaymentProvider, PayoutResult } from "./provider";

type JsonObject = Record<string, unknown>;

function sha512Hex(payload: string): string {
  return createHash("sha512").update(payload, "utf8").digest("hex");
}

function config() {
  const e = env();
  if (!e.PAGA_PUBLIC_KEY || !e.PAGA_SECRET_KEY || !e.PAGA_HASH_KEY) {
    throw new Error("Paga credentials are not configured.");
  }
  const isLive = e.PAGA_ENV === "live";
  return {
    publicKey: e.PAGA_PUBLIC_KEY,
    secretKey: e.PAGA_SECRET_KEY,
    hashKey: e.PAGA_HASH_KEY,
    collectUrl: isLive ? "https://collect.paga.com" : "https://beta-collect.paga.com",
    businessUrl: isLive ? "https://www.mypaga.com" : "https://beta.mypaga.com",
  };
}

async function postJson(url: string, body: JsonObject, publicKey: string, secretKey: string, hash: string): Promise<JsonObject> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      "hash": hash,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  let data: JsonObject = {};
  try { data = await response.json() as JsonObject; } catch { /* Provider error details are handled below. */ }
  if (!response.ok) {
    throw new Error(String(data.statusMessage ?? data.message ?? `Paga request failed (${response.status})`).slice(0, 200));
  }
  return data;
}

function decimalKobo(amountKobo: number): string {
  return (amountKobo / 100).toFixed(2);
}

function nestedObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

let bankUuidCache: { expiresAt: number; values: Map<string, string> } | null = null;

export async function resolvePagaBankUuid(cbnCode: string): Promise<string> {
  if (bankUuidCache && bankUuidCache.expiresAt > Date.now()) {
    const cached = bankUuidCache.values.get(cbnCode);
    if (cached) return cached;
  }
  const c = config();
  const referenceNumber = `PS-BANK-${createHash("sha256").update(`${cbnCode}:${Date.now()}`).digest("hex").slice(0, 20)}`;
  const data = await postJson(
    `${c.businessUrl}/paga-webservices/business-rest/secured/getBanks`,
    { referenceNumber },
    c.publicKey,
    c.secretKey,
    sha512Hex(`${referenceNumber}${c.hashKey}`),
  );
  const banks = Array.isArray(data.banks) ? data.banks :
    (Array.isArray(nestedObject(data.data)?.banks) ? nestedObject(data.data)?.banks as unknown[] : []);
  const values = new Map<string, string>();
  for (const item of banks) {
    const bank = nestedObject(item);
    if (!bank) continue;
    const code = String(bank.interInstitutionCode ?? bank.cbnCode ?? bank.bankCode ?? "");
    const uuid = String(bank.uuid ?? bank.bankUUID ?? bank.destinationBankUUID ?? "");
    if (code && uuid) values.set(code, uuid);
  }
  bankUuidCache = { expiresAt: Date.now() + 24 * 60 * 60 * 1000, values };
  const uuid = values.get(cbnCode);
  if (!uuid) throw new Error(`Paga could not resolve bank code ${cbnCode}.`);
  return uuid;
}

export async function validatePagaBankAccount(input: { bankCode: string; accountNumber: string }): Promise<{ accountName: string }> {
  const c = config();
  const referenceNumber = `PS-VERIFY-${createHash("sha256").update(`${input.bankCode}:${input.accountNumber}:${Date.now()}`).digest("hex").slice(0, 20)}`;
  const destinationBankUUID = await resolvePagaBankUuid(input.bankCode);
  const amount = "100.00";
  const data = await postJson(
    `${c.businessUrl}/paga-webservices/business-rest/secured/validateDepositToBank`,
    {
      referenceNumber,
      amount,
      destinationBankUUID,
      destinationBankAccountNumber: input.accountNumber,
    },
    c.publicKey,
    c.secretKey,
    sha512Hex(`${referenceNumber}${amount}${input.accountNumber}${destinationBankUUID}${c.hashKey}`),
  );
  const accountName = String(
    data.destinationAccountHolderNameAtBank ??
    nestedObject(data.data)?.destinationAccountHolderNameAtBank ??
    "",
  ).trim();
  if (!accountName) throw new Error(String(data.statusMessage ?? "Paga could not verify this bank account."));
  return { accountName };
}

export const pagaProvider: PaymentProvider = {
  name: "paga",

  async createCollectionAccount({ amountKobo, reference, expiresAt }): Promise<CollectionAccount> {
    const c = config();
    const amount = decimalKobo(amountKobo);
    const body: JsonObject = {
      referenceNumber: reference,
      amount,
      currency: "NGN",
      payer: { name: "PaySafr Buyer", email: "buyer@paysafr.ng" },
      payee: { name: "PaySafr Escrow" },
      expiryDateTimeUTC: expiresAt.toISOString(),
      isSuppressMessages: true,
      payerCollectionFeeShare: 0.0,
      payeeCollectionFeeShare: 1.0,
      isAllowPartialPayments: true,
      isAllowOverPayments: true,
      callBackUrl: `${env().NEXT_PUBLIC_APP_URL}/api/webhooks/paga`,
      paymentMethods: ["BANK_TRANSFER"],
    };
    const payerEmail = "buyer@paysafr.ng";
    const callbackUrl = `${env().NEXT_PUBLIC_APP_URL}/api/webhooks/paga`;
    const hash = sha512Hex(
      `${reference}${amount}NGN${""}${payerEmail}${""}${""}${""}${expiresAt.toISOString()}${callbackUrl}${c.hashKey}`,
    );
    const data = await postJson(`${c.collectUrl}/paymentRequest`, body, c.publicKey, c.secretKey, hash);
    const methods = Array.isArray(data.paymentMethods) ? data.paymentMethods :
      (Array.isArray(nestedObject(data.data)?.paymentMethods) ? nestedObject(data.data)?.paymentMethods as unknown[] : []);
    const method = methods.map(nestedObject).find((m) => m && (m.accountNumber || m.accountNumberMasked));
    const accountNumber = String(method?.accountNumber ?? method?.accountNumberMasked ?? "");
    const bankName = String(method?.bankName ?? method?.bank ?? "Paga");
    const accountName = String(method?.accountName ?? method?.name ?? "PaySafr Escrow");
    if (!accountNumber) throw new Error(String(data.statusMessage ?? "Paga did not return a virtual account."));
    return { bankName, accountNumber, accountName, expiresAt };
  },

  async initiatePayout({ payoutId, amountKobo, bankCode, accountNumber, accountName }): Promise<PayoutResult> {
    const c = config();
    const amount = decimalKobo(amountKobo);
    const destinationBankUUID = await resolvePagaBankUuid(bankCode);
    const data = await postJson(
      `${c.businessUrl}/paga-webservices/business-rest/secured/depositToBank`,
      {
        referenceNumber: payoutId,
        amount,
        currency: "NGN",
        destinationBankUUID,
        destinationBankAccountNumber: accountNumber,
        recipientName: accountName,
        suppressRecipientMessage: true,
      },
      c.publicKey,
      c.secretKey,
      sha512Hex(`${payoutId}${amount}${accountNumber}${destinationBankUUID}${c.hashKey}`),
    );
    const statusCode = String(data.statusCode ?? nestedObject(data.data)?.statusCode ?? "");
    const transactionId = String(data.transactionId ?? nestedObject(data.data)?.transactionId ?? payoutId);
    if (statusCode === "0") return { status: "paid", reference: transactionId };
    if (["1", "2", "processing", "pending"].includes(statusCode.toLowerCase())) return { status: "processing", reference: transactionId };
    return { status: "failed", reference: payoutId, error: String(data.statusMessage ?? data.message ?? "Paga payout failed").slice(0, 200) };
  },

  async initiateRefund({ payoutId, amountKobo, orderId }): Promise<PayoutResult> {
    const c = config();
    const { rows } = await pool().query<{ provider_reference: string }>(
      "SELECT provider_reference FROM payments WHERE order_id=$1 ORDER BY received_at ASC LIMIT 1",
      [orderId],
    );
    if (!rows.length) return { status: "failed", reference: payoutId, error: "Original Paga collection was not found." };
    const original = rows[0];
    if (!original) return { status: "failed", reference: payoutId, error: "Original Paga collection was not found." };
    const referenceNumber = original.provider_reference;
    const amount = decimalKobo(amountKobo);
    const reason = "PaySafr refund";
    const data = await postJson(
      `${c.collectUrl}/refund`,
      { referenceNumber, amount, currency: "NGN", reason },
      c.publicKey,
      c.secretKey,
      sha512Hex(`${referenceNumber}${amount}NGN${reason}${c.hashKey}`),
    );
    const statusCode = String(data.statusCode ?? nestedObject(data.data)?.statusCode ?? "");
    const reference = String(data.transactionId ?? nestedObject(data.data)?.transactionId ?? payoutId);
    if (statusCode === "0") return { status: "paid", reference };
    if (["1", "2", "processing", "pending"].includes(statusCode.toLowerCase())) return { status: "processing", reference };
    return { status: "failed", reference: payoutId, error: String(data.statusMessage ?? data.message ?? "Paga refund failed").slice(0, 200) };
  },
};
