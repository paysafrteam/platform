import { withApi } from "@/server/http/withApi";
import { q } from "@/server/db";
import { adminCookieName, clearCookie, getOptionalAdmin } from "@/server/auth/session";

export const POST = withApi({ auth: "none" }, async () => {
  const a = await getOptionalAdmin();
  if (a) await q(undefined, "UPDATE admin_sessions SET revoked_at = now() WHERE id = $1", [a.sessionId]);
  await clearCookie(adminCookieName());
  return { signedOut: true };
});
