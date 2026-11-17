import { QrCode } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { Money } from "@/components/ui/money";
import { ShareActions } from "@/components/share/share-actions";
import { formatLagosDate } from "@/lib/format/dates";
import type { PublicInvoice } from "@/lib/domain/types";

export function InvoiceTemplate({ invoice, publicUrl }: { invoice: PublicInvoice; publicUrl: string }) {
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <article className="surface-card overflow-hidden bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <Logo />
          <span className="rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1 text-xs">Invoice</span>
        </div>
        <p className="mt-8 text-xs tracking-wider text-[var(--ps-grey-600)] uppercase">Invoice reference</p>
        <h1 className="font-display mt-1 break-all text-2xl">INV-{invoice.token.slice(0, 8).toUpperCase()}</h1>
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[var(--ps-grey-200)] py-4 text-sm">
          <div><p className="text-xs text-[var(--ps-grey-600)]">Issued</p><p className="mt-1">{formatLagosDate(invoice.createdAt)}</p></div>
          <div><p className="text-xs text-[var(--ps-grey-600)]">Pay by</p><p className="mt-1">{invoice.dueAt ? formatLagosDate(invoice.dueAt) : "-"}</p></div>
          <div><p className="text-xs text-[var(--ps-grey-600)]">Seller</p><p className="mt-1">{invoice.businessName ?? invoice.sellerName}</p></div>
          <div><p className="text-xs text-[var(--ps-grey-600)]">Buyer</p><p className="mt-1 break-all">{invoice.buyerContact ?? "Guest buyer"}</p></div>
        </div>
        <div className="py-5">
          <p className="text-xs text-[var(--ps-grey-600)]">Order</p>
          <p className="mt-1 text-sm">{invoice.title}</p>
          {invoice.description ? <p className="mt-1 text-xs leading-5 text-[var(--ps-grey-600)]">{invoice.description}</p> : null}
          {invoice.milestones.length > 1 ? (
            <ul className="mt-3 space-y-1 text-sm">{invoice.milestones.map((m, i) => <li key={i} className="flex justify-between"><span>{m.title}</span><Money kobo={m.amountKobo} /></li>)}</ul>
          ) : null}
        </div>
        <div className="space-y-3 border-t border-[var(--ps-grey-200)] py-4 text-sm">
          <div className="flex justify-between"><span>Order total</span><Money kobo={invoice.totalKobo} /></div>
          <div className="flex justify-between"><span>PaySafr fee (paid by seller)</span><Money kobo={invoice.feeKobo} /></div>
          <div className="flex justify-between border-t border-[var(--ps-grey-200)] pt-3 font-semibold"><span>Seller receives</span><Money kobo={invoice.sellerReceivesKobo} /></div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--ps-grey-200)] pt-5">
          <p className="text-xs leading-5 text-[var(--ps-grey-600)]">usepaysafr.com<br />@usepaysafr</p>
          <span className="flex size-14 items-center justify-center rounded-xl border border-dashed border-[var(--ps-grey-200)] text-[var(--ps-grey-600)]" aria-hidden="true"><QrCode size={24} /></span>
        </div>
        <div className="mt-5"><PoweredByPaga variant="footer" /></div>
      </article>
      <div className="mt-4 print:hidden"><ShareActions kind="invoice" copyUrl={publicUrl} shareText={`Invoice for ${invoice.title}`} /></div>
    </div>
  );
}
