import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SkeletonCard } from "@/components/feedback/states";
import { AdminShell } from "@/components/layout/admin-shell";
import { getOptionalAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await getOptionalAdmin();
  if (!admin) redirect("/admin/sign-in");
  return <AdminShell adminName={admin.name}>{children}</AdminShell>;
}

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-8"><SkeletonCard /></div>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
