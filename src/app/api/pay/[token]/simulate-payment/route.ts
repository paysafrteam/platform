import { withApi } from "@/server/http/withApi";
import { simulateBuyerPayment } from "@/server/services/funding";

export const POST = withApi({ auth: "none" }, ({ params }) => simulateBuyerPayment(params.token!));
