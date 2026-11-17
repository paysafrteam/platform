import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as disputes from "@/server/services/disputes";
const evidence = z.object({ type: z.enum(["text", "link"]), content: z.string().trim().min(1, "Add some evidence.").max(2000) });

export const POST = withApi({ auth: "none", body: evidence, rateLimit: { key: "pay-evidence", limit: 30, windowSeconds: 3600 } }, ({ params, body }) =>
  disputes.addEvidence({ side: "buyer", token: params.token! }, params.did!, body));
