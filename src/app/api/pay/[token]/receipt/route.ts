import { withApi } from "@/server/http/withApi";
import { AppError } from "@/server/http/errors";
import * as receipts from "@/server/services/receipts";
import { getPublicOrderByToken } from "@/server/mappers/orders";

export const GET = withApi({ auth: "none", rateLimit: { key: "pay-receipt", limit: 120, windowSeconds: 600 } }, async ({ params }) => {
  const [list, order] = await Promise.all([receipts.getBuyerReceipts(params.token!), getPublicOrderByToken(params.token!)]);
  if (!list || !order) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  return { order, receipts: list };
});
