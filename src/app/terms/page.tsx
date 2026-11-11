import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata: Metadata = { title: "Terms", description: "PaySafr terms placeholder." };
export default function Page() { return <MarketingPage kind="legal" eyebrow="Legal" title="Terms of service." description="A clear agreement helps every deal start on the right foot." />; }
