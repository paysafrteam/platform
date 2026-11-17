import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

const body = z.object({ status: z.enum(["active", "limited", "suspended"]), reason: z.string().trim().min(5, "A written reason is required.").max(500) });
export const POST = withApi({ auth: "admin", body }, ({ admin: a, params, body, ip }) => admin.setSellerStatus({ id: a.id, label: a.name }, params.id!, body.status, body.reason, ip));
