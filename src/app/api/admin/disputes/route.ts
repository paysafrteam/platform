import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

const query = z.object({ status: z.string().optional(), reason: z.string().optional(), q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).optional() });
export const GET = withApi({ auth: "admin", query }, ({ query }) => admin.listDisputes(query));
