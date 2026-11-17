import type { Order, UserRole } from "@/lib/domain/types";

export const UNPAID_EXPIRY_HOURS = 48;
export const DEFAULT_REVIEW_WINDOW_HOURS = 72;
export const REVIEW_WINDOW_MIN_HOURS = 24;
export const REVIEW_WINDOW_MAX_HOURS = 336;
export const REMINDER_BEFORE_RELEASE_HOURS = 24;
export const DISPUTE_RESPONSE_HOURS = 48;
export const FEE_TIER_THRESHOLD_KOBO = 5_000_000;
export const LOWER_FEE_RATE = 0.015;
export const HIGHER_FEE_RATE = 0.02;

export function calcFee(kobo: number, orderTotalKobo = kobo): number {
  if (
    !Number.isSafeInteger(kobo) ||
    kobo < 0 ||
    !Number.isSafeInteger(orderTotalKobo) ||
    orderTotalKobo < 0
  ) {
    throw new RangeError("Amounts must be non-negative integer kobo.");
  }
  const feeRate =
    orderTotalKobo > FEE_TIER_THRESHOLD_KOBO
      ? HIGHER_FEE_RATE
      : LOWER_FEE_RATE;
  return Math.floor(kobo * feeRate + 0.5);
}

export function calcSellerReceives(
  kobo: number,
  orderTotalKobo = kobo,
): number {
  return kobo - calcFee(kobo, orderTotalKobo);
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
    pending: ["delivered", "disputed"],
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

/** Per-milestone fees using the ORDER total for the tier, so the order fee is exactly their sum. */
export function allocateMilestoneFees(amountsKobo: number[], orderTotalKobo: number): number[] {
  return amountsKobo.map((amount) => calcFee(amount, orderTotalKobo));
}
