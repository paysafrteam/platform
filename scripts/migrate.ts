import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required.");
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const done = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (done.rowCount) continue;
    console.log(`Applying ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log("Migrations up to date.");
  await client.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
