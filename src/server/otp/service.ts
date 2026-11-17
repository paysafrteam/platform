import "server-only";
import { randomInt } from "node:crypto";
import { q, q1, withTx } from "@/server/db";
import { env } from "@/server/env";
import { hmacSha256Hex, timingSafeEqualStr } from "@/server/ids";
import { AppError } from "@/server/http/errors";
import { rateLimit } from "@/server/http/ratelimit";
import { sendEmail } from "@/server/email";
import { resetPassword, verifyEmail } from "@/server/email/templates";

export type OtpPurpose = "verify_email" | "reset_password";
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_COOLDOWN_SECONDS = 30;

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hashCode = (email: string, purpose: OtpPurpose, code: string) =>
  hmacSha256Hex(`${email}|${purpose}|${code}`, env().OTP_PEPPER);
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function issueOtp(input: { email: string; purpose: OtpPurpose; ip: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  const existing = await q1<{ last_sent_at: Date }>(undefined, "SELECT last_sent_at FROM otp_codes WHERE email=$1 AND purpose=$2", [email, input.purpose]);
  if (existing) {
    const wait = OTP_COOLDOWN_SECONDS - (Date.now() - existing.last_sent_at.getTime()) / 1000;
    if (wait > 0) throw new AppError("RATE_LIMITED", "Please wait before requesting another code.", undefined, { retryAfterSeconds: Math.ceil(wait) });
  }
  await rateLimit({ key: `otp:email:${input.purpose}:${email}`, limit: 5, windowSeconds: 3600 });
  await rateLimit({ key: `otp:ip:${input.ip}`, limit: 20, windowSeconds: 3600 });

  const code = generateCode();
  await q(undefined, `INSERT INTO otp_codes (email, purpose, code_hash, expires_at, attempts, consumed_at, last_sent_at, send_count)
    VALUES ($1,$2,$3, now() + make_interval(mins => $4), 0, NULL, now(), 1)
    ON CONFLICT (email, purpose) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0,
      consumed_at = NULL, last_sent_at = now(), send_count = otp_codes.send_count + 1`,
    [email, input.purpose, hashCode(email, input.purpose, code), OTP_TTL_MINUTES]);
  try {
    await sendEmail({ to: email, template: input.purpose, content: input.purpose === "verify_email" ? verifyEmail(code) : resetPassword(code), critical: true });
  } catch (e) {
    // Remove the unsent code so the cooldown does not block an immediate retry.
    await q(undefined, "DELETE FROM otp_codes WHERE email=$1 AND purpose=$2", [email, input.purpose]);
    throw e;
  }
}

const INVALID = () => new AppError("INVALID_CODE", "That code is not valid or has expired. Check it or request a new one.");

export async function verifyOtp(input: { email: string; purpose: OtpPurpose; code: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  // Failed attempts must persist, so the attempt counter is committed even when the check fails.
  const outcome = await withTx(async (tx) => {
    const row = await q1<{ id: string; code_hash: string; attempts: number }>(tx,
      `SELECT id, code_hash, attempts FROM otp_codes WHERE email=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`,
      [email, input.purpose]);
    if (!row) return "invalid" as const;
    if (row.attempts >= OTP_MAX_ATTEMPTS) return "burned" as const;
    if (timingSafeEqualStr(row.code_hash, hashCode(email, input.purpose, input.code))) {
      await q(tx, "UPDATE otp_codes SET consumed_at = now() WHERE id = $1", [row.id]);
      return "ok" as const;
    }
    await q(tx, "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    return row.attempts + 1 >= OTP_MAX_ATTEMPTS ? ("burned" as const) : ("invalid" as const);
  });
  if (outcome === "ok") return;
  if (outcome === "burned") throw new AppError("INVALID_CODE", "Too many wrong codes. Request a new code to continue.");
  throw INVALID();
}
