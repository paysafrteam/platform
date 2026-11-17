import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import { q } from "@/server/db";
import { clearCookie, userCookieName } from "@/server/auth/session";
import { getOptionalUser } from "@/server/auth/session";

export const POST = withApi({ auth: "none" }, async () => {
  const user = await getOptionalUser();
  if (user) await q(undefined, "UPDATE sessions SET revoked_at = now() WHERE id = $1", [user.sessionId]);
  await clearCookie(userCookieName());
  return { signedOut: true };
});
