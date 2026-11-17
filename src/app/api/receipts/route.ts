import { withApi } from "@/server/http/withApi";
import * as receipts from "@/server/services/receipts";
import { AppError } from "@/server/http/errors";

export const GET = withApi({ auth: "user" }, ({ user }) => receipts.listSellerReceipts(user.id));
