import { z } from "zod";
import { withApi } from "@/server/http/withApi";
import { createPagaPaymentAccount } from "@/server/services/orders";

export const POST = withApi(
  {
    auth: "none",
    body: z.object({
      phone: z.string().trim().max(20).optional(),
      email: z.string().trim().email("Enter a valid email address.").max(200).optional(),
    }),
  },
  ({ params, body }) => createPagaPaymentAccount(params.token!, body),
);
