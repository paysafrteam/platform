import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

export const POST = withApi({ auth: "admin", body: z.object({ amountKobo: z.number().int().positive().optional() }) }, ({ admin: a, params, body }) =>
  admin.simulatePayment({ id: a.id, label: a.name }, { orderId: params.id!, ...(body.amountKobo ? { amountKobo: body.amountKobo } : {}) }));
