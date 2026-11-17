import { withApi } from "@/server/http/withApi";
import * as ws from "@/server/services/workspace";

import { AppError } from "@/server/http/errors";

export const GET = withApi({ auth: "none", rateLimit: { key: "pub-invoice", limit: 120, windowSeconds: 600 } }, async ({ params }) => {
  const inv = await ws.getPublicInvoice(params.token!);
  if (!inv) throw new AppError("NOT_FOUND", "We couldn't find this invoice.");
  return inv;
});
