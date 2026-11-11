import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata: Metadata = { title: "Privacy", description: "PaySafr privacy notice placeholder." };
export default function Page() { return <MarketingPage kind="legal" eyebrow="Legal" title="Privacy notice." description="Your information should be handled with care and explained in plain words." />; }
