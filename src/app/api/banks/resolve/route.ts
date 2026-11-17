import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as ws from "@/server/services/workspace";

export const POST = withApi({ auth: "user", body: z.object({ bankCode: z.string().min(2).max(10), accountNumber: z.string().max(20) }) }, async ({ body }) => ws.resolveBank(body));
