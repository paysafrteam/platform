import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata: Metadata = { title: "How it works", description: "See how PaySafr protects a buyer and seller from payment to delivery." };
export default function Page() { return <MarketingPage kind="how" eyebrow="How it works" title="A clear path from payment to delivery." description="One shared order page makes the terms, timing and next step easy to understand." />; }
