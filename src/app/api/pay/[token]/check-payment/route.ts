import { withApi } from "@/server/http/withApi";
import { AppError } from "@/server/http/errors";
import * as orders from "@/server/services/orders";

export const POST = withApi({ auth: "none" }, ({ params }) => orders.checkPayment(params.token!));
