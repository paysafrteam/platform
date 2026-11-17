import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";

export const POST = withApi({ auth: "user" }, ({ user, params }) => orders.cancelOrder(user.id, params.id!));
