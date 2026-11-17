"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/feedback/states";
import { useStatusDialog } from "@/components/feedback/dialog-provider";
import { CreateWizard } from "@/components/seller/create-wizard";
import { OrderDetail } from "@/components/seller/order-detail";
import { OrderList } from "@/components/seller/order-list";
import { Dashboard, Income, InvoiceList, Notifications, PayoutAccountForm, ReceiptList, SettingsPage, Trust } from "@/components/seller/seller-sections";
import {
  ApiError, createOrder, getDashboard, getIncome, getMe, getOrder, getTrust, listBanks, listInvoices, listNotifications, listOrders, listReceipts,
  savePayoutAccount, type CreateOrderInput,
} from "@/lib/api";
import { isMilestoneAllocationValid } from "@/lib/domain/rules";
import type { DashboardData, IncomeData, Me, Notification, PublicInvoice, PublicReceipt, SellerOrder, TrustData } from "@/lib/domain/types";

export type SellerPageName = "dashboard" | "orders" | "new-order" | "order-detail" | "invoices" | "receipts" | "income" | "trust" | "payout-account" | "notifications" | "settings";

const titles: Record<SellerPageName, string> = {
  dashboard: "Your dashboard", orders: "Your orders", "new-order": "Create an order", "order-detail": "Order details", invoices: "Invoices", receipts: "Receipts",
  income: "Income", trust: "Your trust profile", "payout-account": "Payout account", notifications: "Notifications", settings: "Settings",
};

interface Loaded {
  orders?: SellerOrder[]; order?: SellerOrder; dashboard?: DashboardData; income?: IncomeData; trust?: TrustData; receipts?: PublicReceipt[];
  invoices?: PublicInvoice[]; notifications?: Notification[]; me?: Me; banks?: { code: string; name: string }[];
}

function useLoad(page: SellerPageName, orderId?: string) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const refresh = useCallback(() => {
    const run = async (): Promise<Loaded> => {
      switch (page) {
        case "dashboard": return { dashboard: await getDashboard() };
        case "orders": return { orders: await listOrders() };
        case "new-order": return { me: await getMe() };
        case "order-detail": return { order: await getOrder(orderId ?? "") };
        case "invoices": return { invoices: await listInvoices() };
        case "receipts": return { receipts: await listReceipts() };
        case "income": return { income: await getIncome() };
        case "trust": return { trust: await getTrust() };
        case "notifications": return { notifications: await listNotifications() };
        case "payout-account": { const [me, banks] = await Promise.all([getMe(), listBanks()]); return { me, banks }; }
        default: return { me: await getMe() };
      }
    };
    run().then((d) => { setData(d); setFailed(false); setNotFound(false); }).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 401) { router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`); return; }
      if (e instanceof ApiError && e.status === 404) setNotFound(true); else setFailed(true);
    });
  }, [page, orderId, router]);
  useEffect(() => { const t = window.setTimeout(refresh, 0); return () => window.clearTimeout(t); }, [refresh]);
  return { data, setData, failed, notFound, refresh };
}

export function SellerPage({ page, orderId }: { page: SellerPageName; orderId?: string }) {
  const { data, setData, failed, notFound, refresh } = useLoad(page, orderId);
  const router = useRouter();
  const dialog = useStatusDialog();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [multi, setMulti] = useState(false);
  const [milestones, setMilestones] = useState([{ title: "Delivery", amount: "" }]);
  const [deadline, setDeadline] = useState("");
  const [reviewHours, setReviewHours] = useState(72);
  const [buyer, setBuyer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const orders = data?.orders;
  const visibleOrders = useMemo(() => (orders ?? []).filter((order) => {
    const query = search.trim().toLowerCase();
    const text = !query || `${order.title} ${order.id}`.toLowerCase().includes(query);
    const status = filter === "all" || order.status === filter || (filter === "disputed" && order.milestones.some((m) => m.status === "disputed")) || (filter === "held" && order.status === "funded");
    return text && status;
  }), [orders, search, filter]);

  const amountKobo = Math.round(Number(amount || 0) * 100);
  const milestoneAmounts = multi ? milestones.map((m) => Math.round(Number(m.amount || 0) * 100)) : [amountKobo];
  const allocationValid = amountKobo > 0 && isMilestoneAllocationValid(milestoneAmounts, amountKobo);

  async function submitOrder(publish: boolean) {
    if (!title.trim() || !amountKobo || !deadline || !allocationValid) {
      dialog.show({ variant: "warning", title: "Check your order details.", description: "Add a title, amount, valid deadline and milestone allocation before saving." });
      return;
    }
    const input: CreateOrderInput = {
      title: title.trim(), description: description.trim(), totalKobo: amountKobo, reviewWindowHours: reviewHours,
      deliveryDeadline: new Date(`${deadline}T23:59:00`).toISOString(),
      milestones: multi ? milestones.map((m, i) => ({ title: m.title.trim() || `Milestone ${i + 1}`, amountKobo: Math.round(Number(m.amount) * 100) })) : [{ title: "Delivery", amountKobo }],
      ...(buyer.trim() ? { buyerContact: buyer.includes("@") ? { email: buyer.trim() } : { phone: buyer.trim() } } : {}),
      publish,
    };
    setSubmitting(true);
    try {
      const created = await createOrder(input);
      toast.success(publish ? "Order published." : "Draft saved.");
      router.push(`/orders/${created.id}`);
    } catch (error) {
      const needsAccount = error instanceof ApiError && error.code === "CONFLICT" && /payout account/i.test(error.message);
      dialog.show({
        variant: "danger", title: "We couldn't save this order.", description: error instanceof Error ? error.message : "Try again.",
        primaryAction: needsAccount ? { label: "Add payout account", onClick: () => router.push("/payout-account") } : { label: "Close" },
      });
    } finally { setSubmitting(false); }
  }

  async function saveAccount(account: { bankCode: string; accountNumber: string; accountName: string }) {
    try {
      await savePayoutAccount(account);
      refresh();
      dialog.show({ variant: "success", title: "Payout account saved.", description: "Released money will be sent to this account.", primaryAction: { label: "Done" } });
    } catch (error) {
      dialog.show({ variant: "danger", title: "We couldn't save the account.", description: error instanceof Error ? error.message : "Try again.", primaryAction: { label: "Close" } });
    }
  }

  if (failed) return <ErrorState retry={refresh} />;
  if (notFound) return <EmptyState title="Order not found" description="This order does not exist or is not yours." action={<Link href="/orders" className="underline">View orders</Link>} />;
  if (!data) return <SkeletonCard />;

  const pageTitle = page === "order-detail" && data.order ? data.order.title : titles[page];
  const titleBar = (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs tracking-[0.12em] text-[var(--ps-grey-600)] uppercase">Seller workspace</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">{pageTitle}</h1>
      </div>
      {page !== "new-order" ? <Link href="/orders/new" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-4 text-sm"><Plus size={17} /> Create order</Link> : null}
    </div>
  );

  return (
    <>
      {titleBar}
      {page === "dashboard" && data.dashboard ? <Dashboard data={data.dashboard} /> : null}
      {page === "orders" ? <OrderList orders={visibleOrders} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} /> : null}
      {page === "new-order" ? (
        <>
          {data.me && !data.me.payoutAccount ? <p className="mb-5 rounded-2xl bg-[var(--ps-warning)]/20 p-4 text-sm">Add a <Link href="/payout-account" className="underline">payout account</Link> before publishing your first order. You can still save drafts.</p> : null}
          <CreateWizard {...{ step, setStep, title, setTitle, description, setDescription, amount, setAmount, multi, setMulti, milestones, setMilestones, deadline, setDeadline, reviewHours, setReviewHours, buyer, setBuyer, submitting, amountKobo, allocationValid, submitOrder }} />
        </>
      ) : null}
      {page === "order-detail" && data.order ? <OrderDetail order={data.order} onChange={(o) => setData({ ...data, order: o })} /> : null}
      {page === "invoices" && data.invoices ? <InvoiceList invoices={data.invoices} /> : null}
      {page === "receipts" && data.receipts ? <ReceiptList receipts={data.receipts} /> : null}
      {page === "income" && data.income ? <Income data={data.income} /> : null}
      {page === "trust" && data.trust ? <Trust data={data.trust} /> : null}
      {page === "payout-account" && data.me && data.banks ? <PayoutAccountForm key={data.me.payoutAccount?.accountNumber ?? "new"} account={data.me.payoutAccount} banks={data.banks} onSave={saveAccount} /> : null}
      {page === "notifications" && data.notifications ? <Notifications items={data.notifications} refresh={refresh} /> : null}
      {page === "settings" && data.me ? <SettingsPage me={data.me} onSaved={refresh} /> : null}
    </>
  );
}
