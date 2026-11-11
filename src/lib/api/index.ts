import { nigerianBanks } from "@/content/nigerian-banks";
import { calcFee, calcSellerReceives } from "@/lib/domain/rules";
import type {
  Dispute,
  DisputeOutcome,
  DisputeReason,
  Evidence,
  Order,
  Payout,
  PayoutAccount,
  Proof,
} from "@/lib/domain/types";
import { apiRequest } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import {
  findOrderById,
  findOrderByToken,
  getStore,
  resetStore,
  updateStore,
} from "@/lib/mocks/store";

function request<T>(
  id: keyof typeof ENDPOINTS,
  resolver: () => T | Promise<T>,
  options: { body?: unknown; path?: string; delayMs?: number } = {},
) {
  return apiRequest<T>({ endpoint: ENDPOINTS[id], resolver, ...options });
}

/** BACKEND TODO: GET /api/pay/:token. Mock: src/lib/mocks/store.ts */
export function getPayOrder(token: string): Promise<Order | undefined> {
  return request("getPayOrder", () => findOrderByToken(token), {
    path: `/api/pay/${encodeURIComponent(token)}`,
  });
}

export interface CheckPaymentResult {
  status: "funded" | "awaiting_payment";
  order: Order;
}

/** BACKEND TODO: POST /api/pay/:token/check-payment. Only verified provider notifications confirm real payment. */
export function checkPayment(token: string): Promise<CheckPaymentResult> {
  return request(
    "checkPayment",
    () =>
      updateStore((store) => {
        const order = store.orders.find((item) => item.token === token);
        if (!order) throw new Error("We couldn't find this payment link.");
        if (order.amountFundedKobo < order.totalKobo) {
          order.amountFundedKobo = order.totalKobo;
          order.status = "funded";
          store.ledger.push({
            id: `led-${Date.now()}`,
            orderId: order.id,
            type: "funding",
            amountKobo: order.totalKobo,
            pagaReference: `MOCK-PG-${Date.now()}`,
            createdAt: new Date().toISOString(),
          });
          store.receipts.push({
            id: `receipt-${order.id}-${Date.now()}`,
            number: `PS-2026-${String(500000 + store.receipts.length).padStart(6, "0")}`,
            type: "payment",
            orderId: order.id,
            issuedAt: new Date().toISOString(),
          });
        }
        return {
          status: order.status === "funded" ? "funded" : "awaiting_payment",
          order,
        };
      }),
    {
      body: {},
      path: `/api/pay/${encodeURIComponent(token)}/check-payment`,
      delayMs: 1800,
    },
  );
}

/** BACKEND TODO: POST /api/pay/:token/milestones/:mid/confirm. Mock: src/lib/mocks/store.ts */
export function confirmMilestone(
  token: string,
  milestoneId: string,
): Promise<Order> {
  return request(
    "confirmMilestone",
    () =>
      updateStore((store) => {
        const order = store.orders.find((item) => item.token === token);
        const milestone = order?.milestones.find(
          (item) => item.id === milestoneId,
        );
        if (!order || !milestone || milestone.status !== "delivered") {
          throw new Error(
            "This delivery is no longer waiting for confirmation.",
          );
        }
        milestone.status = "released";
        const fee = calcFee(milestone.amountKobo, order.totalKobo);
        store.ledger.push(
          {
            id: `led-${Date.now()}-release`,
            orderId: order.id,
            milestoneId,
            type: "release",
            amountKobo: calcSellerReceives(
              milestone.amountKobo,
              order.totalKobo,
            ),
            pagaReference: `MOCK-RELEASE-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
          {
            id: `led-${Date.now()}-fee`,
            orderId: order.id,
            milestoneId,
            type: "fee",
            amountKobo: fee,
            pagaReference: `MOCK-FEE-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
        );
        if (
          order.milestones.every((item) =>
            ["released", "refunded"].includes(item.status),
          )
        ) {
          order.status = "completed";
          order.completedAt = new Date().toISOString();
        }
        return order;
      }),
    {
      body: {},
      path: `/api/pay/${encodeURIComponent(token)}/milestones/${encodeURIComponent(milestoneId)}/confirm`,
    },
  );
}

/** BACKEND TODO: POST /api/pay/:token/milestones/:mid/request-changes. Mock: src/lib/mocks/store.ts */
export function requestChanges(
  token: string,
  milestoneId: string,
  note: string,
): Promise<{ sent: true }> {
  return request(
    "requestChanges",
    () => {
      if (!note.trim())
        throw new Error("Add a short note so the seller knows what to update.");
      const order = findOrderByToken(token);
      if (
        !order?.milestones.some(
          (item) => item.id === milestoneId && item.status === "delivered",
        )
      ) {
        throw new Error("This delivery is not waiting for a change request.");
      }
      return { sent: true as const };
    },
    {
      body: { note },
      path: `/api/pay/${encodeURIComponent(token)}/milestones/${encodeURIComponent(milestoneId)}/request-changes`,
    },
  );
}

export interface OpenDisputeInput {
  token: string;
  milestoneId: string;
  reason: DisputeReason;
  note: string;
  evidence?: Evidence[];
}

/** BACKEND TODO: POST /api/pay/:token/dispute. Mock: src/lib/mocks/store.ts */
export function openDispute(input: OpenDisputeInput): Promise<Dispute> {
  return request(
    "openDispute",
    () =>
      updateStore((store) => {
        const order = store.orders.find((item) => item.token === input.token);
        const milestone = order?.milestones.find(
          (item) => item.id === input.milestoneId,
        );
        if (
          !order ||
          !milestone ||
          milestone.status !== "delivered" ||
          !milestone.releaseAt ||
          new Date(milestone.releaseAt).getTime() <= Date.now()
        ) {
          throw new Error(
            "A dispute can only be opened while a delivery is under review.",
          );
        }
        const dispute: Dispute = {
          id: `DSP-${Date.now()}`,
          orderId: order.id,
          milestoneId: milestone.id,
          openedBy: "buyer",
          reason: input.reason,
          note: input.note,
          status: "awaiting_response",
          responseDueAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
          openedAt: new Date().toISOString(),
          evidence: input.evidence ?? [],
        };
        milestone.status = "disputed";
        store.disputes.push(dispute);
        return dispute;
      }),
    {
      body: input,
      path: `/api/pay/${encodeURIComponent(input.token)}/dispute`,
    },
  );
}

/** BACKEND TODO: POST /api/pay/:token/contact. Mock: local session only. */
export function contactSeller(
  token: string,
  contact: { email?: string; phone?: string },
) {
  return request(
    "contactSeller",
    () => {
      if (!findOrderByToken(token))
        throw new Error("We couldn't find this payment link.");
      return { saved: true };
    },
    { body: contact, path: `/api/pay/${encodeURIComponent(token)}/contact` },
  );
}

/** BACKEND TODO: GET /api/pay/:token/receipt. Mock: src/lib/mocks/store.ts */
export function getBuyerReceipt(token: string) {
  return request(
    "getBuyerReceipt",
    () => {
      const order = findOrderByToken(token);
      if (!order) throw new Error("We couldn't find this payment link.");
      const receipt = getStore().receipts.find(
        (item) => item.orderId === order.id,
      );
      return { order, receipt };
    },
    { path: `/api/pay/${encodeURIComponent(token)}/receipt` },
  );
}

export function getPublicReceipt(number: string) {
  return request(
    "getPublicReceipt",
    () => {
      const receipt = getStore().receipts.find(
        (item) => item.number === number,
      );
      const order = receipt && findOrderById(receipt.orderId);
      return receipt && order ? { receipt, order } : undefined;
    },
    { path: `/api/receipts/${encodeURIComponent(number)}` },
  );
}

export interface CreateOrderInput {
  title: string;
  description: string;
  totalKobo: number;
  reviewWindowHours: number;
  deliveryDeadline: string;
  milestones: { title: string; amountKobo: number }[];
  buyerContact?: { email?: string; phone?: string };
  publish: boolean;
}

/** BACKEND TODO: POST /api/orders. Mock: src/lib/mocks/store.ts */
export function createOrder(input: CreateOrderInput): Promise<Order> {
  return request(
    "createOrder",
    () =>
      updateStore((store) => {
        if (!Number.isSafeInteger(input.totalKobo) || input.totalKobo < 1) {
          throw new Error("Enter an order amount greater than zero.");
        }
        const id = `ord-${Date.now()}`;
        const now = new Date();
        const seller = {
          id: "seller-tolu",
          name: "Tolu A.",
          email: "tolu@example.test",
          phone: "+2348000000101",
          businessName: "Tolu Studio",
          trustScore: 78,
          trustLevel: "trusted" as const,
          status: "active" as const,
          completedOrders: 24,
          payoutAccount: {
            bankCode: "044",
            bankName: "Access Bank",
            accountNumber: "0000000000",
            accountName: "Tolu A. (Demo)",
            verified: true,
          },
        };
        const total = input.milestones.reduce(
          (sum, item) => sum + item.amountKobo,
          0,
        );
        if (total !== input.totalKobo)
          throw new Error("Milestone amounts must match the order total.");
        const order: Order = {
          id,
          token: `demo-${Date.now().toString(36)}`,
          seller,
          title: input.title,
          description: input.description,
          totalKobo: input.totalKobo,
          currency: "NGN",
          ...(input.buyerContact ? { buyerContact: input.buyerContact } : {}),
          orderAccount: {
            bankName: "Access Bank",
            accountNumber: "0000000000",
            accountName: "PaySafr Demo Collection",
            expiresAt: new Date(now.getTime() + 48 * 3_600_000).toISOString(),
          },
          status: input.publish ? "awaiting_payment" : "draft",
          deliveryDeadline: input.deliveryDeadline,
          reviewWindowHours: input.reviewWindowHours,
          feeKobo: calcFee(input.totalKobo),
          amountFundedKobo: 0,
          milestones: input.milestones.map((item, index) => ({
            id: `mile-${Date.now()}-${index}`,
            position: index + 1,
            title: item.title,
            amountKobo: item.amountKobo,
            status: "pending",
          })),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 48 * 3_600_000).toISOString(),
        };
        store.orders.unshift(order);
        return order;
      }),
    { body: input },
  );
}

/** BACKEND TODO: POST /api/orders/:id/cancel. Mock: src/lib/mocks/store.ts */
export function cancelOrder(id: string) {
  return request(
    "cancelOrder",
    () =>
      updateStore((store) => {
        const order = store.orders.find((item) => item.id === id);
        if (
          !order ||
          !["draft", "awaiting_payment"].includes(order.status) ||
          order.amountFundedKobo
        ) {
          throw new Error("Only an unpaid order can be cancelled.");
        }
        order.status = "cancelled";
        return order;
      }),
    { path: `/api/orders/${encodeURIComponent(id)}/cancel`, body: {} },
  );
}

/** BACKEND TODO: POST /api/orders/:id/milestones/:mid/deliver. Mock: src/lib/mocks/store.ts */
export function deliverMilestone(
  id: string,
  milestoneId: string,
  proof: Proof,
) {
  return request(
    "deliverMilestone",
    () =>
      updateStore((store) => {
        const order = store.orders.find((item) => item.id === id);
        const milestone = order?.milestones.find(
          (item) => item.id === milestoneId,
        );
        if (
          !order ||
          order.status !== "funded" ||
          !milestone ||
          milestone.status !== "pending"
        ) {
          throw new Error(
            "This milestone is not ready to be marked delivered.",
          );
        }
        milestone.status = "delivered";
        milestone.proof = proof;
        milestone.deliveredAt = new Date().toISOString();
        milestone.releaseAt = new Date(
          Date.now() + order.reviewWindowHours * 3_600_000,
        ).toISOString();
        return order;
      }),
    {
      path: `/api/orders/${encodeURIComponent(id)}/milestones/${encodeURIComponent(milestoneId)}/deliver`,
      body: proof,
    },
  );
}

/** BACKEND TODO: POST /api/admin/disputes/:id/resolve. Mock: src/lib/mocks/store.ts */
export function resolveDispute(
  id: string,
  decision: {
    outcome: DisputeOutcome;
    reason: string;
    splitToSellerKobo?: number;
  },
) {
  return request(
    "resolveDispute",
    () =>
      updateStore((store) => {
        const dispute = store.disputes.find((item) => item.id === id);
        if (!dispute) throw new Error("We couldn't find this dispute.");
        const order = store.orders.find((item) => item.id === dispute.orderId);
        const milestone = order?.milestones.find(
          (item) => item.id === dispute.milestoneId,
        );
        if (!order || !milestone)
          throw new Error("We couldn't find this dispute.");
        if (!decision.reason.trim())
          throw new Error("Add a written reason for this decision.");
        if (
          decision.outcome === "split" &&
          (!Number.isSafeInteger(decision.splitToSellerKobo) ||
            decision.splitToSellerKobo! < 0 ||
            decision.splitToSellerKobo! > milestone.amountKobo)
        ) {
          throw new Error(
            "The seller's share must be between zero and the milestone amount.",
          );
        }
        dispute.status = "resolved";
        dispute.outcome = decision.outcome;
        dispute.decisionReason = decision.reason;
        dispute.resolvedAt = new Date().toISOString();
        const now = new Date().toISOString();
        if (decision.outcome === "release_to_seller") {
          milestone.status = "released";
          store.ledger.push(
            {
              id: `led-${Date.now()}-release`,
              orderId: order.id,
              milestoneId: milestone.id,
              type: "release",
              amountKobo: calcSellerReceives(
                milestone.amountKobo,
                order.totalKobo,
              ),
              pagaReference: `MOCK-RELEASE-${Date.now()}`,
              createdAt: now,
            },
            {
              id: `led-${Date.now()}-fee`,
              orderId: order.id,
              milestoneId: milestone.id,
              type: "fee",
              amountKobo: calcFee(milestone.amountKobo, order.totalKobo),
              pagaReference: `MOCK-FEE-${Date.now()}`,
              createdAt: now,
            },
          );
        }
        if (decision.outcome === "refund_to_buyer") {
          milestone.status = "refunded";
          store.ledger.push({
            id: `led-${Date.now()}-refund`,
            orderId: order.id,
            milestoneId: milestone.id,
            type: "refund",
            amountKobo: milestone.amountKobo,
            pagaReference: `MOCK-REFUND-${Date.now()}`,
            createdAt: now,
          });
        }
        if (decision.outcome === "split") {
          dispute.splitToSellerKobo = decision.splitToSellerKobo ?? 0;
          milestone.status = "released";
          const sellerShare = decision.splitToSellerKobo ?? 0;
          const buyerShare = milestone.amountKobo - sellerShare;
          if (sellerShare > 0) {
            store.ledger.push(
              {
                id: `led-${Date.now()}-release`,
                orderId: order.id,
                milestoneId: milestone.id,
                type: "release",
                amountKobo:
                  sellerShare - calcFee(sellerShare, order.totalKobo),
                pagaReference: `MOCK-RELEASE-${Date.now()}`,
                createdAt: now,
              },
              {
                id: `led-${Date.now()}-fee`,
                orderId: order.id,
                milestoneId: milestone.id,
                type: "fee",
                amountKobo: calcFee(sellerShare, order.totalKobo),
                pagaReference: `MOCK-FEE-${Date.now()}`,
                createdAt: now,
              },
            );
          }
          if (buyerShare > 0)
            store.ledger.push({
              id: `led-${Date.now()}-refund`,
              orderId: order.id,
              milestoneId: milestone.id,
              type: "refund",
              amountKobo: buyerShare,
              pagaReference: `MOCK-REFUND-${Date.now()}`,
              createdAt: now,
            });
        }
        if (
          order.milestones.every((item) =>
            ["released", "refunded"].includes(item.status),
          )
        ) {
          order.status = "completed";
          order.completedAt = now;
        }
        store.auditLog.unshift({
          id: `audit-${Date.now()}`,
          actor: "Admin Demo",
          action: `Resolved dispute: ${decision.outcome}`,
          target: id,
          after: decision.reason,
          createdAt: new Date().toISOString(),
        });
        return dispute;
      }),
    {
      path: `/api/admin/disputes/${encodeURIComponent(id)}/resolve`,
      body: decision,
    },
  );
}

export function listOrders() {
  return request("listOrders", () => getStore().orders, {
    path: "/api/orders",
  });
}

export function getOrder(id: string) {
  return request("getOrder", () => findOrderById(id), {
    path: `/api/orders/${encodeURIComponent(id)}`,
  });
}

export function getAdminData() {
  const store = getStore();
  return store;
}

export function updatePayoutAccount(
  account: PayoutAccount,
): Promise<PayoutAccount> {
  return request(
    "updatePayoutAccount",
    () =>
      updateStore((store) => {
        if (!/^\d{10}$/.test(account.accountNumber))
          throw new Error("Enter a valid 10-digit account number.");
        const sellers = new Map(
          store.orders.map((order) => [order.seller.id, order.seller]),
        );
        const seller = sellers.get("seller-tolu");
        if (!seller) throw new Error("We couldn't load your seller profile.");
        seller.payoutAccount = { ...account, verified: true };
        return seller.payoutAccount;
      }),
    { body: account, path: "/api/me/payout-account" },
  );
}

export function markNotificationsRead(ids?: string[]): Promise<void> {
  return request(
    "readNotifications",
    () =>
      updateStore((store) => {
        for (const notification of store.notifications) {
          if (!ids || ids.includes(notification.id)) notification.read = true;
        }
      }),
    { body: { ids }, path: "/api/notifications/read" },
  );
}

export function retryPayout(id: string): Promise<Payout> {
  return request(
    "retryPayout",
    () =>
      updateStore((store) => {
        const payout = store.payouts.find((item) => item.id === id);
        if (!payout || payout.status !== "failed")
          throw new Error("Only a failed payout can be retried.");
        payout.status = "processing";
        payout.attempts += 1;
        store.auditLog.unshift({
          id: `audit-${Date.now()}`,
          actor: "Admin Demo",
          action: "Retried payout",
          target: id,
          before: "failed",
          after: "processing",
          createdAt: new Date().toISOString(),
        });
        return payout;
      }),
    { body: {}, path: `/api/admin/payouts/${encodeURIComponent(id)}/retry` },
  );
}

export function signIn(input: {
  email: string;
  password: string;
}): Promise<{ signedIn: true }> {
  return request(
    "signIn",
    () => {
      if (
        input.email.toLowerCase() !== "tolu@example.test" ||
        input.password !== "demo1234"
      ) {
        throw new Error(
          "Email or password is incorrect. Try the demo account shown below.",
        );
      }
      return { signedIn: true as const };
    },
    { body: input },
  );
}

export function signUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "freelancer" | "seller";
}): Promise<{ verificationSent: true }> {
  return request(
    "signUp",
    () => {
      if (
        !input.name.trim() ||
        !input.email.includes("@") ||
        input.password.length < 8
      ) {
        throw new Error("Check your details and try again.");
      }
      return { verificationSent: true as const };
    },
    { body: input },
  );
}

export function verifyEmail(code: string): Promise<{ verified: true }> {
  return request(
    "verifyEmail",
    () => {
      if (code !== "123456")
        throw new Error("That code did not match. Use 123456 in the demo.");
      return { verified: true as const };
    },
    { body: { code } },
  );
}

export function requestPasswordReset(email: string): Promise<{ sent: true }> {
  return request(
    "forgotPassword",
    () => {
      if (!email.includes("@")) throw new Error("Enter a valid email address.");
      return { sent: true as const };
    },
    { body: { email } },
  );
}

export function resetPassword(input: {
  code: string;
  password: string;
}): Promise<{ reset: true }> {
  return request(
    "resetPassword",
    () => {
      if (input.password.length < 8)
        throw new Error("Use at least 8 characters for your password.");
      return { reset: true as const };
    },
    { body: input },
  );
}

export function adminSignIn(input: {
  email: string;
  password: string;
}): Promise<{ signedIn: true }> {
  return request(
    "adminSignIn",
    () => {
      if (
        input.email.toLowerCase() !== "admin@paysafr.test" ||
        input.password !== "admin1234"
      ) {
        throw new Error(
          "Admin demo access only. Use the credentials shown on this page.",
        );
      }
      return { signedIn: true as const };
    },
    { body: input },
  );
}

export function listBanks() {
  return request("getBanks", () => nigerianBanks, { path: "/api/banks" });
}

export function resolveBankAccount(input: {
  bankCode: string;
  accountNumber: string;
}) {
  return request(
    "resolveBank",
    () => {
      if (!/^\d{10}$/.test(input.accountNumber))
        throw new Error("Enter a 10-digit account number.");
      return { accountName: "Tolu A. (Demo)", verified: true };
    },
    { body: input, path: "/api/banks/resolve" },
  );
}

export function getPlaceholderResult<T>(
  id: keyof typeof ENDPOINTS,
  value: T,
  path?: string,
) {
  return request(id, () => value, path ? { path } : {});
}

export function resetDemoStore() {
  return resetStore();
}
