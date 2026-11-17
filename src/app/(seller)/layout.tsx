import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SkeletonCard } from "@/components/feedback/states";
import { SellerShell } from "@/components/layout/seller-shell";
import { getOptionalUser } from "@/server/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function SellerGate({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect("/sign-in");
  return <SellerShell userName={user.businessName ?? user.name}>{children}</SellerShell>;
}

export default function SellerLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-8"><SkeletonCard /></div>}>
      <SellerGate>{children}</SellerGate>
    </Suspense>
  );
}
