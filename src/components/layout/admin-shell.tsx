"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity, Banknote, ClipboardList, FileSearch, Gauge, HandCoins, ScrollText, Settings, Store } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { BackButton } from "@/components/ui/back-button";

const links = [
  { href: "/admin/overview", label: "Overview", icon: Gauge },
  { href: "/admin/disputes", label: "Disputes", icon: FileSearch },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/ledger", label: "Ledger", icon: Banknote },
  { href: "/admin/payouts", label: "Payouts", icon: HandCoins },
  { href: "/admin/sellers", label: "Sellers", icon: Store },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: Activity },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/sign-in") return children;
  return (
    <div className="min-h-screen bg-[var(--ps-grey-200)]/20">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[var(--ps-grey-200)] bg-white px-5 py-6 lg:flex">
        <Logo />
        <p className="mt-8 rounded-xl bg-[var(--ps-green-900)] px-3 py-2 text-xs tracking-wider text-white">
          ADMIN · SANDBOX
        </p>
        <nav className="mt-5 flex-1 space-y-1" aria-label="Admin navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${pathname === href || pathname.startsWith(`${href}/`) ? "bg-[var(--ps-green-900)] text-white" : "text-[var(--ps-grey-600)] hover:bg-[var(--ps-grey-200)]/35"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <PoweredByPaga variant="footer" />
      </aside>
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--ps-grey-200)] bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <BackButton />
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="hidden text-sm text-[var(--ps-grey-600)] lg:block">
              PaySafr operations · Sandbox only
            </p>
          </div>
          <span className="rounded-full bg-[var(--ps-warning)]/20 px-3 py-1 text-xs">
            Demo data
          </span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-7 sm:py-8">
          {children}
        </main>
      </div>
      <nav
        className="fixed inset-x-2 bottom-2 z-40 flex justify-around overflow-x-auto rounded-full border border-[var(--ps-grey-200)] bg-white/95 p-2 shadow-xl backdrop-blur lg:hidden"
        aria-label="Mobile admin navigation"
      >
        {links.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex size-11 shrink-0 items-center justify-center rounded-full ${pathname === href ? "bg-[var(--ps-green-900)] text-white" : ""}`}
          >
            <Icon size={17} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
