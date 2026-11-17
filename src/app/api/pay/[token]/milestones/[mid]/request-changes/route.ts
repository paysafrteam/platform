import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";

export const POST = withApi({ auth: "none", body: z.object({ note: z.string().trim().min(1, "Add a short note so the seller knows what to update.").max(1000) }) }, ({ params, body }) => orders.requestChanges(params.token!, params.mid!, body.note));
