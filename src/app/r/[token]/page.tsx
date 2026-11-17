import type { Metadata } from "next";
import { PublicReceipt } from "@/components/share/public-receipt";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

export default async function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicReceipt token={token} />;
}
