import type { Order, UserRole } from "@/lib/domain/types";

export const UNPAID_EXPIRY_HOURS = 48;
export const DEFAULT_REVIEW_WINDOW_HOURS = 72;
export const REVIEW_WINDOW_MIN_HOURS = 24;
export const REVIEW_WINDOW_MAX_HOURS = 336;
export const REMINDER_BEFORE_RELEASE_HOURS = 24;
export const DISPUTE_RESPONSE_HOURS = 48;
// FINAL FEE TBC. The rate is a provisional setting and must be confirmed before launch.
export const FEE_RATE = Math.min(
  0.02,
  Math.max(0.01, Number(process.env.NEXT_PUBLIC_FEE_RATE ?? 0.02)),
);

export function calcFee(kobo: number, feeRate = FEE_RATE): number {
  if (!Number.isSafeInteger(kobo) || kobo < 0) throw new RangeError("Amount must be non-negative integer kobo.");
  if (!Number.isFinite(feeRate) || feeRate < 0.01 || feeRate > 0.02) {
    throw new RangeError("Fee rate must be between 1% and 2%.");
  }
  return Math.floor(kobo * feeRate + 0.5);
}

export function calcSellerReceives(kobo: number, feeRate = FEE_RATE): number {
  return kobo - calcFee(kobo, feeRate);
}

type Entity = "order" | "milestone" | "dispute";
const transitions: Record<Entity, Record<string, readonly string[]>> = {
  order: {
    draft: ["awaiting_payment", "cancelled"],
    awaiting_payment: ["funded", "expired", "cancelled"],
    funded: ["completed"],
    completed: [],
    expired: [],
    cancelled: [],
  },
  milestone: {
    pending: ["delivered"],
    delivered: ["released", "disputed"],
    disputed: ["released", "refunded"],
    released: [],
    refunded: [],
  },
  dispute: {
    open: ["awaiting_response", "under_review"],
    awaiting_response: ["under_review", "resolved"],
    under_review: ["resolved"],
    resolved: [],
  },
};

export function canTransition(entity: Entity, from: string, to: string): boolean {
  return transitions[entity][from]?.includes(to) ?? false;
}

export function nextActions(order: Order, role: UserRole): string[] {
  if (role === "buyer") {
    if (order.status === "awaiting_payment") return ["pay", "check_payment", "contact_seller"];
    if (order.status === "funded") return ["wait_for_delivery"];
    if (order.milestones.some((milestone) => milestone.status === "delivered")) {
      return ["confirm_delivery", "request_changes", "open_dispute"];
    }
    return [];
  }
  if (role === "seller") {
    if (order.status === "draft") return ["publish", "cancel"];
    if (order.status === "awaiting_payment") return ["copy_link", "cancel"];
    if (order.status === "funded") return ["deliver_milestone"];
    return [];
  }
  return order.milestones.some((milestone) => milestone.status === "disputed")
    ? ["review_dispute"]
    : [];
}

export function whoMustAct(order: Order): string {
  if (order.status === "awaiting_payment") return "Buyer";
  if (order.status === "funded") return "Seller";
  if (order.milestones.some((milestone) => milestone.status === "delivered")) return "Buyer";
  if (order.milestones.some((milestone) => milestone.status === "disputed")) return "PaySafr";
  return "No action needed";
}

export function isMilestoneAllocationValid(amountsKobo: number[], totalKobo: number): boolean {
  return (
    amountsKobo.length > 0 &&
    amountsKobo.every((amount) => Number.isSafeInteger(amount) && amount > 0) &&
    amountsKobo.reduce((sum, amount) => sum + amount, 0) === totalKobo
  );
}
