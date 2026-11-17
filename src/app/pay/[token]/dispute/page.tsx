import type { Metadata } from "next";
import { DisputeFlow } from "@/components/buyer/dispute-flow";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";
import { getPublicOrderByToken } from "@/server/mappers/orders";

export const metadata: Metadata = { title: "Open a dispute", robots: { index: false, follow: false } };

export default async function DisputePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ milestone?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const order = await getPublicOrderByToken(token);
  if (!order) return <InvalidPaymentLink />;
  return <DisputeFlow order={order} milestoneId={query.milestone} />;
}
