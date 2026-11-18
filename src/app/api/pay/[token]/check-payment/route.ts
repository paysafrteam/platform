import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";

export const POST = withApi({ auth: "none" }, ({ params }) => orders.checkPayment(params.token!));
