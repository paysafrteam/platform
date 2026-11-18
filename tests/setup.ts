process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://paysafr:PaySafrTeam100@localhost:5432/paysafr_test";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_ENV = "sandbox";
process.env.OTP_PEPPER = "test-pepper-test-pepper-test-pepper-1234";
process.env.CRON_SECRET = "test-cron-secret-test-cron-secret-1234";
process.env.PAYMENT_MODE = "simulator";
process.env.SIMULATOR_FAIL_PAYOUTS = "false";
