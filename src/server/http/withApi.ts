import "server-only";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError, toResponse } from "@/server/http/errors";
import { getClientIp, rateLimit, type RateLimitSpec } from "@/server/http/ratelimit";
import { env } from "@/server/env";
import { requireAdmin, requireUser, type SessionAdmin, type SessionUser } from "@/server/auth/session";

type Params = Record<string, string>;
type RouteCtx = { params: Promise<Params> };

export interface ApiContext<B, Q, A extends "none" | "user" | "admin"> {
  req: NextRequest;
  ip: string;
  requestId: string;
  params: Params;
  body: B;
  query: Q;
  user: A extends "user" ? SessionUser : null;
  admin: A extends "admin" ? SessionAdmin : null;
}

export interface ApiOptions<B, Q, A extends "none" | "user" | "admin"> {
  auth: A;
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  rateLimit?: RateLimitSpec;
  /** Routes that verify their own secret/signature (webhooks, cron) skip the browser Origin check. */
  skipOriginCheck?: boolean;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".") || "_"] ??= issue.message;
  return out;
}

export function isAllowedOrigin(headers: Headers, appUrl: string): boolean {
  const origin = headers.get("origin");
  // A same-host Referer is a fallback only when Origin is absent, never when it is invalid.
  const source = origin ?? headers.get("referer");
  if (!source) return false;

  let host: string;
  let appHost: string;
  try {
    host = new URL(source).host;
    appHost = new URL(appUrl).host;
  } catch {
    return false;
  }
  return new Set([headers.get("host"), appHost]).has(host);
}

function checkOrigin(req: NextRequest) {
  if (!isAllowedOrigin(req.headers, env().NEXT_PUBLIC_APP_URL)) {
    throw new AppError("FORBIDDEN", "Request blocked.");
  }
}

export function withApi<B = undefined, Q = undefined, A extends "none" | "user" | "admin" = "none">(
  opts: ApiOptions<B, Q, A>,
  handler: (ctx: ApiContext<B, Q, A>) => unknown,
) {
  return async (req: NextRequest, routeCtx?: RouteCtx): Promise<Response> => {
    const requestId = randomUUID();
    try {
      const ip = getClientIp(req);
      const mutating = req.method !== "GET" && req.method !== "HEAD";
      if (mutating && !opts.skipOriginCheck) {
        checkOrigin(req);
        if (!(req.headers.get("content-type") ?? "").includes("application/json") && req.headers.get("content-length") !== "0") {
          throw new AppError("VALIDATION", "Content-Type must be application/json.");
        }
      }
      if (opts.rateLimit) await rateLimit({ ...opts.rateLimit, key: `${opts.rateLimit.key}:${ip}` });

      let body = undefined as B;
      if (opts.body) {
        const raw = await req.text();
        if (raw.length > 100_000) throw new AppError("VALIDATION", "Request is too large.");
        let json: unknown = {};
        if (raw.trim()) {
          try { json = JSON.parse(raw); } catch { throw new AppError("VALIDATION", "Invalid JSON body."); }
        }
        const parsed = opts.body.safeParse(json);
        if (!parsed.success) {
          const fields = fieldErrors(parsed.error);
          throw new AppError("VALIDATION", Object.values(fields)[0] ?? "Check your details and try again.", fields);
        }
        body = parsed.data;
      }
      let query = undefined as Q;
      if (opts.query) {
        const parsed = opts.query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
        if (!parsed.success) {
          const fields = fieldErrors(parsed.error);
          throw new AppError("VALIDATION", Object.values(fields)[0] ?? "Invalid query.", fields);
        }
        query = parsed.data;
      }
      const user = (opts.auth === "user" ? await requireUser() : null) as ApiContext<B, Q, A>["user"];
      const admin = (opts.auth === "admin" ? await requireAdmin() : null) as ApiContext<B, Q, A>["admin"];
      const params = routeCtx?.params ? await routeCtx.params : {};
      const result = await handler({ req, ip, requestId, params, body, query, user, admin });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
    } catch (e) {
      // Next.js control-flow errors (prerender bail-outs, redirects) carry a digest and must propagate untouched.
      if (typeof (e as { digest?: unknown })?.digest === "string") throw e;
      return toResponse(e, requestId);
    }
  };
}
