import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";

const body = z.object({ review_window_hours: z.number().optional(), unpaid_expiry_hours: z.number().optional(), dispute_response_hours: z.number().optional() });
export const GET = withApi({ auth: "admin" }, () => admin.getAdminSettings());
export const PUT = withApi({ auth: "admin", body }, ({ admin: a, body }) => admin.putAdminSettings({ id: a.id, label: a.name }, body));
