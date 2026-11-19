import type { Metadata } from "next";
import { BuyerCheckout } from "@/components/buyer/buyer-checkout";
import { InvalidPaymentLink } from "@/components/buyer/invalid-payment-link";
import { getPublicOrderByToken } from "@/server/mappers/orders";
import { env } from "@/server/env";

export const robots = { index: false, follow: false };

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const order = await getPublicOrderByToken(token);
  return {
    title: order ? `Payment for ${order.title}` : "Payment link",
    description: order
      ? `Pay ${order.seller.name} safely for ${order.title} through PaySafr.`
      : "Review a protected PaySafr payment link.",
    robots: { index: false, follow: false },
  };
}

export default async function PayPage({ params }: Props) {
  const { token } = await params;
  const order = await getPublicOrderByToken(token);
  if (!order) return <InvalidPaymentLink />;
  return <BuyerCheckout initialOrder={order} pagaEnabled={env().PAYMENT_MODE === "paga"} />;
}
