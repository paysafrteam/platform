import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

const body = z.object({ email: z.string().trim().email().max(200), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."), password: z.string().min(1).max(200) });

export const POST = withApi({ auth: "none", body }, ({ body }) => auth.resetPassword(body));
