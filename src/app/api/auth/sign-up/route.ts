import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as auth from "@/server/services/auth";

const body = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(200),
  phone: z.string().trim().min(10, "Enter a valid phone number.").max(20),
  password: z.string().min(1, "Enter a password.").max(200),
  role: z.enum(["freelancer", "seller"]),
  acceptTerms: z.literal(true, { error: "Accept the terms to continue." }),
});

export const POST = withApi({ auth: "none", body }, ({ body, ip }) => auth.signUp(body, ip));
