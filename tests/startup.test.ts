import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production startup configuration", () => {
  it("refuses simulator payments without printing environment values", () => {
    const result = spawnSync(process.execPath, ["scripts/start.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:password@ep-test.neon.tech/paysafr",
        NEXT_PUBLIC_APP_URL: "http://example.test",
        NEXT_PUBLIC_APP_ENV: "production",
        OTP_PEPPER: "p".repeat(32),
        CRON_SECRET: "c".repeat(32),
        SMTP_HOST: "smtp.example.test",
        SMTP_USER: "user@example.test",
        SMTP_PASS: "not-a-real-password",
        PAYMENT_MODE: "simulator",
        PAGA_ENV: "sandbox",
        DB_SSL: "true",
        COOKIE_SECURE: "false",
      },
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("PAYMENT_MODE must be paga in production");
    expect(output).not.toContain("not-a-real-password");
  });

  it("rejects a non-Neon database URL", () => {
    const result = spawnSync(process.execPath, ["scripts/start.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: "postgres://localhost:5432/paysafr",
        NEXT_PUBLIC_APP_URL: "http://example.test",
        NEXT_PUBLIC_APP_ENV: "sandbox",
        OTP_PEPPER: "p".repeat(32),
        CRON_SECRET: "c".repeat(32),
        PAYMENT_MODE: "simulator",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL must point to Neon PostgreSQL");
  });
});
