import { QrCode } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { Money } from "@/components/ui/money";
import { ShareActions } from "@/components/share/share-actions";
import { formatLagosDate } from "@/lib/format/dates";
import type { PublicReceipt } from "@/lib/domain/types";

const outcomeLabel: Record<NonNullable<PublicReceipt["outcome"]>, string> = {
  funded: "Paid and held safely", released: "Released to seller", refunded: "Refunded to buyer", split: "Split between seller and buyer",
};

export function ReceiptTemplate({ receipt, publicUrl }: { receipt: PublicReceipt; publicUrl: string }) {
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <article className="surface-card overflow-hidden bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <Logo />
          <span className="rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1 text-xs">{receipt.type === "payment" ? "Payment receipt" : "Completion receipt"}</span>
        </div>
        <p className="mt-8 text-xs tracking-wider text-[var(--ps-grey-600)] uppercase">Receipt number</p>
        <h1 className="font-display mt-1 text-2xl">{receipt.number}</h1>
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[var(--ps-grey-200)] py-4 text-sm">
          <div><p className="text-xs text-[var(--ps-grey-600)]">Date issued</p><p className="mt-1">{formatLagosDate(receipt.issuedAt)}</p></div>
          <div><p className="text-xs text-[var(--ps-grey-600)]">Status</p><p className="mt-1">{receipt.outcome ? outcomeLabel[receipt.outcome] : "Recorded"}</p></div>
          <div><p className="text-xs text-[var(--ps-grey-600)]">Seller</p><p className="mt-1">{receipt.sellerName}</p></div>
          <div><p className="text-xs text-[var(--ps-grey-600)]">Buyer</p><p className="mt-1 break-all">{receipt.buyerContact ?? "Guest buyer"}</p></div>
        </div>
        <div className="py-5">
          <p className="text-xs text-[var(--ps-grey-600)]">Description</p>
          <p className="mt-1 text-sm">{receipt.title}{receipt.milestoneTitle ? ` · ${receipt.milestoneTitle}` : ""}</p>
          {receipt.description ? <p className="mt-1 text-xs leading-5 text-[var(--ps-grey-600)]">{receipt.description}</p> : null}
        </div>
        <div className="space-y-3 border-t border-[var(--ps-grey-200)] py-4 text-sm">
          <div className="flex items-center justify-between"><span>Amount</span><span className="money text-xl"><Money kobo={receipt.amountKobo} /></span></div>
          {receipt.feeKobo ? <div className="flex justify-between text-[var(--ps-grey-600)]"><span>PaySafr fee (paid by seller)</span><Money kobo={receipt.feeKobo} /></div> : null}
          {receipt.netKobo ? <div className="flex justify-between"><span>Paid to seller</span><Money kobo={receipt.netKobo} /></div> : null}
          {receipt.refundedKobo ? <div className="flex justify-between"><span>Refunded to buyer</span><Money kobo={receipt.refundedKobo} /></div> : null}
          {receipt.milestoneTitle ? <div className="flex justify-between text-[var(--ps-grey-600)]"><span>Order total</span><Money kobo={receipt.orderTotalKobo} /></div> : null}
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--ps-grey-200)] pt-5">
          <div className="text-xs leading-5 text-[var(--ps-grey-600)]">usepaysafr.com<br />@usepaysafr</div>
          <div className="flex size-14 items-center justify-center rounded-xl border border-dashed border-[var(--ps-grey-200)] text-[var(--ps-grey-600)]" aria-hidden="true"><QrCode size={24} /></div>
        </div>
        <div className="mt-5"><PoweredByPaga variant="footer" /></div>
      </article>
      <div className="mt-4 print:hidden"><ShareActions kind="receipt" copyUrl={publicUrl} shareText={`Receipt ${receipt.number} from PaySafr`} /></div>
    </div>
  );
}
