import { beforeAll, describe, expect, it } from "vitest";
import { admin, fund, ledgerSum, makeOrder, makeSeller, resetDb } from "./helpers";
import { q, q1, pool } from "@/server/db";
import * as orders from "@/server/services/orders";
import { settleMilestone } from "@/server/services/settlement";
import { runTick } from "@/server/services/jobs";
import { resolveDispute, openBuyerDispute, addEvidence } from "@/server/services/disputes";
import { getPublicOrderByToken } from "@/server/mappers/orders";
import { getDashboard } from "@/server/services/workspace";
import { refundUnallocated } from "@/server/services/orders";
import { processPayout } from "@/server/services/payouts";

beforeAll(resetDb);

const state = async (id: string) => (await q1<{ status: string; amount_funded_kobo: number; overpaid_kobo: number; needs_refund_flag: boolean }>(undefined, "SELECT status, amount_funded_kobo, overpaid_kobo, needs_refund_flag FROM orders WHERE id=$1", [id]))!;
const msOf = async (id: string) => q<{ id: string; status: string }>(undefined, "SELECT id, status FROM milestones WHERE order_id=$1 ORDER BY position", [id]);

describe("full happy path", () => {
  it("creates, funds, delivers, confirms, releases and pays out with a consistent ledger", async () => {
    const s = await makeSeller();
    const o = await makeOrder(s, { milestones: [100_000_00] });
    expect(o.status).toBe("awaiting_payment");
    expect(o.orderAccount?.accountNumber).toMatch(/^99\d{8}$/);
    expect(o.feeKobo).toBe(200_000); // 2% of ₦100,000
    expect((await fund(o.id, 100_000_00)).status).toBe("funded");
    const [m] = await msOf(o.id);
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "Delivered files" });
    const pub = await orders.confirmMilestone(o.token, m!.id);
    expect(pub.status).toBe("completed");
    expect(await ledgerSum(o.id, "funding")).toBe(10_000_000);
    expect(await ledgerSum(o.id, "release")).toBe(9_800_000);
    expect(await ledgerSum(o.id, "fee")).toBe(200_000);
    const payout = await q1<{ status: string; amount_kobo: number }>(undefined, "SELECT status, amount_kobo FROM payouts WHERE order_id=$1", [o.id]);
    expect(payout).toMatchObject({ status: "paid", amount_kobo: 9_800_000 });
    expect(pub.paymentReceipt?.number).toMatch(/^PS-\d{4}-\d{6}$/);
    expect(pub.completionReceipt).not.toBeNull();
    const dash = await getDashboard(s.id);
    expect(dash.paidOutKobo).toBe(9_800_000);
  });

  it("public DTO never leaks seller contact, bank or ids", async () => {
    const s = await makeSeller();
    const o = await makeOrder(s, { buyerEmail: "buyer@example.com" });
    const pub = await getPublicOrderByToken(o.token);
    const json = JSON.stringify(pub);
    expect(json).not.toContain(s.email);
    expect(json).not.toContain("0123456789");
    expect(json).not.toContain(s.id);
    expect(json).not.toContain("buyer@example.com");
    expect(pub?.buyerContact?.email).toBe("b***@example.com");
  });
});

describe("funding edge cases", () => {
  it("duplicate notification is processed once", async () => {
    const s = await makeSeller(); const o = await makeOrder(s);
    const a = await fund(o.id, 100_000_00, "DUP-1"); const b = await fund(o.id, 100_000_00, "DUP-1");
    expect(a.duplicate).toBe(false); expect(b.duplicate).toBe(true);
    expect(await ledgerSum(o.id, "funding")).toBe(10_000_000);
  });
  it("underpayment keeps order awaiting; top-up funds it", async () => {
    const s = await makeSeller(); const o = await makeOrder(s);
    await fund(o.id, 4_000_000);
    expect((await state(o.id)).status).toBe("awaiting_payment");
    await fund(o.id, 6_000_000);
    expect((await state(o.id)).status).toBe("funded");
  });
  it("overpayment is flagged and refundable once", async () => {
    const s = await makeSeller(); const o = await makeOrder(s);
    await fund(o.id, 10_500_000);
    expect(await state(o.id)).toMatchObject({ status: "funded", overpaid_kobo: 500_000, needs_refund_flag: true });
    expect((await refundUnallocated(o.id)).refundedKobo).toBe(500_000);
    await expect(refundUnallocated(o.id)).rejects.toThrow();
    expect(await ledgerSum(o.id, "refund")).toBe(500_000);
  });
  it("late payment on an expired order is flagged and refundable", async () => {
    const s = await makeSeller(); const o = await makeOrder(s);
    await q(undefined, "UPDATE orders SET expires_at = now() - interval '1 hour' WHERE id=$1", [o.id]);
    await runTick();
    expect((await state(o.id)).status).toBe("expired");
    await fund(o.id, 10_000_000);
    expect(await state(o.id)).toMatchObject({ status: "expired", needs_refund_flag: true });
    expect((await refundUnallocated(o.id)).refundedKobo).toBe(10_000_000);
  });
});

describe("settlement safety", () => {
  it("concurrent confirms release exactly once", async () => {
    const s = await makeSeller(); const o = await makeOrder(s); await fund(o.id, 10_000_000);
    const [m] = await msOf(o.id);
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "link", content: "https://example.com/final" });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => settleMilestone({ milestoneId: m!.id, trigger: "buyer" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await ledgerSum(o.id, "release")).toBe(9_800_000);
    expect((await q(undefined, "select 1 from payouts where order_id=$1", [o.id])).length).toBe(1);
  });
  it("auto-release after the review window, with reminder first", async () => {
    const s = await makeSeller(); const o = await makeOrder(s, { reviewWindowHours: 24 }); await fund(o.id, 10_000_000);
    const [m] = await msOf(o.id);
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "done" });
    await q(undefined, "UPDATE milestones SET release_at = now() + interval '2 hours' WHERE id=$1", [m!.id]);
    const t1 = await runTick(); expect(t1.reminded).toBeGreaterThanOrEqual(1);
    await q(undefined, "UPDATE milestones SET release_at = now() - interval '1 minute' WHERE id=$1", [m!.id]);
    await runTick();
    expect((await state(o.id)).status).toBe("completed");
  });
  it("milestones deliver in order and the order completes only after all", async () => {
    const s = await makeSeller(); const o = await makeOrder(s, { milestones: [5_000_000, 5_000_000] }); await fund(o.id, 10_000_000);
    const [m1, m2] = await msOf(o.id);
    await expect(orders.deliverMilestone(s, o.id, m2!.id, { kind: "note", content: "x" })).rejects.toThrow();
    await orders.deliverMilestone(s, o.id, m1!.id, { kind: "note", content: "one" });
    await expect(orders.deliverMilestone(s, o.id, m2!.id, { kind: "note", content: "too soon" })).rejects.toThrow(/earlier milestone/);
    await orders.confirmMilestone(o.token, m1!.id);
    expect((await state(o.id)).status).toBe("funded");
    await orders.deliverMilestone(s, o.id, m2!.id, { kind: "note", content: "two" });
    await orders.confirmMilestone(o.token, m2!.id);
    expect((await state(o.id)).status).toBe("completed");
    expect(await ledgerSum(o.id, "release")).toBe(9_800_000);
  });
  it("change requests are capped at two and re-delivery restarts the window", async () => {
    const s = await makeSeller(); const o = await makeOrder(s); await fund(o.id, 10_000_000);
    const [m] = await msOf(o.id);
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "v1" });
    await orders.requestChanges(o.token, m!.id, "please fix colours");
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "v2" });
    await orders.requestChanges(o.token, m!.id, "one more tweak");
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "v3" });
    await expect(orders.requestChanges(o.token, m!.id, "third")).rejects.toThrow(/both change requests/);
  });
  it("ledger is append-only and held balance cannot go negative", async () => {
    const s = await makeSeller(); const o = await makeOrder(s); await fund(o.id, 10_000_000);
    await expect(pool().query("UPDATE ledger_entries SET amount_kobo = 1")).rejects.toThrow(/append-only/);
    await expect(pool().query("DELETE FROM ledger_entries")).rejects.toThrow(/append-only/);
    await expect(pool().query("INSERT INTO ledger_entries (order_id,type,amount_kobo,reference,idempotency_key) VALUES ($1,'refund',99999999,'x','neg')", [o.id])).rejects.toThrow(/below zero/);
  });
  it("failed payouts stay failed and are retried by the job without double paying", async () => {
    process.env.SIMULATOR_FAIL_PAYOUTS = "true";
    const { env } = await import("@/server/env"); (env() as { SIMULATOR_FAIL_PAYOUTS: string }).SIMULATOR_FAIL_PAYOUTS = "true";
    const s = await makeSeller(); const o = await makeOrder(s); await fund(o.id, 10_000_000);
    const [m] = await msOf(o.id);
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "x" });
    await orders.confirmMilestone(o.token, m!.id);
    const p = (await q1<{ id: string; status: string }>(undefined, "SELECT id, status FROM payouts WHERE order_id=$1", [o.id]))!;
    expect(p.status).toBe("failed");
    (env() as { SIMULATOR_FAIL_PAYOUTS: string }).SIMULATOR_FAIL_PAYOUTS = "false";
    expect(await processPayout(p.id)).toBe("paid");
    expect(await processPayout(p.id)).toBe("skipped");
  });
});

describe("disputes", () => {
  async function disputed(milestones = [10_000_000]) {
    const s = await makeSeller(); const o = await makeOrder(s, { milestones }); await fund(o.id, milestones.reduce((a, b) => a + b, 0));
    const [m] = await msOf(o.id);
    await orders.deliverMilestone(s, o.id, m!.id, { kind: "note", content: "work" });
    const d = await openBuyerDispute(o.token, { milestoneId: m!.id, reason: "not_as_described", note: "This is not what we agreed on at all.", evidence: [{ type: "text", content: "screenshot desc" }] });
    return { s, o, m: m!, d };
  }
  it("freezes the milestone: no confirm, no auto-release; admin split settles money exactly", async () => {
    const { s, o, m, d } = await disputed();
    await expect(settleMilestone({ milestoneId: m.id, trigger: "buyer" })).rejects.toThrow();
    await q(undefined, "UPDATE milestones SET release_at = now() - interval '1 hour' WHERE id=$1", [m.id]);
    await runTick();
    expect((await msOf(o.id))[0]!.status).toBe("disputed");
    const adm = await admin();
    await expect(resolveDispute({ id: adm, label: "A" }, d.id, { outcome: "release_to_seller", reason: "Seller delivered fine." })).rejects.toThrow(/response window/);
    await addEvidence({ side: "seller", sellerId: s.id, orderId: o.id }, d.id, { type: "text", content: "my side" });
    await resolveDispute({ id: adm, label: "A" }, d.id, { outcome: "split", splitToSellerKobo: 6_000_000, reason: "Partial delivery of the work.", decideEarly: true });
    expect(await ledgerSum(o.id, "release") + await ledgerSum(o.id, "fee")).toBe(6_000_000);
    expect(await ledgerSum(o.id, "refund")).toBe(4_000_000);
    expect(await ledgerSum(o.id, "funding") - (await ledgerSum(o.id, "release")) - (await ledgerSum(o.id, "fee")) - (await ledgerSum(o.id, "refund"))).toBe(0);
    expect((await state(o.id)).status).toBe("completed");
    await expect(resolveDispute({ id: adm, label: "A" }, d.id, { outcome: "refund_to_buyer", reason: "again again again", decideEarly: true })).rejects.toThrow();
    const audit = await q1<{ n: number }>(undefined, "SELECT count(*)::int AS n FROM audit_log WHERE target_id=$1", [d.id]);
    expect(audit!.n).toBeGreaterThanOrEqual(2);
  });
  it("full refund returns the money; split bounds are enforced", async () => {
    const { o, d } = await disputed(); const adm = await admin();
    await expect(resolveDispute({ id: adm, label: "A" }, d.id, { outcome: "split", splitToSellerKobo: 10_000_000, reason: "bad split here", decideEarly: true })).rejects.toThrow();
    await resolveDispute({ id: adm, label: "A" }, d.id, { outcome: "refund_to_buyer", reason: "Nothing was delivered.", decideEarly: true });
    expect(await ledgerSum(o.id, "refund")).toBe(10_000_000);
    expect(await ledgerSum(o.id, "release")).toBe(0);
  });
  it("buyer can dispute a pending milestone only after the delivery deadline", async () => {
    const s = await makeSeller(); const o = await makeOrder(s); await fund(o.id, 10_000_000);
    const [m] = await msOf(o.id);
    await expect(openBuyerDispute(o.token, { milestoneId: m!.id, reason: "not_delivered", note: "Nothing has been delivered yet." })).rejects.toThrow();
    await q(undefined, "UPDATE orders SET delivery_deadline = now() - interval '1 day' WHERE id=$1", [o.id]);
    await openBuyerDispute(o.token, { milestoneId: m!.id, reason: "not_delivered", note: "Nothing has been delivered yet." });
    expect((await msOf(o.id))[0]!.status).toBe("disputed");
  });
});
