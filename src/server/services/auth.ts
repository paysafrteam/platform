import "server-only";
import { q, q1 } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { rateLimit } from "@/server/http/ratelimit";
import { assertPassword, dummyHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { createUserSession, revokeUserSessions } from "@/server/auth/session";
import { issueOtp, normalizeEmail, verifyOtp } from "@/server/otp/service";
import { sendEmail } from "@/server/email";
import { passwordChanged } from "@/server/email/templates";
import { normalizeNgPhone } from "@/lib/auth-utils";
import type { Me, PayoutAccount } from "@/lib/domain/types";

interface UserRow {
  id: string; email: string; name: string; phone: string; seller_type: "freelancer" | "seller"; business_name: string | null;
  status: "active" | "limited" | "suspended"; trust_score: number | null; trust_level: Me["trustLevel"]; completed_orders: number;
  email_verified_at: Date | null; password_hash: string;
}

export async function signUp(input: { name: string; email: string; phone: string; password: string; role: "freelancer" | "seller" }, ip: string) {
  await rateLimit({ key: `signup:${ip}`, limit: 10, windowSeconds: 3600 });
  const email = normalizeEmail(input.email);
  const phone = normalizeNgPhone(input.phone);
  if (!phone) throw new AppError("VALIDATION", "Enter a valid Nigerian phone number.", { phone: "Enter a valid Nigerian phone number." });
  assertPassword(input.password);
  const hash = await hashPassword(input.password);
  const existing = await q1<{ id: string; email_verified_at: Date | null }>(undefined, "SELECT id, email_verified_at FROM users WHERE lower(email) = $1", [email]);
  if (existing?.email_verified_at) throw new AppError("CONFLICT", "An account with this email already exists. Sign in instead.");
  if (existing) {
    // Unverified: overwrite so nobody can squat an email address.
    await q(undefined, `UPDATE users SET name=$2, phone=$3, password_hash=$4, seller_type=$5, terms_accepted_at=now(), updated_at=now() WHERE id=$1`,
      [existing.id, input.name.trim(), phone, hash, input.role]);
  } else {
    await q(undefined, `INSERT INTO users (email, name, phone, password_hash, seller_type, terms_accepted_at) VALUES ($1,$2,$3,$4,$5,now())`,
      [email, input.name.trim(), phone, hash, input.role]);
  }
  await issueOtp({ email, purpose: "verify_email", ip });
  return { verificationSent: true as const, email };
}

export async function verifyEmailAndSignIn(input: { email: string; code: string }, ip: string, ua: string | null): Promise<Me> {
  const email = normalizeEmail(input.email);
  await rateLimit({ key: `verify:${email}`, limit: 20, windowSeconds: 3600 });
  await verifyOtp({ email, purpose: "verify_email", code: input.code });
  const user = await q1<{ id: string }>(undefined, "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), last_login_at = now() WHERE lower(email) = $1 RETURNING id", [email]);
  if (!user) throw new AppError("INVALID_CODE", "That code is not valid or has expired. Check it or request a new one.");
  await createUserSession(user.id, ip, ua);
  return getMe(user.id);
}

export async function resendVerification(emailRaw: string, ip: string) {
  const email = normalizeEmail(emailRaw);
  const u = await q1(undefined, "SELECT 1 FROM users WHERE lower(email)=$1 AND email_verified_at IS NULL", [email]);
  if (u) await issueOtp({ email, purpose: "verify_email", ip });
  return { sent: true as const };
}

export async function signIn(input: { email: string; password: string }, ip: string, ua: string | null) {
  const email = normalizeEmail(input.email);
  await rateLimit({ key: `signin:ip:${ip}`, limit: 10, windowSeconds: 900 });
  await rateLimit({ key: `signin:email:${email}`, limit: 10, windowSeconds: 900 });
  const user = await q1<UserRow>(undefined, "SELECT * FROM users WHERE lower(email) = $1", [email]);
  const ok = await verifyPassword(input.password, user?.password_hash ?? dummyHash());
  if (!user || !ok) throw new AppError("VALIDATION", "Email or password is incorrect.");
  if (!user.email_verified_at) {
    await issueOtp({ email, purpose: "verify_email", ip }).catch((e) => { if (!(e instanceof AppError && e.code === "RATE_LIMITED")) throw e; });
    throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email to continue. We sent a new code.");
  }
  if (user.status === "suspended") throw new AppError("FORBIDDEN", "This account is suspended. Contact support.");
  await q(undefined, "UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await createUserSession(user.id, ip, ua);
  return { signedIn: true as const };
}

export async function forgotPassword(emailRaw: string, ip: string) {
  const email = normalizeEmail(emailRaw);
  const u = await q1(undefined, "SELECT 1 FROM users WHERE lower(email)=$1 AND email_verified_at IS NOT NULL", [email]);
  if (u) await issueOtp({ email, purpose: "reset_password", ip }).catch((e) => { if (!(e instanceof AppError && e.code === "RATE_LIMITED")) throw e; });
  return { sent: true as const };
}

export async function resetPassword(input: { email: string; code: string; password: string }) {
  const email = normalizeEmail(input.email);
  await rateLimit({ key: `reset:${email}`, limit: 20, windowSeconds: 3600 });
  assertPassword(input.password);
  await verifyOtp({ email, purpose: "reset_password", code: input.code });
  const hash = await hashPassword(input.password);
  const u = await q1<{ id: string }>(undefined, "UPDATE users SET password_hash=$2, updated_at=now() WHERE lower(email)=$1 AND email_verified_at IS NOT NULL RETURNING id", [email, hash]);
  if (!u) throw new AppError("INVALID_CODE", "That code is not valid or has expired. Check it or request a new one.");
  await revokeUserSessions(u.id, null);
  await sendEmail({ to: email, template: "password_changed", content: passwordChanged() });
  return { reset: true as const };
}

export async function changePassword(userId: string, sessionId: string, input: { currentPassword: string; newPassword: string }) {
  assertPassword(input.newPassword, "newPassword");
  const u = await q1<{ password_hash: string; email: string }>(undefined, "SELECT password_hash, email FROM users WHERE id=$1", [userId]);
  if (!u || !(await verifyPassword(input.currentPassword, u.password_hash))) {
    throw new AppError("VALIDATION", "Your current password is incorrect.", { currentPassword: "Your current password is incorrect." });
  }
  await q(undefined, "UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1", [userId, await hashPassword(input.newPassword)]);
  await revokeUserSessions(userId, sessionId);
  await sendEmail({ to: u.email, template: "password_changed", content: passwordChanged() });
  return { changed: true as const };
}

export async function getMe(userId: string): Promise<Me> {
  const u = await q1<UserRow>(undefined, "SELECT * FROM users WHERE id=$1", [userId]);
  if (!u) throw new AppError("NOT_FOUND", "Account not found.");
  const pa = await q1<{ bank_code: string; bank_name: string; account_number: string; account_name: string; verified: boolean }>(undefined,
    "SELECT bank_code, bank_name, account_number, account_name, verified FROM payout_accounts WHERE user_id=$1", [userId]);
  const unread = await q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL", [userId]);
  const payoutAccount: PayoutAccount | null = pa ? { bankCode: pa.bank_code, bankName: pa.bank_name, accountNumber: pa.account_number, accountName: pa.account_name, verified: pa.verified } : null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, ...(u.business_name ? { businessName: u.business_name } : {}),
    sellerType: u.seller_type, status: u.status, trustScore: u.trust_score, trustLevel: u.trust_level,
    completedOrders: u.completed_orders, payoutAccount, unreadNotifications: unread?.n ?? 0,
  };
}

export async function updateMe(userId: string, input: { name?: string; phone?: string; businessName?: string }) {
  let phone: string | undefined;
  if (input.phone !== undefined) {
    const p = normalizeNgPhone(input.phone);
    if (!p) throw new AppError("VALIDATION", "Enter a valid Nigerian phone number.", { phone: "Enter a valid Nigerian phone number." });
    phone = p;
  }
  await q(undefined, `UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone),
      business_name = CASE WHEN $4::boolean THEN NULLIF($5, '') ELSE business_name END, updated_at = now() WHERE id=$1`,
    [userId, input.name?.trim() ?? null, phone ?? null, input.businessName !== undefined, input.businessName?.trim() ?? null]);
  return getMe(userId);
}
