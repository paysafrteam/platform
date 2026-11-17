import bcrypt from "bcryptjs";
import { Client } from "pg";

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? "";
  const reset = process.argv.includes("--reset");
  if (!email || !password) throw new Error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.");
  if (password.length < 8) throw new Error("ADMIN_SEED_PASSWORD must be at least 8 characters.");
  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
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
