import { withApi } from "@/server/http/withApi";
import * as receipts from "@/server/services/receipts";
import { AppError } from "@/server/http/errors";

export const GET = withApi({ auth: "none", rateLimit: { key: "pub-receipt", limit: 120, windowSeconds: 600 } }, async ({ params }) => {
  const r = await receipts.getPublicReceipt(params.token!);
  if (!r) throw new AppError("NOT_FOUND", "We couldn't find this receipt.");
  return r;
});
