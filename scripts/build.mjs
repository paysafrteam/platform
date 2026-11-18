import { spawn } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const required = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_ENV"];
const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = [];

if (process.env.NEXT_PUBLIC_APP_ENV && !["sandbox", "production"].includes(process.env.NEXT_PUBLIC_APP_ENV)) {
  invalid.push("NEXT_PUBLIC_APP_ENV must be sandbox or production");
}

if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const protocol = new URL(process.env.NEXT_PUBLIC_APP_URL).protocol;
    if (protocol !== "http:" && protocol !== "https:") {
      invalid.push("NEXT_PUBLIC_APP_URL must use http or https");
    }
  } catch {
    invalid.push("NEXT_PUBLIC_APP_URL must be an absolute http(s) URL");
  }
}

if (missing.length || invalid.length) {
  if (missing.length) console.error(`[build] Missing environment variables: ${missing.join(", ")}`);
  if (invalid.length) console.error(`[build] Invalid environment configuration: ${invalid.join("; ")}`);
  process.exit(1);
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(`[build] Could not start Next.js build: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
