import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

const query = z.object({ q: z.string().max(100).optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).optional() });
export const GET = withApi({ auth: "admin", query }, ({ query }) => admin.listSellers(query));
