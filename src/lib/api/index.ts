import type {
  ApiErrorBody, DashboardData, IncomeData, Me, Notification, PayoutAccount, PublicInvoice, PublicOrder, PublicReceipt,
  SellerOrder, TrustData, DisputeReason,
} from "@/lib/domain/types";

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number, public fields?: Record<string, string>, public retryAfterSeconds?: number) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method, credentials: "same-origin", cache: "no-store",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : method === "POST" ? "{}" : undefined,
    });
  } catch {
    throw new ApiError("We couldn't reach PaySafr. Check your connection and try again.", "NETWORK", 0);
  }
  if (!res.ok) {
    let err: ApiErrorBody["error"] | undefined;
    try { err = ((await res.json()) as ApiErrorBody).error; } catch { /* non-JSON error */ }
    throw new ApiError(err?.message ?? "Something went wrong. Please try again.", err?.code ?? "INTERNAL", res.status, err?.fields, err?.retryAfterSeconds);
  }
  return (await res.json()) as T;
}
const get = <T,>(p: string) => call<T>("GET", p);
const post = <T,>(p: string, b?: unknown) => call<T>("POST", p, b ?? {});
const put = <T,>(p: string, b: unknown) => call<T>("PUT", p, b);
const e = encodeURIComponent;

// ---- auth
export const signUp = (i: { name: string; email: string; phone: string; password: string; role: "freelancer" | "seller" }) =>
  post<{ verificationSent: true; email: string }>("/api/auth/sign-up", { ...i, acceptTerms: true });
export const verifyEmail = (i: { email: string; code: string }) => post<Me>("/api/auth/verify-email", i);
export const resendVerification = (email: string) => post<{ sent: true }>("/api/auth/resend-verification", { email });
export const signIn = (i: { email: string; password: string }) => post<{ signedIn: true }>("/api/auth/sign-in", i);
export const signOut = () => post<{ signedOut: true }>("/api/auth/sign-out");
export const requestPasswordReset = (email: string) => post<{ sent: true }>("/api/auth/forgot-password", { email });
export const resetPassword = (i: { email: string; code: string; password: string }) => post<{ reset: true }>("/api/auth/reset-password", i);
export const changePassword = (i: { currentPassword: string; newPassword: string }) => post<{ changed: true }>("/api/auth/change-password", i);
export const getMe = () => get<Me>("/api/me");
export const updateMe = (i: { name?: string; phone?: string; businessName?: string }) => put<Me>("/api/me", i);
export const adminSignIn = (i: { email: string; password: string }) => post<{ signedIn: true }>("/api/admin/auth/sign-in", i);
export const adminSignOut = () => post<{ signedOut: true }>("/api/admin/auth/sign-out");

// ---- seller workspace
export interface CreateOrderInput {
  title: string; description: string; totalKobo: number; reviewWindowHours: number; deliveryDeadline: string;
  milestones: { title: string; amountKobo: number }[]; buyerContact?: { email?: string; phone?: string }; publish: boolean;
}
export const listOrders = () => get<SellerOrder[]>("/api/orders");
export const getOrder = (id: string) => get<SellerOrder>(`/api/orders/${e(id)}`);
export const createOrder = (i: CreateOrderInput) => post<SellerOrder>("/api/orders", i);
export const publishOrder = (id: string) => post<SellerOrder>(`/api/orders/${e(id)}/publish`);
export const cancelOrder = (id: string) => post<SellerOrder>(`/api/orders/${e(id)}/cancel`);
export const deliverMilestone = (orderId: string, milestoneId: string, proof: { kind: "note" | "link"; content: string }) =>
  post<SellerOrder>(`/api/orders/${e(orderId)}/milestones/${e(milestoneId)}/deliver`, proof);
export const openSellerDispute = (orderId: string, i: { milestoneId: string; reason: DisputeReason; note: string }) =>
  post<{ id: string; number: string }>(`/api/orders/${e(orderId)}/dispute`, i);
export const addSellerEvidence = (orderId: string, disputeId: string, i: { type: "text" | "link"; content: string }) =>
  post<{ saved: true }>(`/api/orders/${e(orderId)}/disputes/${e(disputeId)}/evidence`, i);
export const getDashboard = () => get<DashboardData>("/api/dashboard");
export const getIncome = () => get<IncomeData>("/api/income");
export const getTrust = () => get<TrustData>("/api/trust");
export const listReceipts = () => get<PublicReceipt[]>("/api/receipts");
export const listInvoices = () => get<PublicInvoice[]>("/api/invoices");
export const listNotifications = () => get<Notification[]>("/api/notifications");
export const markNotificationsRead = (ids?: string[]) => post<{ ok: true }>("/api/notifications/read", ids ? { ids } : {});
export const listBanks = () => get<{ code: string; name: string }[]>("/api/banks");
export const savePayoutAccount = (i: { bankCode: string; accountNumber: string; accountName: string }) => put<PayoutAccount>("/api/me/payout-account", i);

// ---- buyer (no account; the link token is the credential)
export const getPayOrder = (token: string) => get<PublicOrder>(`/api/pay/${e(token)}`);
export const checkPayment = (token: string) => post<{ status: "funded" | "awaiting_payment"; order: PublicOrder }>(`/api/pay/${e(token)}/check-payment`);
export const simulatePayment = (token: string) => post<{ status: string }>(`/api/pay/${e(token)}/simulate-payment`);
export const confirmMilestone = (token: string, mid: string) => post<PublicOrder>(`/api/pay/${e(token)}/milestones/${e(mid)}/confirm`);
export const requestChanges = (token: string, mid: string, note: string) => post<{ sent: true }>(`/api/pay/${e(token)}/milestones/${e(mid)}/request-changes`, { note });
export interface OpenDisputeInput { token: string; milestoneId: string; reason: DisputeReason; note: string; evidence?: { type: "text" | "link"; content: string }[] }
export const openDispute = ({ token, ...rest }: OpenDisputeInput) => post<{ id: string; number: string }>(`/api/pay/${e(token)}/dispute`, rest);
export const addBuyerEvidence = (token: string, disputeId: string, i: { type: "text" | "link"; content: string }) =>
  post<{ saved: true }>(`/api/pay/${e(token)}/dispute/${e(disputeId)}/evidence`, i);
export const contactSeller = (token: string, c: { email?: string; phone?: string }) => post<{ saved: true }>(`/api/pay/${e(token)}/contact`, c);
export const getBuyerReceipt = (token: string) => get<{ order: PublicOrder; receipts: PublicReceipt[] }>(`/api/pay/${e(token)}/receipt`);

// ---- public share pages
export const getPublicReceipt = (token: string) => get<PublicReceipt>(`/api/receipts/public/${e(token)}`);
export const getPublicInvoice = (token: string) => get<PublicInvoice>(`/api/invoices/public/${e(token)}`);

// ---- admin console (cookie-authenticated)
export const adminApi = {
  get: <T,>(path: string, params?: Record<string, string | number | undefined>) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
    return get<T>(`/api/admin/${path}${qs === "?" ? "" : qs}`);
  },
  post: <T,>(path: string, body?: unknown) => post<T>(`/api/admin/${path}`, body),
  put: <T,>(path: string, body: unknown) => put<T>(`/api/admin/${path}`, body),
};
