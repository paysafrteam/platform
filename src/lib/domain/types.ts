export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "funded"
  | "completed"
  | "expired"
  | "cancelled";
export type MilestoneStatus =
  | "pending"
  | "delivered"
  | "released"
  | "disputed"
  | "refunded";
export type DisputeStatus = "open" | "awaiting_response" | "under_review" | "resolved";
export type DisputeReason = "not_delivered" | "not_as_described" | "delivered_late" | "other";
export type DisputeOutcome = "release_to_seller" | "refund_to_buyer" | "split";
export type LedgerType = "funding" | "release" | "fee" | "refund";
export type PayoutStatus = "queued" | "processing" | "paid" | "failed";
export type TrustLevel = "new" | "rising" | "trusted" | "verified";
export type UserRole = "buyer" | "seller" | "admin";

export interface PayoutAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  verified: boolean;
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName?: string;
  payoutAccount?: PayoutAccount;
  trustScore: number | null;
  trustLevel: TrustLevel;
  status: "active" | "limited" | "suspended";
  completedOrders: number;
}

export interface Proof {
  kind: "file" | "link" | "note";
  content: string;
  fileName?: string;
}

export interface Milestone {
  id: string;
  position: number;
  title: string;
  amountKobo: number;
  status: MilestoneStatus;
  proof?: Proof;
  deliveredAt?: string;
  releaseAt?: string;
}

export interface Order {
  id: string;
  token: string;
  seller: Seller;
  title: string;
  description: string;
  totalKobo: number;
  currency: "NGN";
  buyerContact?: { email?: string; phone?: string };
  orderAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresAt: string;
  };
  status: OrderStatus;
  deliveryDeadline: string;
  reviewWindowHours: number;
  feeKobo: number;
  amountFundedKobo: number;
  overpaidKobo?: number;
  milestones: Milestone[];
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
}

export interface Evidence {
  id: string;
  submittedBy: "buyer" | "seller";
  type: "text" | "file" | "link";
  content: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  milestoneId: string;
  openedBy: "buyer" | "seller";
  reason: DisputeReason;
  note: string;
  status: DisputeStatus;
  responseDueAt: string;
  evidence: Evidence[];
  outcome?: DisputeOutcome;
  splitToSellerKobo?: number;
  decisionReason?: string;
  openedAt: string;
  resolvedAt?: string;
}

export interface LedgerEntry {
  id: string;
  orderId: string;
  milestoneId?: string;
  type: LedgerType;
  amountKobo: number;
  pagaReference: string;
  createdAt: string;
}

export interface Payout {
  id: string;
  orderId: string;
  milestoneId: string;
  amountKobo: number;
  status: PayoutStatus;
  pagaReference: string;
  attempts: number;
}

export interface Receipt {
  id: string;
  number: string;
  type: "payment" | "completion";
  orderId: string;
  issuedAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  before?: string;
  after?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "funded" | "delivered" | "dispute" | "payout" | "reminder";
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
}

export interface AppStore {
  orders: Order[];
  disputes: Dispute[];
  ledger: LedgerEntry[];
  payouts: Payout[];
  receipts: Receipt[];
  auditLog: AuditEntry[];
  notifications: Notification[];
}
