import { withApi } from "@/server/http/withApi";
import { createHash } from "node:crypto";
import { env } from "@/server/env";
import { timingSafeEqualStr } from "@/server/ids";
import { q1 } from "@/server/db";
import { recordFunding } from "@/server/services/funding";

type JsonObject = Record<string, unknown>;

function sha512Hex(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex");
}

export const POST = withApi({ auth: "none", skipOriginCheck: true }, async ({ req }) => {
  if (env().PAYMENT_MODE !== "paga") {
    return Response.json({ ok: false, error: "Paga payments are disabled." }, { status: 503 });
  }
  const raw = await req.text();
  if (!raw || raw.length > 100_000) return Response.json({ ok: false }, { status: 400 });
  let payload: JsonObject;
  try { payload = JSON.parse(raw) as JsonObject; } catch { return Response.json({ ok: false }, { status: 400 }); }
  const hash = String(req.headers.get("hash") ?? payload.hash ?? payload.HASH ?? "");
  const key = env().PAGA_HASH_KEY!;
  const referenceNumber = String(payload.referenceNumber ?? payload.reference ?? "");
  const amount = String(payload.amount ?? "");
  const transactionId = String(payload.transactionId ?? payload.transaction_id ?? "");
  const currency = String(payload.currency ?? "NGN");
  const status = String(payload.status ?? payload.statusMessage ?? payload.transactionStatus ?? "").toUpperCase();
  const candidates = [
    sha512Hex(`${raw}${key}`),
    sha512Hex(`${referenceNumber}${amount}${transactionId}${status}${key}`),
    sha512Hex(`${referenceNumber}${amount}${currency}${transactionId}${key}`),
    sha512Hex(`${referenceNumber}${amount}${transactionId}${key}`),
    sha512Hex(`${referenceNumber}${amount}${key}`),
  ];
  if (!hash || !candidates.some((candidate) => timingSafeEqualStr(candidate, hash))) {
    return Response.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }
  if (status && !["SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED", "0"].includes(status)) {
    return Response.json({ ok: true });
  }
  const statusCode = String(payload.statusCode ?? "");
  if (statusCode && statusCode !== "0" && !status) return Response.json({ ok: true });

  let orderId = referenceNumber.startsWith("PS-") ? referenceNumber.slice(3) : "";
  if (!orderId) {
    const accountNumber = String(payload.accountNumber ?? payload.destinationAccountNumber ?? "");
    if (accountNumber) {
      const row = await q1<{ id: string }>(undefined, "SELECT id FROM orders WHERE order_account_number=$1", [accountNumber]);
      orderId = row?.id ?? "";
    }
  }
  if (!orderId || !transactionId || !amount) return Response.json({ ok: false, error: "Missing callback fields." }, { status: 400 });
  const amountKobo = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return Response.json({ ok: false, error: "Invalid amount." }, { status: 400 });
  await recordFunding({ orderId, amountKobo, provider: "paga", providerReference: transactionId, raw: payload });
  return Response.json({ ok: true });
});
