export type HttpMethod = "GET" | "POST" | "PUT";
export type EndpointId =
  | "signUp"
  | "signIn"
  | "signOut"
  | "verifyEmail"
  | "forgotPassword"
  | "resetPassword"
  | "getMe"
  | "updateMe"
  | "updatePayoutAccount"
  | "getBanks"
  | "resolveBank"
  | "createOrder"
  | "listOrders"
  | "getOrder"
  | "cancelOrder"
  | "deliverMilestone"
  | "getDashboard"
  | "getInvoices"
  | "getReceipts"
  | "getIncome"
  | "getTrust"
  | "getNotifications"
  | "readNotifications"
  | "getPayOrder"
  | "checkPayment"
  | "confirmMilestone"
  | "requestChanges"
  | "openDispute"
  | "contactSeller"
  | "getBuyerReceipt"
  | "getPublicReceipt"
  | "adminSignIn"
  | "adminOverview"
  | "adminDisputes"
  | "adminDispute"
  | "resolveDispute"
  | "adminOrders"
  | "adminOrder"
  | "adminLedger"
  | "adminPayouts"
  | "retryPayout"
  | "adminSellers"
  | "adminReconciliation"
  | "adminAuditLog"
  | "adminSettings"
  | "updateAdminSettings"
  | "pagaWebhook";

export interface EndpointDefinition {
  id: EndpointId;
  method: HttpMethod;
  path: string;
  description: string;
  status: "mock" | "live";
}

export const ENDPOINTS: Record<EndpointId, EndpointDefinition> = {
  signUp: { id: "signUp", method: "POST", path: "/api/auth/sign-up", description: "Create a seller account.", status: "mock" },
  signIn: { id: "signIn", method: "POST", path: "/api/auth/sign-in", description: "Start a seller session.", status: "mock" },
  signOut: { id: "signOut", method: "POST", path: "/api/auth/sign-out", description: "End a seller session.", status: "mock" },
  verifyEmail: { id: "verifyEmail", method: "POST", path: "/api/auth/verify-email", description: "Verify an email code.", status: "mock" },
  forgotPassword: { id: "forgotPassword", method: "POST", path: "/api/auth/forgot-password", description: "Send a password reset email.", status: "mock" },
  resetPassword: { id: "resetPassword", method: "POST", path: "/api/auth/reset-password", description: "Set a new password.", status: "mock" },
  getMe: { id: "getMe", method: "GET", path: "/api/me", description: "Get the current seller profile.", status: "mock" },
  updateMe: { id: "updateMe", method: "PUT", path: "/api/me", description: "Update the seller profile.", status: "mock" },
  updatePayoutAccount: { id: "updatePayoutAccount", method: "PUT", path: "/api/me/payout-account", description: "Save a verified payout account.", status: "mock" },
  getBanks: { id: "getBanks", method: "GET", path: "/api/banks", description: "List Nigerian banks.", status: "mock" },
  resolveBank: { id: "resolveBank", method: "POST", path: "/api/banks/resolve", description: "Resolve a bank account name.", status: "mock" },
  createOrder: { id: "createOrder", method: "POST", path: "/api/orders", description: "Create an order and payment link.", status: "mock" },
  listOrders: { id: "listOrders", method: "GET", path: "/api/orders", description: "List seller orders.", status: "mock" },
  getOrder: { id: "getOrder", method: "GET", path: "/api/orders/:id", description: "Get an order record.", status: "mock" },
  cancelOrder: { id: "cancelOrder", method: "POST", path: "/api/orders/:id/cancel", description: "Cancel an unpaid order.", status: "mock" },
  deliverMilestone: { id: "deliverMilestone", method: "POST", path: "/api/orders/:id/milestones/:mid/deliver", description: "Submit milestone proof.", status: "mock" },
  getDashboard: { id: "getDashboard", method: "GET", path: "/api/dashboard", description: "Get seller dashboard metrics.", status: "mock" },
  getInvoices: { id: "getInvoices", method: "GET", path: "/api/invoices", description: "List seller invoices.", status: "mock" },
  getReceipts: { id: "getReceipts", method: "GET", path: "/api/receipts", description: "List seller receipts.", status: "mock" },
  getIncome: { id: "getIncome", method: "GET", path: "/api/income", description: "Get seller income history.", status: "mock" },
  getTrust: { id: "getTrust", method: "GET", path: "/api/trust", description: "Get seller trust details.", status: "mock" },
  getNotifications: { id: "getNotifications", method: "GET", path: "/api/notifications", description: "List seller notifications.", status: "mock" },
  readNotifications: { id: "readNotifications", method: "POST", path: "/api/notifications/read", description: "Mark notifications as read.", status: "mock" },
  getPayOrder: { id: "getPayOrder", method: "GET", path: "/api/pay/:token", description: "Get public buyer order by token.", status: "mock" },
  checkPayment: { id: "checkPayment", method: "POST", path: "/api/pay/:token/check-payment", description: "Check mock payment status.", status: "mock" },
  confirmMilestone: { id: "confirmMilestone", method: "POST", path: "/api/pay/:token/milestones/:mid/confirm", description: "Confirm delivery and release a milestone.", status: "mock" },
  requestChanges: { id: "requestChanges", method: "POST", path: "/api/pay/:token/milestones/:mid/request-changes", description: "Request delivery changes.", status: "mock" },
  openDispute: { id: "openDispute", method: "POST", path: "/api/pay/:token/dispute", description: "Open a buyer dispute.", status: "mock" },
  contactSeller: { id: "contactSeller", method: "POST", path: "/api/pay/:token/contact", description: "Send buyer contact details.", status: "mock" },
  getBuyerReceipt: { id: "getBuyerReceipt", method: "GET", path: "/api/pay/:token/receipt", description: "Get a public payment receipt.", status: "mock" },
  getPublicReceipt: { id: "getPublicReceipt", method: "GET", path: "/api/receipts/:number", description: "Get a public receipt by receipt number.", status: "mock" },
  adminSignIn: { id: "adminSignIn", method: "POST", path: "/api/admin/auth/sign-in", description: "Start an admin session.", status: "mock" },
  adminOverview: { id: "adminOverview", method: "GET", path: "/api/admin/overview", description: "Get administrative KPIs.", status: "mock" },
  adminDisputes: { id: "adminDisputes", method: "GET", path: "/api/admin/disputes", description: "List disputes.", status: "mock" },
  adminDispute: { id: "adminDispute", method: "GET", path: "/api/admin/disputes/:id", description: "Get dispute evidence and history.", status: "mock" },
  resolveDispute: { id: "resolveDispute", method: "POST", path: "/api/admin/disputes/:id/resolve", description: "Record an admin dispute decision.", status: "mock" },
  adminOrders: { id: "adminOrders", method: "GET", path: "/api/admin/orders", description: "List all orders.", status: "mock" },
  adminOrder: { id: "adminOrder", method: "GET", path: "/api/admin/orders/:id", description: "Get an administrative order record.", status: "mock" },
  adminLedger: { id: "adminLedger", method: "GET", path: "/api/admin/ledger", description: "List append-only ledger entries.", status: "mock" },
  adminPayouts: { id: "adminPayouts", method: "GET", path: "/api/admin/payouts", description: "List payouts.", status: "mock" },
  retryPayout: { id: "retryPayout", method: "POST", path: "/api/admin/payouts/:id/retry", description: "Retry a failed payout.", status: "mock" },
  adminSellers: { id: "adminSellers", method: "GET", path: "/api/admin/sellers", description: "List sellers.", status: "mock" },
  adminReconciliation: { id: "adminReconciliation", method: "GET", path: "/api/admin/reconciliation", description: "Get Paga reconciliation.", status: "mock" },
  adminAuditLog: { id: "adminAuditLog", method: "GET", path: "/api/admin/audit-log", description: "List audit events.", status: "mock" },
  adminSettings: { id: "adminSettings", method: "GET", path: "/api/admin/settings", description: "Get platform settings.", status: "mock" },
  updateAdminSettings: { id: "updateAdminSettings", method: "PUT", path: "/api/admin/settings", description: "Update platform settings.", status: "mock" },
  pagaWebhook: { id: "pagaWebhook", method: "POST", path: "/api/webhooks/paga", description: "Backend-only Paga webhook.", status: "mock" },
};

export type ApiPath = `${HttpMethod} ${string}`;

export function getEndpointByPath(path: ApiPath): EndpointDefinition | undefined {
  return Object.values(ENDPOINTS).find(
    (endpoint) => `${endpoint.method} ${endpoint.path}` === path,
  );
}
