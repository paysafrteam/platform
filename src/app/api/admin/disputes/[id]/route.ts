import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";
export const GET = withApi({ auth: "admin" }, ({ params }) => admin.getDispute(params.id!));
