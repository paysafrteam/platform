import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

const body = z.object({ currentPassword: z.string().min(1, "Enter your current password.").max(200), newPassword: z.string().min(1).max(200) });

export const POST = withApi({ auth: "user", body }, ({ body, user }) => auth.changePassword(user.id, user.sessionId, body));
