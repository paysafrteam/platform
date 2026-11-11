import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata: Metadata = { title: "Pricing", description: "See PaySafr's example fee and calculate a seller payout." };
export default function Page() { return <MarketingPage kind="pricing" eyebrow="Pricing" title="A small fee. Clear from the start." description="The buyer pays the order amount. The seller pays a percentage fee when money is released." />; }
