import { withApi } from "@/server/http/withApi";
export const GET = withApi({ auth: "admin" }, ({ admin }) => ({ id: admin.id, name: admin.name, email: admin.email, role: admin.role }));
