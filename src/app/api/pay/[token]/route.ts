import { withApi } from "@/server/http/withApi";
import { AppError } from "@/server/http/errors";
import { getPublicOrderByToken } from "@/server/mappers/orders";

export const GET = withApi({ auth: "none", rateLimit: { key: "pay-get", limit: 240, windowSeconds: 600 } }, async ({ params }) => {
  const o = await getPublicOrderByToken(params.token!);
  if (!o) throw new AppError("NOT_FOUND", "We couldn't find this payment link.");
  return o;
});
