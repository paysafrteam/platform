import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

const body = z.object({ email: z.string().trim().email().max(200), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") });

export const POST = withApi({ auth: "none", body }, ({ body, ip, req }) => auth.verifyEmailAndSignIn(body, ip, req.headers.get("user-agent")));
