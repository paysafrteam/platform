import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";

export const POST = withApi({ auth: "none", body: z.object({ email: z.string().trim().email("Enter a valid email address.").max(200).optional(), phone: z.string().trim().max(20).optional() }) }, ({ params, body }) => orders.contactSeller(params.token!, body));
