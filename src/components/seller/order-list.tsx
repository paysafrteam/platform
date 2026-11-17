"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/states";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatLagosDate } from "@/lib/format/dates";
import type { SellerOrder as Order } from "@/lib/domain/types";

export function OrderList({
  orders,
  search,
  setSearch,
  filter,
  setFilter,
  onlyInvoices = false,
}: {
  orders: Order[];
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  onlyInvoices?: boolean;
}) {
  const shown = onlyInvoices
    ? orders.filter(
        (order) => order.status !== "draft" && order.status !== "cancelled",
      )
    : orders;
  return (
    <div className="space-y-5">
      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-[var(--ps-grey-200)] px-3">
          <Search size={16} />
          <span className="sr-only">Search orders</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, seller or order ID"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        {!onlyInvoices ? (
          <select
            aria-label="Filter by status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-11 rounded-xl border border-[var(--ps-grey-200)] px-3 text-sm"
          >
            {[
              ["all", "All orders"],
              ["awaiting_payment", "Waiting for payment"],
              ["held", "Money held"],
              ["completed", "Completed"],
              ["disputed", "Disputed"],
              ["expired", "Other"],
            ].map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {shown.length ? (
        <section className="surface-card overflow-hidden p-4 sm:p-6">
          <OrderTable orders={shown} invoice={onlyInvoices} />
        </section>
      ) : (
        <EmptyState
          title={onlyInvoices ? "No invoices yet" : "No orders match"}
          description={
            onlyInvoices
              ? "Invoices appear here when you create an order."
              : "Try another search or status filter."
          }
          action={
            <Link
              href="/orders/new"
              className="rounded-full bg-[var(--ps-green-400)] px-4 py-3 text-sm"
            >
              Create an order
            </Link>
          }
        />
      )}
    </div>
  );
}

export function OrderTable({
  orders,
  invoice = false,
}: {
  orders: Order[];
  invoice?: boolean;
}) {
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <article
          key={order.id}
          className="grid gap-3 border-b border-[var(--ps-grey-200)] pb-3 last:border-0 last:pb-0 sm:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_auto] sm:items-center"
        >
          <div>
            <Link
              href={invoice ? `/i/${order.token}` : `/orders/${order.id}`}
              className="text-sm font-semibold hover:underline"
            >
              {order.title}
            </Link>
            <p className="mt-1 text-xs text-[var(--ps-grey-600)]">
              {order.id.slice(0, 8)} · {order.milestones.length} milestone{order.milestones.length === 1 ? "" : "s"}
            </p>
          </div>
          <p className="money text-sm">
            <Money kobo={order.totalKobo} />
          </p>
          <div>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-[var(--ps-grey-600)]">
            {formatLagosDate(order.createdAt)}
          </p>
          <Link
            href={invoice ? `/i/${order.token}` : `/orders/${order.id}`}
            aria-label={`View ${order.title}`}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--ps-grey-200)]"
          >
            <ArrowRight size={17} />
          </Link>
        </article>
      ))}
    </div>
  );
}

