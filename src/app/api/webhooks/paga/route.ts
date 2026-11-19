import { AppError } from "@/server/http/errors";
import { withApi } from "@/server/http/withApi";
import { env } from "@/server/env";
import { verifyCollectCallback, type PagaPaymentCallback } from "@/server/payments/paga-hash";
import { processPagaPaymentNotification } from "@/server/services/paga-reconciliation";

export const POST = withApi({ auth: "none", skipOriginCheck: true }, async ({ req }) => {
  if (env().PAYMENT_MODE !== "paga") {
    return Response.json({ status: "DISABLED" }, { status: 503 });
  }
  const raw = await req.text();
  if (!raw || raw.length > 100_000) throw new AppError("VALIDATION", "Invalid Paga callback.");

  let payload: PagaPaymentCallback & { event?: unknown };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("VALIDATION", "Invalid Paga callback.");
    }
    payload = parsed as PagaPaymentCallback & { event?: unknown };
  } catch {
    throw new AppError("VALIDATION", "Invalid Paga callback.");
  }

  if (!verifyCollectCallback(payload, env().PAGA_HASH_KEY!)) {
    throw new AppError("UNAUTHENTICATED", "Invalid Paga callback signature.");
  }
  if (
    typeof payload.notificationId !== "string" ||
    !payload.notificationId ||
    typeof payload.externalReferenceNumber !== "string" ||
    !payload.externalReferenceNumber ||
    typeof payload.statusCode !== "string" ||
    typeof payload.state !== "string"
  ) {
    throw new AppError("VALIDATION", "Invalid Paga callback.");
  }

  await processPagaPaymentNotification(payload);
  return Response.json({ status: "SUCCESS" });
});
