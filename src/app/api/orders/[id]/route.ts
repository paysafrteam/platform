import { withApi } from "@/server/http/withApi";
import * as orders from "@/server/services/orders";

export const GET = withApi({ auth: "user" }, ({ user, params }) => orders.getSellerOrder(user.id, params.id!));
