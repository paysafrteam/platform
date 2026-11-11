import { QrCode } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShareActions } from "@/components/share/share-actions";
import { formatLagosDate } from "@/lib/format/dates";
import type { Order, Receipt } from "@/lib/domain/types";

export function ReceiptTemplate({
  order,
  receipt,
  publicUrl,
}: {
  order: Order;
  receipt: Receipt;
  publicUrl: string;
}) {
  const buyer =
    order.buyerContact?.email ?? order.buyerContact?.phone ?? "Guest buyer";
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <article className="surface-card overflow-hidden bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:shadow-none">
        {process.env.NODE_ENV !== "production" ? (
          <div className="mb-5 inline-flex rounded-full bg-[var(--ps-grey-200)] px-3 py-1 text-[10px] tracking-wider text-[var(--ps-grey-600)] uppercase">
            Template placeholder
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-4">
          <Logo />
          <span className="rounded-full bg-[var(--ps-green-400)]/20 px-3 py-1 text-xs">
            Receipt
          </span>
        </div>
        <p className="mt-8 text-xs tracking-wider text-[var(--ps-grey-600)] uppercase">
          Receipt number
        </p>
        <h1 className="font-display mt-1 text-2xl">{receipt.number}</h1>
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[var(--ps-grey-200)] py-4 text-sm">
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Date issued</p>
            <p className="mt-1">{formatLagosDate(receipt.issuedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Order reference</p>
            <p className="mt-1 break-all">{order.id}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Seller</p>
            <p className="mt-1">
              {order.seller.businessName ?? order.seller.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Buyer</p>
            <p className="mt-1 break-all">{buyer}</p>
          </div>
        </div>
        <div className="py-5">
          <p className="text-xs text-[var(--ps-grey-600)]">Description</p>
          <p className="mt-1 text-sm">{order.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ps-grey-600)]">
            {order.description}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--ps-grey-200)] py-4">
          <span className="text-sm">Amount</span>
          <span className="money text-xl">
            <Money kobo={order.totalKobo} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Status</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--ps-grey-200)] pt-5">
          <div className="text-xs leading-5 text-[var(--ps-grey-600)]">
            usepaysafr.com
            <br />
            @usepaysafr
          </div>
          <div
            className="flex size-14 items-center justify-center rounded-xl border border-dashed border-[var(--ps-grey-200)] text-[var(--ps-grey-600)]"
            aria-label="QR code placeholder"
          >
            <QrCode size={24} />
          </div>
        </div>
        <div className="mt-5">
          <PoweredByPaga variant="footer" />
        </div>
      </article>
      <div className="mt-4 print:hidden">
        <ShareActions kind="receipt" copyUrl={publicUrl} />
      </div>
    </div>
  );
}
