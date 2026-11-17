import { withApi } from "@/server/http/withApi";
import * as admin from "@/server/services/admin";
export const POST = withApi({ auth: "admin" }, ({ admin: a, params }) => admin.adminRefundUnallocated({ id: a.id, label: a.name }, params.id!));
