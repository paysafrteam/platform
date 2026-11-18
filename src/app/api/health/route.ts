import { connection, NextResponse } from "next/server";
import { q } from "@/server/db";

export async function GET() {
  await connection();
  try {
    await q(undefined, "SELECT 1");
    return NextResponse.json({ ok: true, db: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "unknown";
    console.error(`[health] database check failed (${code})`);
    return NextResponse.json(
      { ok: false, db: false, error: "Database unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
