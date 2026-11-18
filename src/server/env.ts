import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DB_SSL: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  OTP_PEPPER: z.string().min(32, "must be at least 32 characters"),
  CRON_SECRET: z.string().min(32, "must be at least 32 characters"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("PaySafr <no-reply@paysafr.local>"),
  PAYMENT_MODE: z.enum(["simulator", "paga"]).default("simulator"),
  BANK_RESOLVER: z.enum(["manual", "paga"]).default("manual"),
  PAGA_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAGA_PUBLIC_KEY: z.string().optional(),
  PAGA_SECRET_KEY: z.string().optional(),
  PAGA_HASH_KEY: z.string().optional(),
  SIMULATOR_FAIL_PAYOUTS: z.enum(["true", "false"]).default("false"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Validates lazily so `next build` works without secrets; fails with a readable list on first use. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n - ${names.join("\n - ")}`);
  }
  const e = parsed.data;
  if (e.PAYMENT_MODE === "paga" && (!e.PAGA_PUBLIC_KEY || !e.PAGA_SECRET_KEY || !e.PAGA_HASH_KEY)) {
    throw new Error("PAGA_PUBLIC_KEY, PAGA_SECRET_KEY, and PAGA_HASH_KEY are required when PAYMENT_MODE=paga");
  }
  if (e.NEXT_PUBLIC_APP_ENV === "production" && !(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS)) {
    throw new Error("Invalid environment configuration: SMTP_HOST, SMTP_USER and SMTP_PASS are required in production.");
  }
  cached = e;
  return e;
}

export const isProd = () => env().NEXT_PUBLIC_APP_ENV === "production";
export const secureCookies = () => env().COOKIE_SECURE === undefined ? isProd() : env().COOKIE_SECURE === "true";
export const emailConfigured = () => Boolean(env().SMTP_HOST && env().SMTP_USER && env().SMTP_PASS);
