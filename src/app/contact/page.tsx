import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata: Metadata = { title: "Contact", description: "Get in touch with the PaySafr team." };
export default function Page() { return <MarketingPage kind="contact" eyebrow="Contact" title="We are here to help." description="Send a note or find us through our social channels." />; }
