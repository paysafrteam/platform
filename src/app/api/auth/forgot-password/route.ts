import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

export const POST = withApi({ auth: "none", body: z.object({ email: z.string().trim().email().max(200) }) }, ({ body, ip }) => auth.forgotPassword(body.email, ip));
