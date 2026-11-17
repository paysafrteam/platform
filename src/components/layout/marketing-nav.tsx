"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/faqs", label: "FAQs" },
  { href: "/security", label: "Security" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--ps-grey-200)]/70 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <Link href="/" aria-label="PaySafr home"><Logo /></Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link key={link.href} className="nav-link text-sm text-[var(--ps-grey-600)]" href={link.href}>{link.label}</Link>
          ))}
        </div>
        <div className="hidden items-center gap-5 md:flex">
          <Link className="nav-link text-sm" href="/sign-in">Sign In</Link>
          <Link className="btn-primary" href="/get-started">
            Get Started <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/get-started" className="btn-primary">Get Started</Link>
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--ps-grey-200)]">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
      {open ? (
        <div className="absolute inset-x-0 top-[72px] min-h-[calc(100dvh-72px)] border-t border-[var(--ps-grey-200)] bg-white px-5 py-8 md:hidden">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {links.map((link) => (
              <Link key={link.href} onClick={() => setOpen(false)} className="nav-link flex min-h-14 items-center border-b border-[var(--ps-grey-200)] text-lg" href={link.href}>{link.label}</Link>
            ))}
            <Link onClick={() => setOpen(false)} className="btn-secondary mt-4 w-full" href="/sign-in">Sign In</Link>
            <Link onClick={() => setOpen(false)} className="btn-primary w-full" href="/get-started">Get Started</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
