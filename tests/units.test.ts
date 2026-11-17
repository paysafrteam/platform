import { describe, expect, it } from "vitest";
import { calcFee, isMilestoneAllocationValid } from "@/lib/domain/rules";
import { computeTrust } from "@/server/services/trust";
import { isLocked, nextFailureState } from "@/server/services/admin-auth";
import { lastMonths } from "@/server/services/workspace";
import { generateCode, hashCode } from "@/server/otp/service";
import { normalizeNgPhone, safeNext } from "@/lib/auth-utils";
import { passwordProblem } from "@/server/auth/password";

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
