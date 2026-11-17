import "server-only";
import { cookies } from "next/headers";
import { q, q1, type Db } from "@/server/db";
import { isProd } from "@/server/env";
import { randomToken, sha256Hex } from "@/server/ids";
import { AppError } from "@/server/http/errors";

export const USER_COOKIE = "ps_session";
export const ADMIN_COOKIE = "ps_admin";
const USER_TTL_S = 30 * 24 * 3600;
const ADMIN_TTL_S = 8 * 3600;
const cookieName = (n: string) => (isProd() ? `__Host-${n}` : n);
export const userCookieName = () => cookieName(USER_COOKIE);
export const adminCookieName = () => cookieName(ADMIN_COOKIE);

export interface SessionUser {
  id: string; email: string; name: string; phone: string; sellerType: string;
  businessName: string | null; status: "active" | "limited" | "suspended"; sessionId: string;
}
export interface SessionAdmin { id: string; email: string; name: string; role: string; sessionId: string }

export async function createUserSession(userId: string, ip: string, ua: string | null, db?: Db) {
  const token = randomToken(32);
  await q(db, `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent) VALUES ($1,$2, now() + make_interval(secs => $3), $4, $5)`,
    [userId, sha256Hex(token), USER_TTL_S, ip, ua?.slice(0, 300) ?? null]);
  (await cookies()).set(userCookieName(), token, {
    httpOnly: true, sameSite: "lax", secure: isProd(), path: "/", maxAge: USER_TTL_S,
  });
}

export async function createAdminSession(adminId: string, ip: string, ua: string | null, db?: Db) {
  const token = randomToken(32);
  await q(db, `INSERT INTO admin_sessions (admin_id, token_hash, expires_at, ip, user_agent) VALUES ($1,$2, now() + make_interval(secs => $3), $4, $5)`,
    [adminId, sha256Hex(token), ADMIN_TTL_S, ip, ua?.slice(0, 300) ?? null]);
  (await cookies()).set(adminCookieName(), token, {
    httpOnly: true, sameSite: "strict", secure: isProd(), path: "/", maxAge: ADMIN_TTL_S,
  });
}

export async function clearCookie(name: string) {
  (await cookies()).set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(userCookieName())?.value;
  if (!token) return null;
  const row = await q1<{
    id: string; email: string; name: string; phone: string; seller_type: string; business_name: string | null;
    status: SessionUser["status"]; session_id: string; last_seen_at: Date;
  }>(undefined, `SELECT u.id, u.email, u.name, u.phone, u.seller_type, u.business_name, u.status, s.id AS session_id, s.last_seen_at
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.email_verified_at IS NOT NULL`, [sha256Hex(token)]);
  if (!row || row.status === "suspended") return null;
  if (Date.now() - row.last_seen_at.getTime() > 24 * 3600_000) {
    await q(undefined, "UPDATE sessions SET last_seen_at = now(), expires_at = now() + make_interval(secs => $2) WHERE id = $1", [row.session_id, USER_TTL_S]);
  }
  return { id: row.id, email: row.email, name: row.name, phone: row.phone, sellerType: row.seller_type,
    businessName: row.business_name, status: row.status, sessionId: row.session_id };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

export async function getOptionalAdmin(): Promise<SessionAdmin | null> {
  const token = (await cookies()).get(adminCookieName())?.value;
  if (!token) return null;
  const row = await q1<{ id: string; email: string; name: string; role: string; session_id: string }>(undefined,
    `SELECT a.id, a.email, a.name, a.role, s.id AS session_id FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND a.status = 'active'`, [sha256Hex(token)]);
  return row ? { id: row.id, email: row.email, name: row.name, role: row.role, sessionId: row.session_id } : null;
}

export async function requireAdmin(): Promise<SessionAdmin> {
  const admin = await getOptionalAdmin();
  if (!admin) throw new AppError("UNAUTHENTICATED", "Admin sign-in required.");
  return admin;
}

export const revokeUserSessions = (userId: string, exceptSessionId: string | null, db?: Db) =>
  q(db, "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2)", [userId, exceptSessionId]);
