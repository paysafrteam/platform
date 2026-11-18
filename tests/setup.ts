if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required; use a dedicated disposable database, never production.");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_ENV = "sandbox";
process.env.OTP_PEPPER = "test-pepper-test-pepper-test-pepper-1234";
process.env.CRON_SECRET = "test-cron-secret-test-cron-secret-1234";
process.env.PAYMENT_MODE = "simulator";
process.env.SIMULATOR_FAIL_PAYOUTS = "false";
