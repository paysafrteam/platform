import { withApi } from "@/server/http/withApi";

// The Paga webhook (signature check, reference + amount match, then recordFunding) lands with the Paga integration.
// Until then funding only happens through the sandbox simulator, and this endpoint refuses everything.
export const POST = withApi({ auth: "none", skipOriginCheck: true }, async () =>
  Response.json({ error: { code: "INTERNAL", message: "The Paga webhook is not enabled in simulator mode." } }, { status: 501 }));
