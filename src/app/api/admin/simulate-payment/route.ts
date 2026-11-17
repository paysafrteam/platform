import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

const body = z.object({ orderId: z.string().uuid().optional(), token: z.string().max(100).optional(), amountKobo: z.number().int().positive().optional() })
  .refine((b) => b.orderId || b.token, { message: "Provide an order id or payment token." });
export const POST = withApi({ auth: "admin", body }, ({ admin: a, body }) => admin.simulatePayment({ id: a.id, label: a.name }, body));
