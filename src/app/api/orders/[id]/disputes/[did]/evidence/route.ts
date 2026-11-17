import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as disputes from "@/server/services/disputes";
const evidence = z.object({ type: z.enum(["text", "link"]), content: z.string().trim().min(1, "Add some evidence.").max(2000) });

export const POST = withApi({ auth: "user", body: evidence }, ({ user, params, body }) =>
  disputes.addEvidence({ side: "seller", sellerId: user.id, orderId: params.id! }, params.did!, body));
