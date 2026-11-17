import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as ws from "@/server/services/workspace";

export const POST = withApi({ auth: "user", body: z.object({ ids: z.array(z.string().uuid()).max(100).optional() }) }, ({ user, body }) => ws.markNotificationsRead(user.id, body.ids));
