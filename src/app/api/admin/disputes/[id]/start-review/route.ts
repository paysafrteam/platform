import { withApi } from "@/server/http/withApi";
import { startReview } from "@/server/services/disputes";

export const POST = withApi({ auth: "admin" }, ({ admin, params }) => startReview(admin.id, admin.name, params.id!));
