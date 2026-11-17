import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";
const query = z.object({ type: z.string().optional(), orderId: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional(), page: z.coerce.number().int().min(1).optional() });

export const GET = withApi({ auth: "admin", query }, async ({ query }) =>
  new Response(await admin.ledgerCsv(query), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="paysafr-ledger.csv"', "cache-control": "no-store" } }));
