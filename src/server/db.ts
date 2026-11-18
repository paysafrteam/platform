import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { env } from "@/server/env";

// bigint (int8) and numeric come back as strings by default; kobo amounts are safe integers.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

const g = globalThis as unknown as { __psPool?: Pool };

export function pool(): Pool {
  if (!g.__psPool) {
    const config = env();
    const ssl = config.DB_SSL === "false"
      ? false
      : config.DB_SSL === "true" || process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : undefined;
    const poolConfig = {
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_MAX,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    };
    g.__psPool = new Pool(ssl === undefined ? poolConfig : { ...poolConfig, ssl });
    g.__psPool.on("error", (e) => {
      const code = "code" in e && typeof e.code === "string" ? e.code : "unknown";
      console.error(`[db] idle client error (${code})`);
    });
  }
  return g.__psPool;
}

export type Db = Pick<PoolClient, "query">;

export async function q<T extends QueryResultRow = QueryResultRow>(
  db: Db | undefined,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await (db ?? pool()).query<T>(text, params)).rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(
  db: Db | undefined,
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await q<T>(db, text, params))[0] ?? null;
}

export type Defer = (fn: () => Promise<unknown>) => void;

/**
 * Runs fn inside a transaction; rolls back on any thrown error.
 * Work registered with defer() (emails, payout calls) runs only after a successful COMMIT, and never throws.
 */
export async function withTx<T>(fn: (tx: PoolClient, defer: Defer) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  const hooks: (() => Promise<unknown>)[] = [];
  let result: T;
  try {
    await client.query("BEGIN");
    result = await fn(client, (f) => hooks.push(f));
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  for (const h of hooks) {
    try { await h(); } catch (e) { console.error("[tx hook failed]", e instanceof Error ? e.message : "error"); }
  }
  return result;
}

export async function closePool() {
  if (g.__psPool) {
    await g.__psPool.end();
    g.__psPool = undefined;
  }
}
