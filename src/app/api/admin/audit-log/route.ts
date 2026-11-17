import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

const query = z.object({ actor: z.string().optional(), action: z.string().optional(), target: z.string().optional(), from: z.string().optional(), to: z.string().optional(), page: z.coerce.number().int().min(1).optional() });
export const GET = withApi({ auth: "admin", query }, ({ query }) => admin.listAudit(query));
