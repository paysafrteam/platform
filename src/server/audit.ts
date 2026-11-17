import "server-only";
import { q, type Db } from "@/server/db";

export interface AuditEntry {
  actorType: "admin" | "user" | "system";
  actorId?: string | null;
  actorLabel: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

export async function writeAudit(db: Db | undefined, e: AuditEntry): Promise<void> {
  await q(
    db,
    `INSERT INTO audit_log (actor_type, actor_id, actor_label, action, target_type, target_id, before, after, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [e.actorType, e.actorId ?? null, e.actorLabel, e.action, e.targetType ?? null, e.targetId ?? null,
     e.before === undefined ? null : JSON.stringify(e.before), e.after === undefined ? null : JSON.stringify(e.after), e.ip ?? null],
  );
}
