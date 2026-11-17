import { NextResponse } from "next/server";
import { q } from "@/server/db";

export async function GET() {
  try {
    await q(undefined, "SELECT 1");
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
