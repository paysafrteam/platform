import { AppError } from "@/server/http/errors";
import { withApi } from "@/server/http/withApi";
import { env } from "@/server/env";
import { verifyPayoutCallback, type PagaPayoutCallback } from "@/server/payments/paga-hash";
import { processPagaPayoutNotification } from "@/server/services/paga-payout-reconciliation";

export const POST = withApi({ auth: "none", skipOriginCheck: true }, async ({ req }) => {
  if (env().PAYMENT_MODE !== "paga") throw new AppError("NOT_FOUND", "Not found.");
  const raw = await req.text();
  if (!raw || raw.length > 100_000) throw new AppError("VALIDATION", "Invalid Paga payout callback.");

  let payload: PagaPayoutCallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("VALIDATION", "Invalid Paga payout callback.");
    }
    payload = parsed as PagaPayoutCallback;
  } catch {
    throw new AppError("VALIDATION", "Invalid Paga payout callback.");
  }

  const hashParameters = req.headers.get("x-paga-hash-parameters") ?? "";
  const hash = req.headers.get("x-paga-hash") ?? "";
  if (!verifyPayoutCallback(payload, hashParameters, hash, env().PAGA_HASH_KEY!)) {
    throw new AppError("UNAUTHENTICATED", "Invalid Paga payout callback signature.");
  }
  if (
    typeof payload.referenceNumber !== "string" ||
    !payload.referenceNumber ||
    (typeof payload.responseCode !== "string" && typeof payload.responseCode !== "number") ||
    typeof payload.transactionDate !== "string" ||
    typeof payload.transactionId !== "string" ||
    typeof payload.amount !== "string" ||
    (payload.reversalId !== undefined && payload.reversalId !== null && typeof payload.reversalId !== "string")
  ) {
    throw new AppError("VALIDATION", "Invalid Paga payout callback.");
  }

  await processPagaPayoutNotification(payload);
  return Response.json({ status: "SUCCESS" });
});
