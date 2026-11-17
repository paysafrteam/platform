import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import { adminSignIn } from "@/server/services/admin-auth";

const body = z.object({ email: z.string().trim().email("Enter a valid email address.").max(200), password: z.string().min(1, "Enter your password.").max(200) });
export const POST = withApi({ auth: "none", body }, ({ body, ip, req }) => adminSignIn(body, ip, req.headers.get("user-agent")));
