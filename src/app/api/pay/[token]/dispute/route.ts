import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as disputes from "@/server/services/disputes";
const evidence = z.object({ type: z.enum(["text", "link"]), content: z.string().trim().min(1, "Add some evidence.").max(2000) });

const body = z.object({
  milestoneId: z.string().uuid(), reason: z.enum(["not_delivered", "not_as_described", "delivered_late", "other"]),
  note: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(1000), evidence: z.array(evidence).max(5).optional(),
});
export const POST = withApi({ auth: "none", body }, ({ params, body }) => disputes.openBuyerDispute(params.token!, body));
