import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

export const GET = withApi({ auth: "user" }, ({ user }) => auth.getMe(user.id));

const body = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  businessName: z.string().trim().max(100).optional(),
});
export const PUT = withApi({ auth: "user", body }, ({ body, user }) => auth.updateMe(user.id, body));
