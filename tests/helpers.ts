import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import { pool, q, q1 } from "@/server/db";
import { recordFunding } from "@/server/services/funding";
import * as orders from "@/server/services/orders";
import type { SessionUser } from "@/server/auth/session";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }) }));

export async function resetDb() {
  await pool().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const dir = path.join(process.cwd(), "db", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await pool().query(fs.readFileSync(path.join(dir, f), "utf8"));
}

let n = 0;
export async function makeSeller(opts: { account?: boolean; email?: string } = {}): Promise<SessionUser> {
  n++;
  const email = opts.email ?? `seller${n}-${Date.now()}@test.dev`;
  const u = (await q1<{ id: string }>(undefined, `INSERT INTO users (email, email_verified_at, password_hash, name, phone) VALUES ($1, now(), 'x', $2, $3) RETURNING id`, [email, `Seller ${n}`, `+23480000000${String(n).padStart(2, "0")}`]))!;
  if (opts.account !== false) await q(undefined, "INSERT INTO payout_accounts (user_id, bank_code, bank_name, account_number, account_name) VALUES ($1,'058','Guaranty Trust Bank','0123456789','Seller')", [u.id]);
  return { id: u.id, email, name: `Seller ${n}`, phone: "+2348000000000", sellerType: "freelancer", businessName: null, status: "active", sessionId: "s" };
}

export const future = (days = 5) => new Date(Date.now() + days * 86400_000).toISOString();

export async function makeOrder(seller: SessionUser, opts: { milestones?: number[]; reviewWindowHours?: number; buyerEmail?: string } = {}) {
  const ms = opts.milestones ?? [100_000_00];
  const total = ms.reduce((a, b) => a + b, 0);
  return orders.createOrder(seller, {
    title: "Logo design", description: "Two concepts", totalKobo: total, reviewWindowHours: opts.reviewWindowHours ?? 72, deliveryDeadline: future(),
    milestones: ms.map((a, i) => ({ title: `Milestone ${i + 1}`, amountKobo: a })), buyerContact: opts.buyerEmail ? { email: opts.buyerEmail } : undefined, publish: true,
  });
}

let ref = 0;
export const fund = (orderId: string, amountKobo: number, reference = `T-${Date.now()}-${++ref}`) =>
  recordFunding({ orderId, amountKobo, provider: "simulator", providerReference: reference });

export const ledgerSum = async (orderId: string, type: string) =>
  (await q1<{ n: number }>(undefined, "SELECT COALESCE(SUM(amount_kobo),0)::bigint AS n FROM ledger_entries WHERE order_id=$1 AND type=$2", [orderId, type]))!.n;

export const admin = async () => (await q1<{ id: string }>(undefined, "INSERT INTO admin_users (email, name, password_hash) VALUES ($1,'Admin','x') RETURNING id", [`a${Date.now()}${++ref}@t.dev`]))!.id;
