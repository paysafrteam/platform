"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  CircleAlert,
  ExternalLink,
  FilePlus2,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ApiPlaceholder } from "@/components/feedback/api-placeholder";
import {
  EmptyState,
  ErrorState,
  SkeletonCard,
} from "@/components/feedback/states";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getAdminData,
  createOrder,
  cancelOrder,
  deliverMilestone,
  updatePayoutAccount,
  markNotificationsRead,
  type CreateOrderInput,
} from "@/lib/api";
import {
  calcFee,
  calcSellerReceives,
  isMilestoneAllocationValid,
} from "@/lib/domain/rules";
import { formatLagosDate } from "@/lib/format/dates";
import { formatNaira } from "@/lib/format/money";
import type { AppStore, Order, PayoutAccount } from "@/lib/domain/types";

const EMPTY_ORDERS: Order[] = [];

export type SellerPageName =
  | "dashboard"
  | "orders"
  | "new-order"
  | "order-detail"
  | "invoices"
  | "receipts"
  | "income"
  | "trust"
  | "payout-account"
  | "notifications"
  | "settings";

const titles: Record<SellerPageName, string> = {
  dashboard: "Good morning, Tolu",
  orders: "Your orders",
  "new-order": "Create an order",
  "order-detail": "Order details",
  invoices: "Invoices",
  receipts: "Receipts",
  income: "Income",
  trust: "Your trust profile",
  "payout-account": "Payout account",
  notifications: "Notifications",
  settings: "Settings",
};

function useStore() {
  const [store, setStore] = useState<AppStore | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => {
    try {
      setStore(getAdminData());
      setFailed(false);
    } catch (error) {
      console.error("Could not load seller demo data", error);
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  return { store, failed, refresh };
}

export function SellerPage({
  page,
  orderId,
}: {
  page: SellerPageName;
  orderId?: string;
}) {
  const { store, failed, refresh } = useStore();
  const router = useRouter();
  const dialog = useStatusDialog();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [multi, setMulti] = useState(false);
  const [milestones, setMilestones] = useState([
    { title: "Delivery", amount: "" },
  ]);
  const [deadline, setDeadline] = useState("");
  const [reviewHours, setReviewHours] = useState(72);
  const [buyer, setBuyer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proof, setProof] = useState("");

  const orders = store?.orders ?? EMPTY_ORDERS;
  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        const query = search.trim().toLowerCase();
        const matchesText =
          !query ||
          `${order.title} ${order.id} ${order.seller.name}`
            .toLowerCase()
            .includes(query);
        const matchesFilter =
          filter === "all" ||
          order.status === filter ||
          (filter === "disputed" &&
            order.milestones.some((item) => item.status === "disputed")) ||
          (filter === "held" && order.status === "funded");
        return matchesText && matchesFilter;
      }),
    [orders, search, filter],
  );
  const selectedOrder = orders.find((order) => order.id === orderId);
  const amountKobo = Math.round(Number(amount || 0) * 100);
  const milestoneAmounts = multi
    ? milestones.map((item) => Math.round(Number(item.amount || 0) * 100))
    : [amountKobo];
  const allocationValid =
    amountKobo > 0 && isMilestoneAllocationValid(milestoneAmounts, amountKobo);

  async function submitOrder(publish: boolean) {
    if (!title.trim() || !amountKobo || !deadline || !allocationValid) {
      dialog.show({
        variant: "warning",
        title: "Check your order details.",
        description:
          "Add a title, amount, valid deadline and milestone allocation before saving.",
      });
      return;
    }
    const input: CreateOrderInput = {
      title: title.trim(),
      description: description.trim(),
      totalKobo: amountKobo,
      reviewWindowHours: reviewHours,
      deliveryDeadline: new Date(`${deadline}T23:59:00`).toISOString(),
      milestones: multi
        ? milestones.map((item, index) => ({
            title: item.title.trim() || `Milestone ${index + 1}`,
            amountKobo: Math.round(Number(item.amount) * 100),
          }))
        : [{ title: "Delivery", amountKobo }],
      ...(buyer.includes("@")
        ? { buyerContact: { email: buyer } }
        : buyer
          ? { buyerContact: { phone: buyer } }
          : {}),
      publish,
    };
    setSubmitting(true);
    try {
      const created = await createOrder(input);
      refresh();
      toast.success(publish ? "Order published." : "Draft saved.");
      router.push(`/orders/${created.id}`);
    } catch (error) {
      dialog.show({
        variant: "danger",
        title: "We couldn't save this order.",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function deliver(order: Order) {
    const milestone = order.milestones.find(
      (item) => item.status === "pending",
    );
    if (!milestone) return;
    try {
      await deliverMilestone(order.id, milestone.id, {
        kind: "note",
        content: proof.trim() || "Delivery submitted for buyer review.",
      });
      refresh();
      dialog.show({
        variant: "success",
        title: "Delivery marked.",
        description:
          "The buyer has been notified and their review window has started.",
      });
    } catch (error) {
      dialog.show({
        variant: "danger",
        title: "We couldn't mark this as delivered.",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  async function cancel(order: Order) {
    const confirmed = await dialog.confirm({
      variant: "danger",
      title: "Cancel this unpaid order?",
      description: "The payment link will no longer work.",
      primaryAction: { label: "Cancel order" },
      secondaryAction: { label: "Keep order" },
    });
    if (!confirmed) return;
    try {
      await cancelOrder(order.id);
      refresh();
      dialog.show({
        variant: "success",
        title: "Order cancelled.",
        description: "The buyer can no longer pay this link.",
      });
    } catch (error) {
      dialog.show({
        variant: "danger",
        title: "We couldn't cancel the order.",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  async function saveAccount(account: PayoutAccount) {
    try {
      await updatePayoutAccount(account);
      refresh();
      dialog.show({
        variant: "success",
        title: "Payout account saved.",
        description: "Your account name has been verified in this demo.",
      });
    } catch (error) {
      dialog.show({
        variant: "danger",
        title: "We couldn't save the account.",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  if (failed) return <ErrorState retry={refresh} />;
  if (!store) return <SkeletonCard />;

  const pageTitle =
    page === "order-detail" && selectedOrder
      ? selectedOrder.title
      : titles[page];
  const titleBar = (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs tracking-[0.12em] text-[var(--ps-grey-600)] uppercase">
          Seller workspace
        </p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">{pageTitle}</h1>
      </div>
      {page !== "new-order" ? (
        <Link
          href="/orders/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-4 text-sm"
        >
          <Plus size={17} /> Create order
        </Link>
      ) : null}
    </div>
  );

  if (page === "dashboard")
    return (
      <>
        {titleBar}
        <Dashboard store={store} />
        <ApiPlaceholder endpoint="GET /api/dashboard" />
      </>
    );
  if (page === "orders")
    return (
      <>
        {titleBar}
        <OrderList
          orders={visibleOrders}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
        />
      </>
    );
  if (page === "new-order")
    return (
      <>
        {titleBar}
        <CreateWizard
          {...{
            step,
            setStep,
            title,
            setTitle,
            description,
            setDescription,
            amount,
            setAmount,
            multi,
            setMulti,
            milestones,
            setMilestones,
            deadline,
            setDeadline,
            reviewHours,
            setReviewHours,
            buyer,
            setBuyer,
            submitting,
            amountKobo,
            allocationValid,
            submitOrder,
          }}
        />
      </>
    );
  if (page === "order-detail")
    return selectedOrder ? (
      <>
        {titleBar}
        <OrderDetail
          order={selectedOrder}
          proof={proof}
          setProof={setProof}
          onDeliver={() => void deliver(selectedOrder)}
          onCancel={() => void cancel(selectedOrder)}
        />
      </>
    ) : (
      <EmptyState
        title="Order not found"
        description="This order may have been removed from the demo store."
        action={
          <Link href="/orders" className="underline">
            Back to orders
          </Link>
        }
      />
    );
  if (page === "invoices")
    return (
      <>
        {titleBar}
        <OrderList
          orders={orders}
          search={search}
          setSearch={setSearch}
          filter="all"
          setFilter={() => undefined}
          onlyInvoices
        />
      </>
    );
  if (page === "receipts")
    return (
      <>
        {titleBar}
        <ReceiptList store={store} />
      </>
    );
  if (page === "income")
    return (
      <>
        {titleBar}
        <Income store={store} />
      </>
    );
  if (page === "trust")
    return (
      <>
        {titleBar}
        <Trust store={store} />
      </>
    );
  if (page === "payout-account")
    return (
      <>
        {titleBar}
        <PayoutAccountForm
          account={orders[0]?.seller.payoutAccount}
          onSave={saveAccount}
        />
      </>
    );
  if (page === "notifications")
    return (
      <>
        {titleBar}
        <Notifications store={store} refresh={refresh} />
      </>
    );
  return (
    <>
      {titleBar}
      <SettingsPage />
    </>
  );
}

function Dashboard({ store }: { store: AppStore }) {
  const active = store.orders.filter(
    (order) => order.status !== "cancelled" && order.status !== "expired",
  );
  const held = store.orders
    .filter((order) => order.status === "funded")
    .reduce(
      (sum, order) =>
        sum +
        order.milestones
          .filter(
            (item) => item.status !== "released" && item.status !== "refunded",
          )
          .reduce((total, item) => total + item.amountKobo, 0),
      0,
    );
  const released = store.ledger
    .filter((entry) => entry.type === "release")
    .reduce((sum, entry) => sum + entry.amountKobo, 0);
  const disputes = store.disputes.filter(
    (item) => item.status !== "resolved",
  ).length;
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Held safely", held],
          ["Paid out", released],
          [
            "Waiting for payment",
            store.orders.filter((item) => item.status === "awaiting_payment")
              .length,
          ],
          ["Open disputes", disputes],
        ].map(([label, amount]) => (
          <article key={String(label)} className="surface-card p-5">
            <p className="text-sm text-[var(--ps-grey-600)]">{label}</p>
            <p className="money mt-3 text-2xl">
              {(typeof amount === "number" &&
                String(label) === "Held safely") ||
              String(label) === "Paid out"
                ? formatNaira(Number(amount))
                : amount}
            </p>
          </article>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-3xl bg-[var(--ps-green-900)] p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-white/65">Income overview</p>
              <h2 className="font-display mt-1 text-2xl">
                Money moves with your work.
              </h2>
            </div>
            <Activity size={20} className="text-[var(--ps-green-400)]" />
          </div>
          <div className="mt-8 flex h-36 items-end gap-3">
            {[32, 54, 41, 72, 48, 85].map((height, index) => (
              <div
                key={index}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className="w-full rounded-t-lg bg-[var(--ps-green-400)]"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-white/60">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index]}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/60">
            Illustrative demo chart, not financial reporting.
          </p>
        </section>
        <section className="surface-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Needs your action</h2>
            <CircleAlert size={18} />
          </div>
          <ul className="mt-4 space-y-3">
            {store.orders
              .filter(
                (item) =>
                  item.status === "funded" ||
                  item.status === "awaiting_payment",
              )
              .slice(0, 4)
              .map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ps-grey-200)]/25 p-3 text-sm"
                  >
                    <span>
                      {order.status === "funded"
                        ? `Mark "${order.milestones.find((m) => m.status === "pending")?.title ?? order.title}" delivered`
                        : `Waiting for payment · ${order.title}`}
                    </span>
                    <ArrowRight size={16} />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </div>
      <section className="surface-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Recent orders</h2>
          <Link href="/orders" className="text-sm underline">
            View all
          </Link>
        </div>
        <OrderTable orders={active.slice(0, 5)} />
      </section>
      <ApiPlaceholder endpoint="GET /api/dashboard" />
    </div>
  );
}

function OrderList({
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

function OrderTable({
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
              href={invoice ? `/i/${order.id}` : `/orders/${order.id}`}
              className="text-sm font-semibold hover:underline"
            >
              {order.title}
            </Link>
            <p className="mt-1 text-xs text-[var(--ps-grey-600)]">
              {order.id} · {order.seller.name}
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
            href={invoice ? `/i/${order.id}` : `/orders/${order.id}`}
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

function CreateWizard(props: {
  step: number;
  setStep: (n: number) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  multi: boolean;
  setMulti: (v: boolean) => void;
  milestones: { title: string; amount: string }[];
  setMilestones: (v: { title: string; amount: string }[]) => void;
  deadline: string;
  setDeadline: (v: string) => void;
  reviewHours: number;
  setReviewHours: (v: number) => void;
  buyer: string;
  setBuyer: (v: string) => void;
  submitting: boolean;
  amountKobo: number;
  allocationValid: boolean;
  submitOrder: (publish: boolean) => void;
}) {
  const {
    step,
    setStep,
    title,
    setTitle,
    description,
    setDescription,
    amount,
    setAmount,
    multi,
    setMulti,
    milestones,
    setMilestones,
    deadline,
    setDeadline,
    reviewHours,
    setReviewHours,
    buyer,
    setBuyer,
    submitting,
    amountKobo,
    allocationValid,
    submitOrder,
  } = props;
  const allocated = milestones.reduce(
    (sum, item) => sum + Math.round(Number(item.amount || 0) * 100),
    0,
  );
  const remaining = amountKobo - allocated;
  return (
    <section className="surface-card p-5 sm:p-8">
      <div className="mb-7 flex gap-2">
        {["Details", "Amount", "Terms", "Review"].map((item, index) => (
          <div
            key={item}
            className={`h-1.5 flex-1 rounded-full ${step >= index ? "bg-[var(--ps-green-900)]" : "bg-[var(--ps-grey-200)]"}`}
            aria-label={`${item}, step ${index + 1}`}
          />
        ))}
      </div>
      {step === 0 ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl">What are you selling?</h2>
          <label className="block text-sm">
            Order title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={100}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
              placeholder="For example, Brand identity design"
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={1000}
              className="mt-2 w-full rounded-xl border border-[var(--ps-grey-200)] p-4"
              placeholder="Describe what the buyer will receive."
            />
          </label>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl">Set the amount.</h2>
          <label className="block text-sm">
            Total order amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="money mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
              placeholder="₦ 0.00"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMulti(false)}
              className={`rounded-2xl border p-4 text-left ${!multi ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : "border-[var(--ps-grey-200)]"}`}
            >
              <strong className="text-sm">One payment</strong>
              <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">
                Pay the full amount once.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMulti(true)}
              className={`rounded-2xl border p-4 text-left ${multi ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : "border-[var(--ps-grey-200)]"}`}
            >
              <strong className="text-sm">In milestones</strong>
              <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">
                Release payment as work progresses.
              </span>
            </button>
          </div>
          {multi ? (
            <div className="space-y-3">
              {milestones.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"
                >
                  <input
                    aria-label={`Milestone ${index + 1} title`}
                    value={item.title}
                    onChange={(event) =>
                      setMilestones(
                        milestones.map((row, i) =>
                          i === index
                            ? { ...row, title: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="h-11 rounded-xl border border-[var(--ps-grey-200)] px-3"
                    placeholder={`Milestone ${index + 1}`}
                  />
                  <input
                    aria-label={`Milestone ${index + 1} amount`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.amount}
                    onChange={(event) =>
                      setMilestones(
                        milestones.map((row, i) =>
                          i === index
                            ? { ...row, amount: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="h-11 rounded-xl border border-[var(--ps-grey-200)] px-3"
                    placeholder="Amount ₦"
                  />
                  <button
                    type="button"
                    aria-label="Remove milestone"
                    disabled={milestones.length <= 1}
                    onClick={() =>
                      setMilestones(milestones.filter((_, i) => i !== index))
                    }
                    className="min-h-11 rounded-full border px-3 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setMilestones([...milestones, { title: "", amount: "" }])
                }
                className="inline-flex min-h-11 items-center gap-2 text-sm underline"
              >
                <Plus size={15} /> Add milestone
              </button>
              <p
                className={`text-sm ${remaining === 0 ? "text-[var(--ps-green-900)]" : "text-[var(--ps-grey-600)]"}`}
              >
                {remaining >= 0
                  ? `${formatNaira(remaining)} left to allocate`
                  : `${formatNaira(Math.abs(remaining))} over allocated`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl">Agree the terms.</h2>
          <label className="block text-sm">
            Delivery deadline
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            />
          </label>
          <label className="block text-sm">
            Buyer review window
            <select
              value={reviewHours}
              onChange={(event) => setReviewHours(Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            >
              {[
                [24, "24 hours"],
                [48, "48 hours"],
                [72, "72 hours"],
                [168, "7 days"],
                [336, "14 days"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">
              Funds release after the buyer confirms or their review time ends
              without a dispute.
            </span>
          </label>
          <label className="block text-sm">
            Buyer email or phone (optional)
            <input
              value={buyer}
              onChange={(event) => setBuyer(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            />
          </label>
        </div>
      ) : null}
      {step === 3 ? (
        <div>
          <h2 className="font-display text-2xl">Review your order.</h2>
          <div className="mt-5 space-y-3 rounded-2xl bg-[var(--ps-grey-200)]/25 p-4 text-sm">
            <p>
              <span className="text-[var(--ps-grey-600)]">Title: </span>
              {title || "Untitled order"}
            </p>
            <p>
              <span className="text-[var(--ps-grey-600)]">Total: </span>
              <span className="money">{formatNaira(amountKobo)}</span>
            </p>
            <p>
              <span className="text-[var(--ps-grey-600)]">PaySafr fee: </span>
              <span className="money">{formatNaira(calcFee(amountKobo))}</span>
            </p>
            <p>
              <span className="text-[var(--ps-grey-600)]">You receive: </span>
              <span className="money">
                {formatNaira(calcSellerReceives(amountKobo))}
              </span>
            </p>
            <p>
              Delivery by {deadline || "Choose a date"} · {reviewHours} hour
              review window
            </p>
          </div>
          <p className="mt-4 text-xs text-[var(--ps-grey-600)]">
            A demo payment link will use placeholder bank details. Do not send
            money to the displayed demo account.
          </p>
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[var(--ps-grey-200)] pt-5">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0 || submitting}
          className="min-h-11 rounded-full border border-[var(--ps-grey-200)] px-5 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex flex-wrap gap-2">
          {step === 3 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitOrder(false)}
              className="min-h-11 rounded-full border border-[var(--ps-grey-200)] px-5"
            >
              Save as draft
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 0 && !title.trim()) ||
                (step === 1 && (!allocationValid || !amountKobo)) ||
                (step === 2 && !deadline)
              }
              className="min-h-11 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !allocationValid}
              onClick={() => submitOrder(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-50"
            >
              {submitting ? "Publishing…" : "Publish order"}{" "}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function OrderDetail({
  order,
  proof,
  setProof,
  onDeliver,
  onCancel,
}: {
  order: Order;
  proof: string;
  setProof: (v: string) => void;
  onDeliver: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-5">
        <section className="surface-card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--ps-grey-600)]">{order.id}</p>
              <h2 className="font-display mt-2 text-2xl">{order.title}</h2>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ps-grey-600)]">
            {order.description}
          </p>
          <div className="mt-5 grid gap-3 border-t border-[var(--ps-grey-200)] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--ps-grey-600)]">Total</p>
              <p className="money mt-1">
                <Money kobo={order.totalKobo} />
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--ps-grey-600)]">
                Delivery deadline
              </p>
              <p className="mt-1 text-sm">
                {formatLagosDate(order.deliveryDeadline)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--ps-grey-600)]">Review window</p>
              <p className="mt-1 text-sm">{order.reviewWindowHours} hours</p>
            </div>
          </div>
        </section>
        <section className="surface-card p-5 sm:p-7">
          <h2 className="font-display text-xl">Milestones</h2>
          <div className="mt-4 space-y-3">
            {order.milestones.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--ps-grey-200)]/25 p-4"
              >
                <div>
                  <p className="text-sm">
                    {item.position}. {item.title}
                  </p>
                  <p className="money mt-1 text-sm">
                    <Money kobo={item.amountKobo} />
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <aside className="space-y-4">
        <section className="surface-card p-5">
          <h2 className="font-display text-xl">Next step</h2>
          {order.status === "funded" &&
          order.milestones.some((item) => item.status === "pending") ? (
            <>
              <label className="mt-4 block text-sm">
                Delivery note or proof
                <textarea
                  value={proof}
                  onChange={(event) => setProof(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-[var(--ps-grey-200)] p-3"
                  placeholder="Share a link or describe the delivery."
                />
              </label>
              <button
                type="button"
                onClick={onDeliver}
                className="mt-4 min-h-11 w-full rounded-full bg-[var(--ps-green-400)]"
              >
                Mark as delivered
              </button>
            </>
          ) : order.status === "awaiting_payment" ||
            order.status === "draft" ? (
            <button
              type="button"
              onClick={onCancel}
              className="mt-4 min-h-11 w-full rounded-full border border-[var(--ps-grey-200)]"
            >
              Cancel unpaid order
            </button>
          ) : (
            <p className="mt-3 text-sm text-[var(--ps-grey-600)]">
              There are no seller actions needed right now.
            </p>
          )}
          <Link
            href={`/pay/${order.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm underline"
          >
            <ExternalLink size={16} /> View buyer payment page
          </Link>
          <Link
            href={`/i/${order.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex min-h-11 items-center gap-2 text-sm underline"
          >
            <FilePlus2 size={16} /> View invoice
          </Link>
        </section>
        <ApiPlaceholder endpoint="GET /api/orders/:id" />
      </aside>
    </div>
  );
}

function ReceiptList({ store }: { store: AppStore }) {
  return store.receipts.length ? (
    <div className="surface-card divide-y divide-[var(--ps-grey-200)] p-5">
      {store.receipts.map((receipt) => {
        const order = store.orders.find((item) => item.id === receipt.orderId);
        return (
          <div
            key={receipt.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div>
              <p className="text-sm">{receipt.number}</p>
              <p className="mt-1 text-xs text-[var(--ps-grey-600)]">
                {order?.title ?? "Order"} · {formatLagosDate(receipt.issuedAt)}
              </p>
            </div>
            <Link
              href={order ? `/r/${receipt.number}` : "#"}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm"
            >
              <ArrowDownToLine size={15} /> Open receipt
            </Link>
          </div>
        );
      })}
    </div>
  ) : (
    <EmptyState
      title="No receipts yet"
      description="Payment and completion receipts will appear here."
    />
  );
}

function Income({ store }: { store: AppStore }) {
  const rows = store.ledger.filter(
    (entry) => entry.type === "release" || entry.type === "refund",
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          [
            "Gross released",
            rows
              .filter((entry) => entry.type === "release")
              .reduce((sum, entry) => sum + entry.amountKobo, 0),
          ],
          ["Transactions", rows.length],
        ].map(([label, value]) => (
          <article className="surface-card p-5" key={String(label)}>
            <p className="text-sm text-[var(--ps-grey-600)]">{label}</p>
            <p className="money mt-3 text-xl">
              {typeof value === "number" && String(label) !== "Transactions"
                ? formatNaira(value)
                : value}
            </p>
          </article>
        ))}
      </div>
      <section className="surface-card p-5">
        <h2 className="font-display text-xl">Income history</h2>
        <div className="mt-4 space-y-3">
          {rows.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-2 border-b border-[var(--ps-grey-200)] pb-3 text-sm sm:grid-cols-[1fr_0.7fr_0.8fr]"
            >
              <span className="capitalize">
                {entry.type} ·{" "}
                {
                  store.orders.find((order) => order.id === entry.orderId)
                    ?.title
                }
              </span>
              <span className="money">
                <Money kobo={entry.amountKobo} />
              </span>
              <span className="text-xs text-[var(--ps-grey-600)]">
                {formatLagosDate(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Trust({ store }: { store: AppStore }) {
  const seller = store.orders[0]?.seller;
  return (
    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <section className="surface-card p-6 text-center">
        <div className="mx-auto flex size-36 items-center justify-center rounded-full border-[10px] border-[var(--ps-green-400)]">
          <span className="money text-4xl">{seller?.trustScore ?? "—"}</span>
        </div>
        <h2 className="font-display mt-5 text-2xl">
          {seller?.trustLevel ?? "New"} seller
        </h2>
        <p className="mt-2 text-sm text-[var(--ps-grey-600)]">
          Your score reflects completed work in this demo.
        </p>
      </section>
      <section className="surface-card p-6">
        <h2 className="font-display text-xl">What helps build trust?</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {[
            "Deliver on time and keep your order details clear.",
            "Respond to buyers during the review window.",
            "Complete orders and keep your payout account up to date.",
          ].map((text) => (
            <li key={text} className="flex gap-2">
              <ShieldCheck
                size={18}
                className="shrink-0 text-[var(--ps-green-900)]"
              />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-[var(--ps-grey-600)]">
          {seller?.completedOrders ?? 0} completed orders
        </p>
      </section>
    </div>
  );
}

function PayoutAccountForm({
  account,
  onSave,
}: {
  account?: PayoutAccount;
  onSave: (value: PayoutAccount) => void;
}) {
  const [bankName, setBankName] = useState(account?.bankName ?? "Access Bank");
  const [accountNumber, setAccountNumber] = useState(
    account?.accountNumber ?? "",
  );
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [verified, setVerified] = useState(Boolean(account?.verified));
  return (
    <section className="surface-card max-w-2xl p-5 sm:p-8">
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--ps-green-400)]/20 p-4 text-sm">
        <Wallet size={19} />
        <p>
          Payout details are shown only to you. Demo account numbers are
          placeholders.
        </p>
      </div>
      <label className="mt-5 block text-sm">
        Bank
        <select
          value={bankName}
          onChange={(event) => {
            setBankName(event.target.value);
            setVerified(false);
          }}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-3"
        >
          {["Access Bank", "First Bank", "GTBank", "UBA", "Zenith Bank"].map(
            (bank) => (
              <option key={bank}>{bank}</option>
            ),
          )}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Account number
        <input
          value={accountNumber}
          onChange={(event) => {
            setAccountNumber(
              event.target.value.replace(/\D/g, "").slice(0, 10),
            );
            setVerified(false);
          }}
          inputMode="numeric"
          maxLength={10}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          if (!/^\d{10}$/.test(accountNumber)) {
            toast.error("Enter a 10-digit account number.");
            return;
          }
          setAccountName("Tolu A. (Demo)");
          setVerified(true);
          toast.success("Account name checked in the demo.");
        }}
        className="mt-4 min-h-11 rounded-full border border-[var(--ps-green-900)] px-4 text-sm"
      >
        Check account name
      </button>
      {accountName ? (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Check size={16} />
          {accountName}
          {verified ? " · verified" : ""}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() =>
          onSave({
            bankCode: "044",
            bankName,
            accountNumber,
            accountName,
            verified,
          })
        }
        disabled={!verified}
        className="mt-5 min-h-12 w-full rounded-full bg-[var(--ps-green-400)] disabled:opacity-50"
      >
        Save payout account
      </button>
    </section>
  );
}

function Notifications({
  store,
  refresh,
}: {
  store: AppStore;
  refresh: () => void;
}) {
  const notifications = store.notifications;
  async function markRead() {
    try {
      await markNotificationsRead();
      refresh();
      toast.success("Notifications marked as read.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update notifications.",
      );
    }
  }
  return (
    <section className="surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">Recent updates</h2>
        <button
          type="button"
          onClick={() => void markRead()}
          className="text-sm underline"
        >
          Mark all read
        </button>
      </div>
      {notifications.length ? (
        <div className="mt-4 space-y-2">
          {notifications.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl p-4 ${item.read ? "bg-white" : "bg-[var(--ps-green-400)]/15"}`}
            >
              <div className="flex gap-3">
                <Bell size={17} />
                <div>
                  <p className="text-sm">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--ps-grey-600)]">
                    {item.message}
                  </p>
                  <p className="mt-2 text-xs text-[var(--ps-grey-600)]">
                    {formatLagosDate(item.createdAt)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--ps-grey-600)]">
          You&apos;re all caught up.
        </p>
      )}
      <ApiPlaceholder endpoint="GET /api/notifications" />
    </section>
  );
}

function SettingsPage() {
  const [name, setName] = useState("Tolu A.");
  const [email, setEmail] = useState("tolu@example.test");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="surface-card p-5 sm:p-7">
        <h2 className="font-display text-xl">Profile details</h2>
        <label className="mt-4 block text-sm">
          Display name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-3"
          />
        </label>
        <label className="mt-4 block text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-3"
          />
        </label>
        <button
          type="button"
          onClick={() => toast.success("Profile saved in this demo.")}
          className="mt-5 min-h-11 rounded-full bg-[var(--ps-green-400)] px-5"
        >
          Save changes
        </button>
      </section>
      <section className="surface-card p-5 sm:p-7">
        <h2 className="font-display text-xl">Account and security</h2>
        <p className="mt-3 text-sm text-[var(--ps-grey-600)]">
          Keep your contact details current. Password and security controls are
          demo placeholders.
        </p>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex min-h-11 items-center gap-2 underline"
        >
          Sign out <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
