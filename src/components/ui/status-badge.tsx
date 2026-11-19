import { Check, CircleAlert, Clock3, FileQuestion, Minus, Wallet } from "lucide-react";
import type { DisputeStatus, MilestoneStatus, OrderStatus, PayoutStatus } from "@/lib/domain/types";

const orderStatus: Record<OrderStatus, { label: string; style: string; icon: typeof Check }> = {
  draft: { label: "Draft", style: "bg-[var(--ps-grey-200)]/40 text-[var(--ps-grey-600)]", icon: FileQuestion },
  awaiting_payment: { label: "Waiting for payment", style: "border border-[var(--ps-grey-600)] text-[var(--ps-grey-600)]", icon: Clock3 },
  funded: { label: "Money held safely", style: "bg-[var(--ps-green-400)] text-[var(--ps-green-900)]", icon: Wallet },
  completed: { label: "Completed", style: "bg-[var(--ps-green-900)] text-white", icon: Check },
  expired: { label: "Expired", style: "bg-[var(--ps-grey-200)]/40 text-[var(--ps-grey-600)]", icon: Clock3 },
  cancelled: { label: "Cancelled", style: "bg-[var(--ps-grey-200)]/40 text-[var(--ps-grey-600)]", icon: Minus },
};

const milestoneStatus: Record<MilestoneStatus, { label: string; style: string; icon: typeof Check }> = {
  pending: { label: "Not delivered yet", style: "border border-[var(--ps-grey-600)] text-[var(--ps-grey-600)]", icon: Clock3 },
  delivered: { label: "Waiting for buyer", style: "bg-[var(--ps-warning)]/20 text-[var(--ps-green-900)]", icon: Clock3 },
  released: { label: "Paid out", style: "bg-[var(--ps-green-400)] text-[var(--ps-green-900)]", icon: Check },
  disputed: { label: "On hold, being reviewed", style: "bg-[var(--ps-danger)]/10 text-[var(--ps-danger)]", icon: CircleAlert },
  refunded: { label: "Refunded", style: "border border-[var(--ps-black)] text-[var(--ps-black)]", icon: Minus },
};

const disputeStatus: Record<DisputeStatus, { label: string; style: string; icon: typeof Check }> = {
  open: { label: "Open", style: "bg-[var(--ps-warning)]/20 text-[var(--ps-green-900)]", icon: Clock3 },
  awaiting_response: { label: "Awaiting response", style: "border border-[var(--ps-warning)] text-[var(--ps-green-900)]", icon: Clock3 },
  under_review: { label: "Under review", style: "bg-[var(--ps-danger)]/10 text-[var(--ps-danger)]", icon: CircleAlert },
  resolved: { label: "Resolved", style: "bg-[var(--ps-green-400)] text-[var(--ps-green-900)]", icon: Check },
};

const payoutStatus: Record<PayoutStatus, { label: string; style: string; icon: typeof Check }> = {
  queued: { label: "Queued", style: "border border-[var(--ps-grey-600)] text-[var(--ps-grey-600)]", icon: Clock3 },
  processing: { label: "Processing", style: "bg-[var(--ps-warning)]/20 text-[var(--ps-green-900)]", icon: Clock3 },
  pending: { label: "Pending confirmation", style: "bg-[var(--ps-warning)]/20 text-[var(--ps-green-900)]", icon: Clock3 },
  paid: { label: "Paid", style: "bg-[var(--ps-green-400)] text-[var(--ps-green-900)]", icon: Check },
  failed: { label: "Failed", style: "bg-[var(--ps-danger)]/10 text-[var(--ps-danger)]", icon: CircleAlert },
  reversed: { label: "Returned", style: "bg-[var(--ps-danger)]/10 text-[var(--ps-danger)]", icon: CircleAlert },
};

type BadgeStatus = OrderStatus | MilestoneStatus | DisputeStatus | PayoutStatus;

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const item = status in orderStatus
    ? orderStatus[status as OrderStatus]
    : status in milestoneStatus
      ? milestoneStatus[status as MilestoneStatus]
      : status in disputeStatus
        ? disputeStatus[status as DisputeStatus]
        : payoutStatus[status as PayoutStatus];
  const Icon = item.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${item.style}`}>
      <Icon size={13} aria-hidden="true" />
      {item.label}
    </span>
  );
}
