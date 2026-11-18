import { spawn } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const required = ["DATABASE_URL", "NEXT_PUBLIC_APP_URL", "OTP_PEPPER", "CRON_SECRET"];
const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = ["OTP_PEPPER", "CRON_SECRET"].filter(
  (name) => process.env[name] && process.env[name].length < 32,
);

if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
  for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
}
if (process.env.PAYMENT_MODE === "paga") {
  for (const name of ["PAGA_PUBLIC_KEY", "PAGA_SECRET_KEY", "PAGA_HASH_KEY"]) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
}
if (missing.length || invalid.length) {
  if (missing.length) console.error(`[startup] Missing environment variables: ${[...new Set(missing)].join(", ")}`);
  if (invalid.length) console.error(`[startup] Environment variables must be at least 32 characters: ${invalid.join(", ")}`);
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
