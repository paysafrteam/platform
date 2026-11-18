import bcrypt from "bcryptjs";
import { Client } from "pg";

function promptHidden(label: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    let value = "";
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume(); stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") { if (stdin.isTTY) stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n"); return resolve(value); }
        if (c === "\u0003") process.exit(1);
        if (c === "\u007f") value = value.slice(0, -1); else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:set-password -- <admin-email>");
  const a = await promptHidden("New password: ");
  const b = await promptHidden("Repeat password: ");
  if (a !== b) throw new Error("Passwords do not match.");
  if (a.length < 8) throw new Error("Password must be at least 8 characters.");
  if (a.length < 10) console.warn("Warning: use at least 10 characters for an admin password.");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required.");
  const ssl = process.env.DB_SSL === "false"
    ? false
    : process.env.DB_SSL === "true" || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : undefined;
  const clientConfig = { connectionString: url, connectionTimeoutMillis: 10_000 };
  const client = new Client(ssl === undefined ? clientConfig : { ...clientConfig, ssl });
  await client.connect();
  const r = await client.query("UPDATE admin_users SET password_hash=$2, password_changed_at=now(), failed_attempts=0, locked_until=NULL, updated_at=now() WHERE lower(email)=$1 RETURNING id", [email, await bcrypt.hash(a, 12)]);
  if (!r.rowCount) throw new Error("No admin with that email.");
  await client.query("UPDATE admin_sessions SET revoked_at=now() WHERE admin_id=$1 AND revoked_at IS NULL", [r.rows[0].id]);
  await client.query("INSERT INTO audit_log (actor_type, actor_label, action, target_type, target_id) VALUES ('system','cli','admin.password_changed','admin',$1)", [r.rows[0].id]);
  console.log("Password updated and all admin sessions revoked.");
  await client.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
