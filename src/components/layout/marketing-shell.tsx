import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { MarketingNav } from "@/components/layout/marketing-nav";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      {children}
      <Footer />
    </>
  );
}
