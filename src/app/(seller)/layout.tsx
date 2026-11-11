import type { Metadata } from "next";
import { SellerShell } from "@/components/layout/seller-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SellerLayout({ children }: LayoutProps<"/">) {
  return <SellerShell>{children}</SellerShell>;
}
