import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/server/env";
import { pool } from "@/server/db";
import {
  businessDepositHash,
  businessGetBanksHash,
  businessTransactionStatusHash,
  collectRefundHash,
  collectRequestHash,
  collectStatusHash,
  parsePagaNairaToKobo,
} from "./paga-hash";
import type { CollectionAccount, PaymentProvider, PayoutResult } from "./provider";

type JsonObject = Record<string, unknown>;

export interface CollectPaymentStatus {
  responseCode: string;
  responseMessage: string;
  data: JsonObject;
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

function nestedObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function providerMessage(data: JsonObject, fallback: string): string {
  return String(data.statusMessage ?? data.message ?? fallback).slice(0, 200);
}

async function postJson(
  url: string,
  body: JsonObject,
  hash: string,
  businessApi = false,
): Promise<JsonObject> {
  const c = config();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      hash,
      ...(businessApi
        ? { principal: c.publicKey, credentials: c.secretKey }
        : { Authorization: `Basic ${Buffer.from(`${c.publicKey}:${c.secretKey}`).toString("base64")}` }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error("Paga returned an invalid response.");
  }
  const data = nestedObject(parsed);
  if (!data) throw new Error("Paga returned an invalid response.");
  if (!response.ok) throw new Error(`Paga request failed (HTTP ${response.status}).`);
  return data;
}

const decimalKobo = (amountKobo: number) => (amountKobo / 100).toFixed(2);
const responseCode = (data: JsonObject) => String(data.responseCode ?? "");

export async function getCollectPaymentStatus(referenceNumber: string): Promise<CollectPaymentStatus> {
  const c = config();
  const response = await postJson(
    `${c.collectUrl}/status`,
    { referenceNumber },
    collectStatusHash(referenceNumber, c.hashKey),
  );
  const data = nestedObject(response.data);
  return {
    responseCode: responseCode(response),
    responseMessage: providerMessage(response, ""),
    data: data ?? {},
  };
}

export async function getPagaTransactionStatus(referenceNumber: string): Promise<JsonObject> {
  const c = config();
  return postJson(
    `${c.businessUrl}/paga-webservices/business-rest/secured/transactionStatus`,
    { referenceNumber, locale: "en" },
    businessTransactionStatusHash(referenceNumber, c.hashKey),
    true,
  );
}

interface PagaBank {
  uuid: string;
  name: string;
  interInstitutionCode: string | null;
  sortCode: string | null;
}

let bankCache: { expiresAt: number; banks: PagaBank[] } | null = null;

async function getPagaBanks(): Promise<PagaBank[]> {
  if (bankCache && bankCache.expiresAt > Date.now()) return bankCache.banks;
  const c = config();
  const referenceNumber = `PS-BANK-${randomUUID()}`;
  const response = await postJson(
    `${c.businessUrl}/paga-webservices/business-rest/secured/getBanks`,
    { referenceNumber },
    businessGetBanksHash(referenceNumber, c.hashKey),
    true,
  );
  if (responseCode(response) !== "0") throw new Error(providerMessage(response, "Paga could not load its bank list."));
  const banks = Array.isArray(response.banks)
    ? response.banks.flatMap((item): PagaBank[] => {
        const bank = nestedObject(item);
        if (!bank || typeof bank.uuid !== "string" || typeof bank.name !== "string") return [];
        return [{
          uuid: bank.uuid,
          name: bank.name,
          interInstitutionCode: typeof bank.interInstitutionCode === "string" ? bank.interInstitutionCode : null,
          sortCode: typeof bank.sortCode === "string" ? bank.sortCode : null,
        }];
      })
    : [];
  if (!banks.length) throw new Error("Paga returned an empty bank list.");
  bankCache = { expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, banks };
  return banks;
}

export async function listPagaBanks(): Promise<{ code: string; name: string }[]> {
  return (await getPagaBanks()).flatMap((bank) =>
    bank.interInstitutionCode ? [{ code: bank.interInstitutionCode, name: bank.name }] : [],
  );
}

export async function resolvePagaBankUuid(cbnCode: string): Promise<string> {
  const bank = (await getPagaBanks()).find((item) => item.interInstitutionCode === cbnCode);
  if (!bank) throw new Error(`Paga could not resolve bank code ${cbnCode}.`);
  return bank.uuid;
}

export async function validatePagaBankAccount(input: {
  bankCode: string;
  accountNumber: string;
  amount?: string;
}): Promise<{ accountName: string }> {
  if (!/^\d{10}$/.test(input.accountNumber)) throw new Error("Paga bank accounts must have 10 digits.");
  const c = config();
  const referenceNumber = `PS-VERIFY-${randomUUID()}`;
  const destinationBankUUID = await resolvePagaBankUuid(input.bankCode);
  const amount = input.amount ?? "100.00";
  const response = await postJson(
    `${c.businessUrl}/paga-webservices/business-rest/secured/validateDepositToBank`,
    {
      referenceNumber,
      amount,
      currency: "NGN",
      destinationBankUUID,
      destinationBankAccountNumber: input.accountNumber,
    },
    businessDepositHash({
      referenceNumber,
      amount,
      destinationBankUUID,
      destinationBankAccountNumber: input.accountNumber,
      hashKey: c.hashKey,
    }),
    true,
  );
  if (responseCode(response) !== "0") throw new Error(providerMessage(response, "Paga could not verify this bank account."));
  const accountName = String(response.destinationAccountHolderNameAtBank ?? "").trim();
  if (!accountName) throw new Error(providerMessage(response, "Paga did not return an account name."));
  return { accountName };
}

export const pagaProvider: PaymentProvider = {
  name: "paga",

  async createCollectionAccount({
    amountKobo,
    reference,
    expiresAt,
    buyerPhone,
    buyerEmail,
  }): Promise<CollectionAccount> {
    const c = config();
    const email = buyerEmail?.trim() ?? "";
    const phone = buyerPhone?.trim() ?? "";
    if (!phone || !email) throw new Error("A buyer phone number and email address are required to create Paga payment details.");

    const amount = Number(decimalKobo(amountKobo));
    const currency = "NGN";
    const callbackUrl = new URL("/api/webhooks/paga", env().NEXT_PUBLIC_APP_URL).toString();
    const body: JsonObject = {
      referenceNumber: reference,
      amount,
      currency,
      payer: {
        name: "PaySafr Buyer",
        phoneNumber: phone,
        email,
      },
      payee: { name: "PaySafr Escrow" },
      expiryDateTimeUTC: expiresAt.toISOString(),
      isSuppressMessages: true,
      payerCollectionFeeShare: 1,
      payeeCollectionFeeShare: 0,
      isAllowPartialPayments: false,
      isAllowOverPayments: false,
      callBackUrl: callbackUrl,
      paymentMethods: ["BANK_TRANSFER"],
    };
    const hash = collectRequestHash({
      referenceNumber: reference,
      amount: String(amount),
      currency,
      payerPhoneNumber: phone,
      payerEmail: email,
      hashKey: c.hashKey,
    });
    const data = await postJson(`${c.collectUrl}/paymentRequest`, body, hash);
    if (responseCode(data) !== "0") throw new Error(providerMessage(data, "Paga could not create a payment request."));

    const requestAmountKobo = parsePagaNairaToKobo(data.requestAmount);
    const totalPaymentAmountKobo = parsePagaNairaToKobo(data.totalPaymentAmount);
    if (requestAmountKobo !== amountKobo) throw new Error("Paga returned a request amount that does not match the order total.");
    if (totalPaymentAmountKobo === null) throw new Error("Paga did not return the exact amount to transfer.");

    const methods = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
    const method = methods.map(nestedObject).find((item) => String(item?.name ?? "").toUpperCase() === "BANK_TRANSFER");
    const properties = nestedObject(method?.properties);
    const accountNumber = String(properties?.AccountNumber ?? "");
    if (!/^\d{10}$/.test(accountNumber)) throw new Error(providerMessage(data, "Paga did not return a valid bank account."));
    const bankName = String(properties?.bankName ?? data.bankName ?? "Paga");
    const providerExpiry = typeof data.expiryDateTimeUTC === "string" ? data.expiryDateTimeUTC : expiresAt.toISOString();
    const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(providerExpiry) ? providerExpiry : `${providerExpiry}Z`;
    const expiry = new Date(timestamp);
    if (Number.isNaN(expiry.getTime()) || expiry > expiresAt) throw new Error("Paga returned an invalid payment request expiry.");

    return {
      bankName,
      accountNumber,
      accountName: "PaySafr Escrow",
      expiresAt: expiry,
      totalPaymentAmountKobo,
    };
  },

  async initiatePayout({ payoutId, amountKobo, bankCode, accountNumber, accountName }): Promise<PayoutResult> {
    const c = config();
    const amount = decimalKobo(amountKobo);
    let destinationBankUUID: string;
    let verified: { accountName: string };
    try {
      destinationBankUUID = await resolvePagaBankUuid(bankCode);
      verified = await validatePagaBankAccount({ bankCode, accountNumber, amount });
    } catch (error) {
      return {
        status: "failed",
        reference: payoutId,
        error: error instanceof Error ? error.message.slice(0, 200) : "Paga could not verify the payout account.",
      };
    }
    const statusCallbackUrl = new URL("/api/webhooks/paga-payouts", env().NEXT_PUBLIC_APP_URL).toString();
    const url = `${c.businessUrl}/paga-webservices/business-rest/secured/depositToBank`;
    const body: JsonObject = {
      referenceNumber: payoutId,
      amount,
      currency: "NGN",
      destinationBankUUID,
      destinationBankAccountNumber: accountNumber,
      recipientName: verified.accountName || accountName,
      remarks: "PaySafr escrow payout",
      suppressRecipientMessage: true,
      statusCallbackUrl,
    };
    const hash = businessDepositHash({
        referenceNumber: payoutId,
        amount,
        destinationBankUUID,
        destinationBankAccountNumber: accountNumber,
        hashKey: c.hashKey,
    });
    const data = await postJson(url, body, hash, true);
    const code = responseCode(data);
    if (code === "0") return { status: "processing", reference: payoutId };
    return {
      status: "processing",
      reference: payoutId,
      error: `Paga payout awaits reconciliation (response code ${code || "missing"}).`,
    };
  },

  async initiateRefund({ payoutId, amountKobo, orderId }): Promise<PayoutResult> {
    const c = config();
    const { rows } = await pool().query<{ reference_number: string }>(
      `SELECT reference_number FROM paga_payment_requests
       WHERE order_id=$1 AND status='paid' ORDER BY updated_at DESC LIMIT 1`,
      [orderId],
    );
    const original = rows[0];
    if (!original) return { status: "failed", reference: payoutId, error: "Original Paga collection was not found." };

    const referenceNumber = payoutId;
    const paymentRequestReference = original.reference_number;
    const refundAmount = decimalKobo(amountKobo);
    const refundAmountNumber = Number(refundAmount);
    const refund = await postJson(
      `${c.collectUrl}/refund/v2`,
      {
        referenceNumber,
        paymentRequestReference,
        refundAmount: refundAmountNumber,
        currency: "NGN",
        reason: "PaySafr refund",
      },
      collectRefundHash(referenceNumber, String(refundAmountNumber), c.hashKey),
    );
    const code = responseCode(refund);
    if (code !== "0" && code !== "102") {
      return { status: "processing", reference: referenceNumber, error: `Paga refund awaits reconciliation (response code ${code || "missing"}).` };
    }

    const status = await getCollectPaymentStatus(paymentRequestReference);
    if (status.responseCode !== "0") {
      return { status: "processing", reference: referenceNumber, error: "Paga refund status is not yet available." };
    }
    if (String(status.data.refundStatus ?? "").toLowerCase() === "refunded") {
      return { status: "paid", reference: referenceNumber };
    }
    return { status: "processing", reference: referenceNumber };
  },
};
