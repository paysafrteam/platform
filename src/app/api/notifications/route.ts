import { withApi } from "@/server/http/withApi";
import * as ws from "@/server/services/workspace";

export const GET = withApi({ auth: "user" }, ({ user }) => ws.listNotifications(user.id));
