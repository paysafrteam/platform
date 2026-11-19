// Shared DTOs. Nothing here may carry secrets; public DTOs never include seller contact or bank details.
export type OrderStatus = "draft" | "awaiting_payment" | "funded" | "completed" | "expired" | "cancelled";
export type MilestoneStatus = "pending" | "delivered" | "released" | "disputed" | "refunded";
export type DisputeStatus = "open" | "awaiting_response" | "under_review" | "resolved";
export type DisputeReason = "not_delivered" | "not_as_described" | "delivered_late" | "other";
export type DisputeOutcome = "release_to_seller" | "refund_to_buyer" | "split";
export type LedgerType = "funding" | "release" | "fee" | "refund";
export type PayoutStatus = "queued" | "processing" | "pending" | "paid" | "failed" | "reversed";
export type PayoutKind = "seller_payout" | "buyer_refund";
export type TrustLevel = "new" | "rising" | "trusted" | "verified";
export type UserRole = "buyer" | "seller" | "admin";
export type SellerStatus = "active" | "limited" | "suspended";

export interface ApiErrorBody { error: { code: string; message: string; fields?: Record<string, string>; retryAfterSeconds?: number } }

export interface PayoutAccount {
  bankCode: string; bankName: string; accountNumber: string; accountName: string; verified: boolean;
}

/** The signed-in owner's own profile (never exposed publicly). */
export interface Me {
  id: string; name: string; email: string; phone: string; businessName?: string;
  sellerType: "freelancer" | "seller"; status: SellerStatus;
  trustScore: number | null; trustLevel: TrustLevel; completedOrders: number;
  payoutAccount: PayoutAccount | null; unreadNotifications: number;
}

export interface PublicSeller {
  name: string; businessName?: string; trustScore: number | null; trustLevel: TrustLevel; completedOrders: number;
}

export interface Proof { kind: "link" | "note"; content: string }

export interface Milestone {
  id: string; position: number; title: string; amountKobo: number; status: MilestoneStatus;
  proof?: Proof; deliveredAt?: string; releaseAt?: string; changeRequestCount: number;
}

export interface OrderAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
  expiresAt: string;
  totalPaymentAmountKobo: number;
}
export interface ReceiptRef { number: string; publicToken: string; type: "payment" | "completion"; milestoneId: string | null; issuedAt: string }

export interface DisputeSummary {
  id: string; number: string; milestoneId: string; openedBy: "buyer" | "seller"; status: DisputeStatus;
  reason: DisputeReason; note: string; responseDueAt: string; outcome?: DisputeOutcome; splitToSellerKobo?: number;
  decisionReason?: string; openedAt: string; resolvedAt?: string;
}

export interface PublicOrder {
  token: string; seller: PublicSeller; title: string; description: string; totalKobo: number; currency: "NGN";
  status: OrderStatus; deliveryDeadline: string; reviewWindowHours: number; amountFundedKobo: number; overpaidKobo: number;
  buyerContact?: { email?: string; phone?: string }; orderAccount?: OrderAccount;
  milestones: Milestone[]; createdAt: string; expiresAt: string | null; fundedAt?: string; completedAt?: string;
  paymentReceipt: ReceiptRef | null; completionReceipt: ReceiptRef | null; disputes: DisputeSummary[];
}

export interface SellerMilestone extends Milestone {
  feeKobo: number; payoutStatus?: PayoutStatus; changeRequests: { id: string; note: string; createdAt: string }[];
}

export interface SellerOrder extends Omit<PublicOrder, "milestones" | "buyerContact"> {
  id: string; feeKobo: number; buyerContact?: { email?: string; phone?: string };
  milestones: SellerMilestone[]; receipts: ReceiptRef[]; needsRefundFlag: boolean; evidence: Record<string, EvidenceItem[]>;
}

export type Order = SellerOrder;

export interface EvidenceItem { id: string; submittedBy: "buyer" | "seller"; type: "text" | "link"; content: string; createdAt: string }

export interface PublicReceipt {
  number: string; token: string; type: "payment" | "completion"; issuedAt: string;
  title: string; description: string; sellerName: string; buyerContact?: string;
  amountKobo: number; feeKobo?: number; netKobo?: number; refundedKobo?: number; orderTotalKobo: number;
  milestoneTitle?: string; outcome?: "released" | "refunded" | "split" | "funded";
}

export interface PublicInvoice {
  token: string; title: string; description: string; sellerName: string; businessName?: string; buyerContact?: string;
  totalKobo: number; feeKobo: number; sellerReceivesKobo: number; status: OrderStatus; createdAt: string; dueAt: string | null;
  milestones: { title: string; amountKobo: number }[];
}

export interface Notification {
  id: string; type: string; title: string; message: string; orderId?: string; read: boolean; createdAt: string;
}

export interface DashboardData {
  heldKobo: number; paidOutKobo: number; awaitingPaymentCount: number; openDisputeCount: number;
  needsAction: { orderId: string; title: string; kind: "deliver" | "awaiting_buyer" | "awaiting_payment" | "dispute"; detail: string; at?: string }[];
  recentOrders: SellerOrder[]; incomeByMonth: { month: string; label: string; kobo: number }[];
}

export interface IncomeData {
  receivedKobo: number; feesKobo: number; completedOrders: number;
  transactions: { id: string; type: LedgerType; orderId: string; orderTitle: string; amountKobo: number; createdAt: string }[];
}

export interface TrustData {
  score: number | null; level: TrustLevel; completedOrders: number; qualifyingOrders: number; qualifyingNeeded: number;
  events: { id: string; eventType: string; delta: number; scoreAfter: number | null; orderTitle: string | null; createdAt: string }[];
}
