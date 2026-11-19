import { describe, expect, it } from "vitest";
import { calcFee, isMilestoneAllocationValid } from "@/lib/domain/rules";
import { computeTrust } from "@/server/services/trust";
import { isLocked, nextFailureState } from "@/server/services/admin-auth";
import { lastMonths } from "@/server/services/workspace";
import { generateCode, hashCode } from "@/server/otp/service";
import { normalizeNgPhone, safeNext } from "@/lib/auth-utils";
import { passwordProblem } from "@/server/auth/password";
import { isAllowedOrigin } from "@/server/http/withApi";
import {
  businessDepositHashText,
  businessGetBanksHashText,
  businessPayoutCallbackHash,
  businessPayoutCallbackHashText,
  businessTransactionStatusHashText,
  collectRefundHashText,
  collectRequestHashText,
  collectStatusHashText,
  parsePagaNairaToKobo,
  PAGA_PAYOUT_HASH_PARAMETERS,
  sha512Hex,
  verifyCollectCallback,
  verifyPayoutCallback,
  collectCallbackHashText,
} from "@/server/payments/paga-hash";

describe("API origin validation", () => {
  const appUrl = "https://paysafr.example";

  it("accepts a matching Origin", () => {
    const headers = new Headers({ host: "paysafr.example", origin: "https://paysafr.example" });
    expect(isAllowedOrigin(headers, appUrl)).toBe(true);
  });

  it("accepts a same-host Referer only when Origin is absent", () => {
    const headers = new Headers({ host: "paysafr.example", referer: "https://paysafr.example/sign-in" });
    expect(isAllowedOrigin(headers, appUrl)).toBe(true);
    headers.set("origin", "https://attacker.example");
    expect(isAllowedOrigin(headers, appUrl)).toBe(false);
  });

  it("rejects foreign, malformed, or missing origin information", () => {
    expect(isAllowedOrigin(new Headers({
      host: "paysafr.example",
      referer: "https://attacker.example/sign-in",
    }), appUrl)).toBe(false);
    expect(isAllowedOrigin(new Headers({
      host: "paysafr.example",
      origin: "null",
      referer: "https://paysafr.example/sign-in",
    }), appUrl)).toBe(false);
    expect(isAllowedOrigin(new Headers({ host: "paysafr.example" }), appUrl)).toBe(false);
  });
});

describe("fees and allocation", () => {
  it("uses 1.5% up to ₦50,000 and 2% above, by order total", () => {
    expect(calcFee(5_000_000, 5_000_000)).toBe(75_000);
    expect(calcFee(5_000_000, 10_000_000)).toBe(100_000);
    expect(calcFee(10_000_000)).toBe(200_000);
  });
  it("validates milestone sums", () => {
    expect(isMilestoneAllocationValid([5, 5], 10)).toBe(true);
    expect(isMilestoneAllocationValid([5, 4], 10)).toBe(false);
  });
});

describe("Paga signatures and amounts", () => {
  const hashKey = "test-paga-hash-key";

  it("uses the documented Collect and Business request-hash field order", () => {
    expect(collectRequestHashText({
      referenceNumber: "ORD-1",
      amount: "50",
      currency: "NGN",
      payerPhoneNumber: "08064343187",
      payerEmail: "buyer@example.test",
      hashKey,
    })).toBe(`ORD-150NGN08064343187buyer@example.test${hashKey}`);
    expect(collectRequestHashText({
      referenceNumber: "ORD-2",
      amount: "50",
      currency: "NGN",
      payerPhoneNumber: "08064343187",
      hashKey,
    })).toBe(`ORD-250NGN08064343187${hashKey}`);
    expect(collectStatusHashText("ORD-1", hashKey)).toBe(`ORD-1${hashKey}`);
    expect(collectRefundHashText("REFUND-1", "25.50", hashKey)).toBe(`REFUND-125.50${hashKey}`);
    expect(businessGetBanksHashText("BANK-1", hashKey)).toBe(`BANK-1${hashKey}`);
    expect(businessDepositHashText({
      referenceNumber: "PAY-1",
      amount: "5000.00",
      destinationBankUUID: "40090E2F-7446-4217-9345-7BBAB7043C4C",
      destinationBankAccountNumber: "0000000000",
      hashKey,
    })).toBe(`PAY-15000.0040090E2F-7446-4217-9345-7BBAB7043C4C0000000000${hashKey}`);
    expect(businessTransactionStatusHashText("PAY-1", hashKey)).toBe(`PAY-1${hashKey}`);
  });

  it("verifies collection callbacks using Paga's field order and two-decimal balance", () => {
    const callback = {
      notificationId: "notification-1",
      statusCode: "0",
      externalReferenceNumber: "PS-order-1",
      state: "CONSUMED",
      outstandingBalance: 0,
    };
    const hashText = collectCallbackHashText(callback, hashKey);
    expect(hashText).toBe(`notification-10PS-order-1CONSUMED0.00${hashKey}`);
    expect(hashText).not.toBeNull();
    expect(verifyCollectCallback({ ...callback, hash: sha512Hex(hashText!) }, hashKey)).toBe(true);
    expect(verifyCollectCallback({ ...callback, outstandingBalance: 1, hash: sha512Hex(hashText!) }, hashKey)).toBe(false);
    expect(collectCallbackHashText({ ...callback, outstandingBalance: null }, hashKey))
      .toBe(`notification-10PS-order-1CONSUMED${hashKey}`);
  });

  it("requires Paga's exact payout hash-parameter header and signed values", () => {
    const callback = {
      referenceNumber: "payout-1",
      transactionDate: "2026-11-03 11:02:25.56",
      transactionId: "RP658",
      amount: "5000.0",
      sessionId: "100002261103110226001406467019",
    };
    const hash = businessPayoutCallbackHash(callback, hashKey);
    expect(businessPayoutCallbackHashText(callback, hashKey)).toBe(
      `payout-12026-11-03 11:02:25.56RP6585000.0100002261103110226001406467019${hashKey}`,
    );
    expect(verifyPayoutCallback(callback, PAGA_PAYOUT_HASH_PARAMETERS, hash, hashKey)).toBe(true);
    expect(verifyPayoutCallback(callback, "amount,referenceNumber", hash, hashKey)).toBe(false);
    expect(verifyPayoutCallback({ ...callback, amount: "5000.1" }, PAGA_PAYOUT_HASH_PARAMETERS, hash, hashKey)).toBe(false);
  });

  it("converts only positive naira values with at most two decimal places", () => {
    expect(parsePagaNairaToKobo("50.41")).toBe(5041);
    expect(parsePagaNairaToKobo(50)).toBe(5000);
    expect(parsePagaNairaToKobo("0")).toBeNull();
    expect(parsePagaNairaToKobo("50.411")).toBeNull();
    expect(parsePagaNairaToKobo("-1")).toBeNull();
  });
});

describe("trust score", () => {
  const good = (n: number) => Array.from({ length: n }, () => ({ valueKobo: 5_000_000, onTime: true, disputed: false, lossWeight: 0 }));
  it("is null (New) below three qualifying orders", () => expect(computeTrust(good(2))).toEqual({ score: null, level: "new" }));
  it("rewards a clean record and punishes lost disputes", () => {
    const clean = computeTrust(good(5)).score!;
    const bad = computeTrust([...good(4), { valueKobo: 5_000_000, onTime: false, disputed: true, lossWeight: 1 }]).score!;
    expect(clean).toBeGreaterThan(bad);
    expect(clean).toBeLessThanOrEqual(100);
  });
});

describe("auth helpers", () => {
  it("locks admin after five failures for fifteen minutes", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(nextFailureState(3, now).lockedUntil).toBeNull();
    const s = nextFailureState(4, now);
    expect(isLocked(s.lockedUntil, now)).toBe(true);
    expect(isLocked(s.lockedUntil, new Date(now.getTime() + 16 * 60_000))).toBe(false);
  });
  it("OTP codes are six digits and hashes bind email and purpose", () => {
    expect(generateCode()).toMatch(/^\d{6}$/);
    expect(hashCode("a@b.com", "verify_email", "123456")).not.toBe(hashCode("a@b.com", "reset_password", "123456"));
    expect(hashCode("a@b.com", "verify_email", "123456")).not.toBe(hashCode("c@b.com", "verify_email", "123456"));
  });
  it("normalises Nigerian phones and blocks open redirects", () => {
    expect(normalizeNgPhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalizeNgPhone("12345")).toBeNull();
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("/orders/new")).toBe("/orders/new");
  });
  it("enforces password policy", () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("alllettersonly")).not.toBeNull();
    expect(passwordProblem("Passw0rd1")).toBeNull();
  });
  it("builds the last six Lagos months oldest first", () => {
    const m = lastMonths(new Date("2026-11-14T10:00:00Z"));
    expect(m).toHaveLength(6);
    expect(m[5]!.month).toBe("2026-11");
    expect(m[0]!.month).toBe("2026-06");
  });
});
