import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import { resolveDispute } from "@/server/services/disputes";

const body = z.object({
  outcome: z.enum(["release_to_seller", "refund_to_buyer", "split"]),
  reason: z.string().trim().min(10, "Write a reason of at least 10 characters.").max(2000),
  splitToSellerKobo: z.number().int().positive().optional(), decideEarly: z.boolean().optional(),
});
export const POST = withApi({ auth: "admin", body }, ({ admin, params, body, ip }) => resolveDispute({ id: admin.id, label: admin.name }, params.id!, body, ip));
