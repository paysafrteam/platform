import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { SafrPills } from "@/components/brand/safr-pills";
import { SocialLinks } from "@/components/brand/social-links";

const columns: { title: string; items: [string, string][] }[] = [
  { title: "Product", items: [["How it works", "/how-it-works"], ["Pricing", "/pricing"], ["FAQs", "/faqs"], ["Security", "/security"]] },
  { title: "Company", items: [["Contact", "/contact"]] },
  { title: "Legal", items: [["Terms", "/terms"], ["Privacy", "/privacy"]] },
];

export function Footer() {
  return (
    <footer className="mt-20 rounded-t-[32px] bg-[var(--ps-green-900)] text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo tone="on-dark" />
            <p className="mt-4 max-w-xs text-sm text-white/70">Work Delivered, Payments Secured.</p>
            <div className="mt-5"><SafrPills /></div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.items.map(([label, href]) => (
                    <li key={href}><Link className="text-sm text-white/70 hover:text-white" href={href}>{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h2 className="text-sm font-semibold">Follow us</h2>
              <div className="mt-4"><SocialLinks onDark /></div>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/15 pt-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 PaySafr. All rights reserved.</span>
          <PoweredByPaga variant="footer" tone="on-dark" />
          <span>[LEGAL COPY TBC] Payments are processed through Paga Engine.</span>
        </div>
      </div>
    </footer>
  );
}
