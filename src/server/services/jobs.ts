import "server-only";
import { q, q1, withTx } from "@/server/db";
import { AppError } from "@/server/http/errors";
import { writeAudit } from "@/server/audit";
import { emailBuyer, notify } from "@/server/services/notifications";
import { lockOrder, settleMilestone } from "@/server/services/settlement";
import { processPayout } from "@/server/services/payouts";
import { REMINDER_BEFORE_RELEASE_HOURS } from "@/lib/domain/rules";

export interface TickSummary { expired: number; reminded: number; autoReleased: number; payoutsRetried: number; errors: number }

async function expireUnpaid(): Promise<number> {
  const rows = await q<{ id: string }>(undefined, "SELECT id FROM orders WHERE status='awaiting_payment' AND expires_at <= now() LIMIT 200");
  let n = 0;
  for (const r of rows) {
    await withTx(async (tx) => {
      const { order } = await lockOrder(tx, r.id);
      if (order.status !== "awaiting_payment") return;
      const o = (await q1<{ amount_funded_kobo: number; expires_at: Date }>(tx, "SELECT amount_funded_kobo, expires_at FROM orders WHERE id=$1", [r.id]))!;
      if (o.expires_at.getTime() > Date.now()) return;
      await q(tx, "UPDATE orders SET status='expired', needs_refund_flag = $2, updated_at=now() WHERE id=$1", [r.id, o.amount_funded_kobo > 0]);
      await writeAudit(tx, { actorType: "system", actorLabel: "job:expire", action: "order.expired", targetType: "order", targetId: r.id });
      n++;
    });
  }
  return n;
}

async function sendReminders(): Promise<number> {
  const rows = await q<{ id: string; order_id: string }>(undefined,
    `SELECT id, order_id FROM milestones WHERE status='delivered' AND reminder_sent_at IS NULL AND release_at > now()
     AND release_at <= now() + make_interval(hours => $1) LIMIT 200`, [REMINDER_BEFORE_RELEASE_HOURS]);
  let n = 0;
  for (const r of rows) {
    await withTx(async (tx, defer) => {
      const { order, milestones } = await lockOrder(tx, r.order_id);
      const m = milestones.find((x) => x.id === r.id);
      const flag = await q1<{ ok: boolean }>(tx, "SELECT (status='delivered' AND reminder_sent_at IS NULL) AS ok FROM milestones WHERE id=$1", [r.id]);
      if (!m || !flag?.ok) return;
      await q(tx, "UPDATE milestones SET reminder_sent_at=now() WHERE id=$1", [r.id]);
      await notify(tx, defer, { userId: order.seller_id, type: "reminder", title: "Automatic release is close",
        message: `"${m.title}" will be released automatically in under ${REMINDER_BEFORE_RELEASE_HOURS} hours unless the buyer responds.`, orderId: order.id });
      emailBuyer(defer, order.buyer_email, "Payment will be released soon", `Payment for "${m.title}" is released to the seller in under ${REMINDER_BEFORE_RELEASE_HOURS} hours. Confirm it now, ask for changes, or open a dispute if something is wrong.`, `/pay/${order.token}`, "Review delivery");
      n++;
    });
  }
  return n;
}

async function autoRelease(): Promise<{ released: number; errors: number }> {
  const rows = await q<{ id: string }>(undefined, "SELECT id FROM milestones WHERE status='delivered' AND release_at <= now() ORDER BY release_at LIMIT 200");
  let released = 0, errors = 0;
  for (const r of rows) {
    try { await settleMilestone({ milestoneId: r.id, trigger: "auto" }); released++; }
    catch (e) { if (!(e instanceof AppError && e.code === "INVALID_STATE")) { errors++; console.error("[job:auto-release] failed"); } }
  }
  return { released, errors };
}

async function retryPayouts(): Promise<number> {
  // A payout stuck in 'processing' (crashed worker) is re-queued; providers dedupe on the payout id.
  await q(undefined, "UPDATE payouts SET status='queued', updated_at=now() WHERE status='processing' AND updated_at < now() - interval '10 minutes'");
  const rows = await q<{ id: string }>(undefined,
    `SELECT id FROM payouts WHERE (status='queued' AND updated_at < now() - interval '30 seconds')
        OR (status='failed' AND attempts < 3 AND updated_at < now() - interval '1 minute') ORDER BY created_at LIMIT 100`);
  let n = 0;
  for (const r of rows) { const res = await processPayout(r.id); if (res !== "skipped") n++; }
  return n;
}

export async function runTick(): Promise<TickSummary> {
  const run = await q1<{ id: string }>(undefined, "INSERT INTO job_runs DEFAULT VALUES RETURNING id");
  const summary: TickSummary = { expired: 0, reminded: 0, autoReleased: 0, payoutsRetried: 0, errors: 0 };
  let ok = true;
  const step = async <T>(fn: () => Promise<T>, apply: (v: T) => void) => { try { apply(await fn()); } catch (e) { ok = false; summary.errors++; console.error("[job] step failed:", e instanceof Error ? e.message : "error"); } };
  await step(expireUnpaid, (v) => (summary.expired = v));
  await step(sendReminders, (v) => (summary.reminded = v));
  await step(autoRelease, (v) => { summary.autoReleased = v.released; summary.errors += v.errors; });
  await step(retryPayouts, (v) => (summary.payoutsRetried = v));
  await q(undefined, "UPDATE job_runs SET finished_at=now(), ok=$2, detail=$3 WHERE id=$1", [run!.id, ok && summary.errors === 0, JSON.stringify(summary)]);
  return summary;
}
