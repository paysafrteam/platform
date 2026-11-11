import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata: Metadata = { title: "Security", description: "Learn the simple rules behind PaySafr's protected payment flow." };
export default function Page() { return <MarketingPage kind="security" eyebrow="Our promise" title="Security in plain words." description="We make each step visible, and the next action clear for both sides." />; }
