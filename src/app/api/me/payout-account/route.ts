import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import * as ws from "@/server/services/workspace";

const body = z.object({
  bankCode: z.string().min(2).max(10),
  accountNumber: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit account number."),
  accountName: z.string().trim().min(2, "Enter the account name.").max(100),
});
export const PUT = withApi({ auth: "user", body }, ({ user, body, ip }) => ws.savePayoutAccount(user, body, ip));
