import type { Metadata } from "next";
import { ReceiptByToken } from "@/components/share/receipt-by-token";

export const metadata: Metadata = { title: "Payment receipt", robots: { index: false, follow: false } };

export default async function BuyerReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ReceiptByToken token={token} />;
}
