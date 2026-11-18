import { spawn } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const required = ["DATABASE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_ENV", "OTP_PEPPER", "CRON_SECRET"];
const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = ["OTP_PEPPER", "CRON_SECRET"].filter(
  (name) => process.env[name] && process.env[name].length < 32,
);
const isNeonPostgresUrl = (value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname.toLowerCase().endsWith(".neon.tech");
  } catch {
    return false;
  }
};

if (process.env.DATABASE_URL && !isNeonPostgresUrl(process.env.DATABASE_URL)) {
  invalid.push("DATABASE_URL must point to Neon PostgreSQL");
}
if (process.env.DATABASE_URL_UNPOOLED && !isNeonPostgresUrl(process.env.DATABASE_URL_UNPOOLED)) {
  invalid.push("DATABASE_URL_UNPOOLED must point to Neon PostgreSQL");
}

if (process.env.NEXT_PUBLIC_APP_ENV && !["sandbox", "production"].includes(process.env.NEXT_PUBLIC_APP_ENV)) {
  invalid.push("NEXT_PUBLIC_APP_ENV must be sandbox or production");
}

if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
  for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
  if (process.env.PAYMENT_MODE !== "paga") {
    invalid.push("PAYMENT_MODE must be paga in production; simulator mode is sandbox-only");
  }
  if (process.env.PAGA_ENV !== "live") {
    invalid.push("PAGA_ENV must be live in production");
  }
  if (process.env.DB_SSL === "false") {
    invalid.push("DB_SSL cannot be false in production");
  }
  try {
    if (new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").protocol !== "https:") {
      console.warn("[startup] HTTPS is required before handling real users or payments.");
    }
  } catch {
    // URL validation is reported by the application environment schema.
  }
  if (process.env.COOKIE_SECURE === "false") {
    console.warn("[startup] COOKIE_SECURE=false is for temporary HTTP testing only.");
  }
}
if (process.env.PAYMENT_MODE === "paga") {
  for (const name of ["PAGA_PUBLIC_KEY", "PAGA_SECRET_KEY", "PAGA_HASH_KEY"]) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
}
if (missing.length || invalid.length) {
  if (missing.length) console.error(`[startup] Missing environment variables: ${[...new Set(missing)].join(", ")}`);
  if (invalid.length) console.error(`[startup] Invalid environment configuration: ${invalid.join("; ")}`);
  process.exit(1);
}

const port = "3000";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", port],
  { stdio: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
