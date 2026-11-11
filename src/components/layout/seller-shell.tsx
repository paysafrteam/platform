"use client";

import {
  Bell,
  CircleDollarSign,
  FileCheck2,
  Home,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { BackButton } from "@/components/ui/back-button";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: Store },
  { href: "/invoices", label: "Invoices", icon: FileCheck2 },
  { href: "/receipts", label: "Receipts", icon: ReceiptText },
  { href: "/income", label: "Income", icon: CircleDollarSign },
  { href: "/trust", label: "Trust", icon: ShieldCheck },
  { href: "/payout-account", label: "Payout account", icon: WalletCards },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SellerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[var(--ps-grey-200)]/20">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--ps-grey-200)] bg-white px-5 py-6 lg:flex">
        <Logo />
        <div className="mt-8 rounded-2xl bg-[var(--ps-green-400)]/20 p-4">
          <p className="text-xs text-[var(--ps-grey-600)]">DEMO SELLER</p>
          <p className="mt-1 text-sm">Tolu A.</p>
        </div>
        <nav className="mt-6 flex-1 space-y-1" aria-label="Seller navigation">
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
        <Link
          href="/orders/new"
          className="btn-primary w-full text-sm"
        >
          <Plus size={18} /> Create order
        </Link>
        <div className="mt-5">
          <PoweredByPaga variant="footer" />
        </div>
        <Link href="/" className="mt-4 text-xs text-[var(--ps-grey-600)]">
          Back to PaySafr
        </Link>
      </aside>
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--ps-grey-200)] bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <BackButton />
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="hidden text-sm text-[var(--ps-grey-600)] lg:block">
              Seller workspace · Demo mode
            </p>
          </div>
          <Link
            href="/notifications"
            className="flex size-11 items-center justify-center rounded-full border border-[var(--ps-grey-200)]"
            aria-label="Notifications"
          >
            <Bell size={18} />
          </Link>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-7 sm:py-8 lg:pb-10">
          {children}
        </div>
      </div>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full border border-[var(--ps-grey-200)] bg-white/95 px-2 py-2 shadow-xl backdrop-blur lg:hidden"
        aria-label="Mobile seller navigation"
      >
        {links.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={pathname === href ? "page" : undefined}
            className={`flex size-11 items-center justify-center rounded-full ${pathname === href || pathname.startsWith(`${href}/`) ? "bg-[var(--ps-green-900)] text-white" : "text-[var(--ps-grey-600)]"}`}
          >
            <Icon size={18} />
          </Link>
        ))}
        <Link
          href="/orders/new"
          aria-label="Create order"
          className="flex size-12 items-center justify-center rounded-full bg-[var(--ps-green-400)]"
        >
          <Plus size={20} />
        </Link>
      </nav>
    </div>
  );
}
