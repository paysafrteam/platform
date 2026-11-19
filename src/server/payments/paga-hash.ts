import "server-only";
import { createHash } from "node:crypto";
import { timingSafeEqualStr } from "@/server/ids";

type PagaObject = Record<string, unknown>;

export type PagaPaymentCallback = {
  notificationId?: unknown;
  statusCode?: unknown;
  externalReferenceNumber?: unknown;
  state?: unknown;
  outstandingBalance?: unknown;
  [key: string]: unknown;
};

export type PagaPayoutCallback = PagaObject;

export function sha512Hex(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex");
}

export function collectRequestHashText(input: {
  referenceNumber: string;
  amount: string;
  currency: string;
  payerPhoneNumber?: string;
  payerEmail?: string;
  hashKey: string;
}): string {
  return [
    input.referenceNumber,
    input.amount,
    input.currency,
    input.payerPhoneNumber ?? "",
    input.payerEmail ?? "",
    input.hashKey,
  ].join("");
}

export function collectRequestHash(input: Parameters<typeof collectRequestHashText>[0]): string {
  return sha512Hex(collectRequestHashText(input));
}

export function collectStatusHashText(referenceNumber: string, hashKey: string): string {
  return `${referenceNumber}${hashKey}`;
}

export function collectStatusHash(referenceNumber: string, hashKey: string): string {
  return sha512Hex(collectStatusHashText(referenceNumber, hashKey));
}

export function collectRefundHashText(referenceNumber: string, refundAmount: string, hashKey: string): string {
  return `${referenceNumber}${refundAmount}${hashKey}`;
}

export function collectRefundHash(referenceNumber: string, refundAmount: string, hashKey: string): string {
  return sha512Hex(collectRefundHashText(referenceNumber, refundAmount, hashKey));
}

function outstandingBalanceText(value: unknown): string | null {
  if (value === null || value === undefined) return "";
  if (typeof value !== "number" && typeof value !== "string") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null;
}

export function collectCallbackHashText(payload: PagaPaymentCallback, hashKey: string): string | null {
  const outstandingBalance = outstandingBalanceText(payload.outstandingBalance);
  if (outstandingBalance === null) return null;
  return [
    String(payload.notificationId ?? ""),
    String(payload.statusCode ?? ""),
    String(payload.externalReferenceNumber ?? ""),
    String(payload.state ?? ""),
    outstandingBalance,
    hashKey,
  ].join("");
}

export function verifyCollectCallback(payload: PagaPaymentCallback, hashKey: string): boolean {
  const received = typeof payload.hash === "string" ? payload.hash.toLowerCase() : "";
  const text = collectCallbackHashText(payload, hashKey);
  const expected = text === null ? "" : sha512Hex(text);
  return Boolean(/^[0-9a-f]{128}$/.test(received) && expected && timingSafeEqualStr(expected, received));
}

export function businessGetBanksHashText(referenceNumber: string, hashKey: string): string {
  return `${referenceNumber}${hashKey}`;
}

export function businessGetBanksHash(referenceNumber: string, hashKey: string): string {
  return sha512Hex(businessGetBanksHashText(referenceNumber, hashKey));
}

export function businessDepositHashText(input: {
  referenceNumber: string;
  amount: string;
  destinationBankUUID: string;
  destinationBankAccountNumber: string;
  hashKey: string;
}): string {
  return `${input.referenceNumber}${input.amount}${input.destinationBankUUID}${input.destinationBankAccountNumber}${input.hashKey}`;
}

export function businessDepositHash(input: Parameters<typeof businessDepositHashText>[0]): string {
  return sha512Hex(businessDepositHashText(input));
}

export function businessTransactionStatusHashText(referenceNumber: string, hashKey: string): string {
  return `${referenceNumber}${hashKey}`;
}

export function businessTransactionStatusHash(referenceNumber: string, hashKey: string): string {
  return sha512Hex(businessTransactionStatusHashText(referenceNumber, hashKey));
}

export const PAGA_PAYOUT_HASH_PARAMETERS = "referenceNumber,transactionDate,transactionId,amount,sessionId,hashKey";

export function businessPayoutCallbackHashText(payload: PagaPayoutCallback, hashKey: string): string {
  return [
    payload.referenceNumber,
    payload.transactionDate,
    payload.transactionId,
    payload.amount,
    payload.sessionId,
  ].map((value) => value === null || value === undefined ? "" : String(value)).join("") + hashKey;
}

export function businessPayoutCallbackHash(payload: PagaPayoutCallback, hashKey: string): string {
  return sha512Hex(businessPayoutCallbackHashText(payload, hashKey));
}

export function verifyPayoutCallback(
  payload: PagaPayoutCallback,
  hashParameters: string,
  receivedHash: string,
  hashKey: string,
): boolean {
  if (hashParameters !== PAGA_PAYOUT_HASH_PARAMETERS || !/^[0-9a-f]{128}$/i.test(receivedHash)) return false;
  return timingSafeEqualStr(businessPayoutCallbackHash(payload, hashKey), receivedHash.toLowerCase());
}

export function parsePagaNairaToKobo(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const kobo = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(kobo) && kobo > 0 ? kobo : null;
}
