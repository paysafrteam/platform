import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { assertNeonDatabaseUrl } from "../src/server/db-url";

loadEnvConfig(process.cwd());

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? "";
  const reset = process.argv.includes("--reset");
  if (!email || !password) throw new Error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.");
  if (password.length < 8) throw new Error("ADMIN_SEED_PASSWORD must be at least 8 characters.");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required.");
  assertNeonDatabaseUrl(url, process.env.DATABASE_URL_UNPOOLED ? "DATABASE_URL_UNPOOLED" : "DATABASE_URL");
  const ssl = process.env.DB_SSL === "false"
    ? false
    : process.env.DB_SSL === "true" || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : undefined;
  const clientConfig = { connectionString: url, connectionTimeoutMillis: 10_000 };
  const client = new Client(ssl === undefined ? clientConfig : { ...clientConfig, ssl });
  await client.connect();
  const hash = await bcrypt.hash(password, 12);
  const existing = await client.query("SELECT id FROM admin_users WHERE lower(email)=$1", [email]);
  if (existing.rowCount && !reset) console.log(`Admin ${email} already exists. Nothing changed (use --reset to overwrite the password).`);
  else if (existing.rowCount) {
    await client.query("UPDATE admin_users SET password_hash=$2, password_changed_at=now(), failed_attempts=0, locked_until=NULL WHERE lower(email)=$1", [email, hash]);
    await client.query("UPDATE admin_sessions SET revoked_at=now() WHERE admin_id=$1 AND revoked_at IS NULL", [existing.rows[0].id]);
    console.log(`Admin ${email} password reset.`);
  } else {
    await client.query("INSERT INTO admin_users (email, name, password_hash, role) VALUES ($1,'PaySafr Admin',$2,'super_admin')", [email, hash]);
    console.log(`Admin ${email} created.`);
  }
  await client.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
