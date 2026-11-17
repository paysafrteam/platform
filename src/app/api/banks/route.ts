import { withApi } from "@/server/http/withApi";
import * as ws from "@/server/services/workspace";

export const GET = withApi({ auth: "none" }, async () => ws.listBanks());
