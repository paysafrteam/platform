import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";
const contact = z.object({ email: z.string().trim().email("Enter a valid email address.").max(200).optional().or(z.literal("")), phone: z.string().trim().max(20).optional().or(z.literal("")) });

const body = z.object({
  title: z.string().trim().min(1, "Add a title.").max(100),
  description: z.string().trim().max(1000).default(""),
  totalKobo: z.number().int().positive("Enter an amount greater than zero.").max(Number.MAX_SAFE_INTEGER),
  reviewWindowHours: z.number().int(),
  deliveryDeadline: z.string().min(1, "Choose a delivery date."),
  milestones: z.array(z.object({ title: z.string().trim().min(1, "Name each milestone.").max(100), amountKobo: z.number().int().positive() })).min(1).max(10),
  buyerContact: contact.optional(),
  publish: z.boolean(),
});

export const GET = withApi({ auth: "user" }, ({ user }) => orders.listOrders(user.id));
export const POST = withApi({ auth: "user", body }, ({ body, user }) => orders.createOrder(user, body));
