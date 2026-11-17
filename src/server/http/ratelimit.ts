import "server-only";
import { q1, type Db } from "@/server/db";
import { AppError } from "@/server/http/errors";

export interface RateLimitSpec { key: string; limit: number; windowSeconds: number }

/** Postgres fixed-window limiter: one atomic upsert per check. */
export async function rateLimit(spec: RateLimitSpec, db?: Db): Promise<void> {
  const row = await q1<{ count: number; retry: number }>(
    db,
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END,
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END
     RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2) - now()))))::int AS retry`,
    [spec.key, spec.windowSeconds],
  );
  if (row && row.count > spec.limit) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.", undefined, { retryAfterSeconds: row.retry });
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
