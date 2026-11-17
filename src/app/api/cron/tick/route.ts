import { timingSafeEqualStr } from "@/server/ids";
import { env } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { withApi } from "@/server/http/withApi";
import { runTick } from "@/server/services/jobs";

const handler = withApi({ auth: "none", skipOriginCheck: true }, async ({ req }) => {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!given || !timingSafeEqualStr(given, env().CRON_SECRET)) throw new AppError("UNAUTHENTICATED", "Not authorised.");
  return runTick();
});
export const GET = handler;
export const POST = handler;
