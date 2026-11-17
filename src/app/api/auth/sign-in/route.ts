import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

const body = z.object({ email: z.string().trim().email("Enter a valid email address.").max(200), password: z.string().min(1, "Enter your password.").max(200) });

export const POST = withApi({ auth: "none", body }, ({ body, ip, req }) => auth.signIn(body, ip, req.headers.get("user-agent")));
