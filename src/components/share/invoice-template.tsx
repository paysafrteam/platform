import { QrCode } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PoweredByPaga } from "@/components/brand/powered-by-paga";
import { Money } from "@/components/ui/money";
import { ShareActions } from "@/components/share/share-actions";
import { formatLagosDate } from "@/lib/format/dates";
import { calcSellerReceives } from "@/lib/domain/rules";
import type { Order } from "@/lib/domain/types";

export function InvoiceTemplate({
  order,
  publicUrl,
}: {
  order: Order;
  publicUrl: string;
}) {
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
            Invoice
          </span>
        </div>
        <p className="mt-8 text-xs tracking-wider text-[var(--ps-grey-600)] uppercase">
          Invoice number
        </p>
        <h1 className="font-display mt-1 text-2xl">
          INV-{order.id.toUpperCase()}
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[var(--ps-grey-200)] py-4 text-sm">
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Issued</p>
            <p className="mt-1">{formatLagosDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Due</p>
            <p className="mt-1">{formatLagosDate(order.expiresAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Seller</p>
            <p className="mt-1">
              {order.seller.businessName ?? order.seller.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--ps-grey-600)]">Buyer</p>
            <p className="mt-1 break-all">
              {order.buyerContact?.email ??
                order.buyerContact?.phone ??
                "Guest buyer"}
            </p>
          </div>
        </div>
        <div className="py-5">
          <p className="text-xs text-[var(--ps-grey-600)]">Order</p>
          <p className="mt-1 text-sm">{order.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ps-grey-600)]">
            {order.description}
          </p>
        </div>
        <div className="space-y-3 border-t border-[var(--ps-grey-200)] py-4 text-sm">
          <div className="flex justify-between">
            <span>Order total</span>
            <Money kobo={order.totalKobo} />
          </div>
          <div className="flex justify-between">
            <span>PaySafr fee (seller)</span>
            <Money kobo={order.feeKobo} />
          </div>
          <div className="flex justify-between border-t border-[var(--ps-grey-200)] pt-3 font-semibold">
            <span>Seller receives</span>
            <Money kobo={calcSellerReceives(order.totalKobo)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--ps-grey-200)] pt-5">
          <p className="text-xs leading-5 text-[var(--ps-grey-600)]">
            usepaysafr.com
            <br />
            @usepaysafr
          </p>
          <span className="flex size-14 items-center justify-center rounded-xl border border-dashed border-[var(--ps-grey-200)] text-[var(--ps-grey-600)]">
            <QrCode size={24} />
          </span>
        </div>
        <div className="mt-5">
          <PoweredByPaga variant="footer" />
        </div>
      </article>
      <div className="mt-4 print:hidden">
        <ShareActions kind="invoice" copyUrl={publicUrl} />
      </div>
    </div>
  );
}
