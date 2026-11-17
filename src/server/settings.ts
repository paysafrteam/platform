import "server-only";
import { q, type Db } from "@/server/db";
import { AppError } from "@/server/http/errors";

export interface PlatformSettings { review_window_hours: number; unpaid_expiry_hours: number; dispute_response_hours: number }
export const SETTING_RANGES = {
  review_window_hours: [24, 336], unpaid_expiry_hours: [1, 168], dispute_response_hours: [24, 120],
} as const;
const DEFAULTS: PlatformSettings = { review_window_hours: 72, unpaid_expiry_hours: 48, dispute_response_hours: 48 };

export async function getSettings(db?: Db): Promise<PlatformSettings> {
  const rows = await q<{ key: string; value: unknown }>(db, "SELECT key, value FROM platform_settings");
  const out = { ...DEFAULTS };
  for (const r of rows) if (r.key in out && typeof r.value === "number") (out as Record<string, number>)[r.key] = r.value;
  return out;
}

export async function updateSettings(db: Db, patch: Partial<PlatformSettings>, updatedBy: string) {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    const range = SETTING_RANGES[k as keyof PlatformSettings];
    if (!range) continue;
    if (!Number.isInteger(v) || (v as number) < range[0] || (v as number) > range[1]) {
      fields[k] = `Must be a whole number between ${range[0]} and ${range[1]}.`;
    }
  }
  if (Object.keys(fields).length) throw new AppError("VALIDATION", "Check the highlighted settings.", fields);
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in SETTING_RANGES)) continue;
    await q(db, `INSERT INTO platform_settings (key, value, updated_by) VALUES ($1,$2,$3)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [k, JSON.stringify(v), updatedBy]);
  }
}
