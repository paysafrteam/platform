import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";

const body = z.object({ kind: z.enum(["note", "link"]), content: z.string().trim().min(1, "Add proof of delivery.").max(2000) });

export const POST = withApi({ auth: "user", body }, ({ user, params, body }) => orders.deliverMilestone(user, params.id!, params.mid!, body));
