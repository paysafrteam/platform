import "server-only";
import { q, q1 } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { rateLimit } from "@/server/http/ratelimit";
import { writeAudit } from "@/server/audit";
import { dummyHash, verifyPassword } from "@/server/auth/password";
import { createAdminSession } from "@/server/auth/session";

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

/** Pure lockout arithmetic (tested). */
export function nextFailureState(failedAttempts: number, now: Date): { failedAttempts: number; lockedUntil: Date | null } {
  const failed = failedAttempts + 1;
  return failed >= MAX_FAILED ? { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedAttempts: failed, lockedUntil: null };
}
export const isLocked = (lockedUntil: Date | null, now: Date) => !!lockedUntil && lockedUntil.getTime() > now.getTime();

export async function adminSignIn(input: { email: string; password: string }, ip: string, ua: string | null) {
  await rateLimit({ key: `admin-signin:${ip}`, limit: 10, windowSeconds: 900 });
  const email = input.email.trim().toLowerCase();
  const a = await q1<{ id: string; name: string; password_hash: string; status: string; failed_attempts: number; locked_until: Date | null }>(undefined,
    "SELECT id, name, password_hash, status, failed_attempts, locked_until FROM admin_users WHERE lower(email)=$1", [email]);
  const generic = new AppError("VALIDATION", "Email or password is incorrect.");
  if (!a) { await verifyPassword(input.password, dummyHash()); await writeAudit(undefined, { actorType: "system", actorLabel: "admin sign-in", action: "admin.sign_in_failed", ip }); throw generic; }
  const now = new Date();
  const locked = isLocked(a.locked_until, now);
  // Always compare, so a locked account and a wrong password take the same time; a correct password is still rejected while locked.
  const ok = await verifyPassword(input.password, a.password_hash);
  if (locked || a.status !== "active") {
    await writeAudit(undefined, { actorType: "admin", actorId: a.id, actorLabel: a.name, action: "admin.sign_in_failed", ip, after: { reason: locked ? "locked" : "disabled" } });
    throw generic;
  }
  if (!ok) {
    const s = nextFailureState(a.failed_attempts, now);
    await q(undefined, "UPDATE admin_users SET failed_attempts=$2, locked_until=$3, updated_at=now() WHERE id=$1", [a.id, s.failedAttempts, s.lockedUntil]);
    await writeAudit(undefined, { actorType: "admin", actorId: a.id, actorLabel: a.name, action: "admin.sign_in_failed", ip, ...(s.lockedUntil ? { after: { lockedUntil: s.lockedUntil } } : {}) });
    throw generic;
  }
  await q(undefined, "UPDATE admin_users SET failed_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$1", [a.id]);
  await createAdminSession(a.id, ip, ua);
  await writeAudit(undefined, { actorType: "admin", actorId: a.id, actorLabel: a.name, action: "admin.sign_in", ip });
  return { signedIn: true as const };
}
