import { calcFee } from "@/lib/domain/rules";
import type {
  AppStore,
  Dispute,
  LedgerEntry,
  Milestone,
  Order,
  Seller,
} from "@/lib/domain/types";

const now = Date.now();
const hoursFromNow = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
const daysFromNow = (days: number) => hoursFromNow(days * 24);

const sellers: Seller[] = [
  {
    id: "seller-tolu",
    name: "Tolu A.",
    email: "tolu@example.test",
    phone: "+2348000000101",
    businessName: "Tolu Studio",
    trustScore: 78,
    trustLevel: "trusted",
    status: "active",
    completedOrders: 24,
    payoutAccount: {
      bankCode: "044",
      bankName: "Access Bank",
      accountNumber: "0000000000",
      accountName: "Tolu A. (Demo)",
      verified: true,
    },
  },
  {
    id: "seller-zara",
    name: "Zara K.",
    email: "zara@example.test",
    phone: "+2348000000102",
    businessName: "Zara Streetwear",
    trustScore: 52,
    trustLevel: "rising",
    status: "active",
    completedOrders: 9,
  },
  {
    id: "seller-ife",
    name: "Ife D.",
    email: "ife@example.test",
    phone: "+2348000000103",
    businessName: "Ife Web Works",
    trustScore: null,
    trustLevel: "new",
    status: "active",
    completedOrders: 0,
  },
];

function milestone(
  id: string,
  position: number,
  title: string,
  amountKobo: number,
  status: Milestone["status"],
): Milestone {
  const delivered = status === "delivered" || status === "disputed";
  return {
    id,
    position,
    title,
    amountKobo,
    status,
    ...(delivered
      ? {
          deliveredAt: hoursFromNow(-20),
          releaseAt: hoursFromNow(52),
          proof: {
            kind: "note",
            content: "The first logo concepts are ready. Please review the attached direction.",
          },
        }
      : {}),
  };
}

function order(
  token: string,
  status: Order["status"],
  seller: Seller,
  overrides: Partial<Order> = {},
): Order {
  const totalKobo = overrides.totalKobo ?? 15_000_000;
  const common: Order = {
    id: `ord-${token.replace("demo-", "")}`,
    token,
    seller,
    title: "Logo design for Zuri",
    description:
      "A fresh visual identity for a small fashion label. Includes two logo directions, a final mark, and social-ready exports for the launch.",
    totalKobo,
    currency: "NGN",
    buyerContact: { email: "buyer@example.test" },
    orderAccount: {
      bankName: "Access Bank",
      accountNumber: "0000000000",
      accountName: "PaySafr Demo Collection",
      expiresAt: hoursFromNow(48),
    },
    status,
    deliveryDeadline: daysFromNow(7),
    reviewWindowHours: 72,
    feeKobo: calcFee(totalKobo),
    amountFundedKobo: status === "awaiting_payment" || status === "draft" ? 0 : totalKobo,
    milestones: [milestone("mile-full", 1, "Logo design", totalKobo, "pending")],
    createdAt: hoursFromNow(-4),
    expiresAt: hoursFromNow(48),
    ...overrides,
  };
  return common;
}

const demoOrders: Order[] = [
  order("demo-awaiting", "awaiting_payment", sellers[0]!),
  order("demo-partial", "awaiting_payment", sellers[0]!, { amountFundedKobo: 10_000_000 }),
  order("demo-funded", "funded", sellers[0]!),
  order("demo-milestones", "funded", sellers[0]!, {
    totalKobo: 15_000_000,
    milestones: [
      milestone("mile-concept", 1, "Concept approval", 7_500_000, "delivered"),
      milestone("mile-final", 2, "Final files", 7_500_000, "pending"),
    ],
  }),
  order("demo-delivered", "funded", sellers[0]!, {
    milestones: [milestone("mile-delivered", 1, "Final files", 15_000_000, "delivered")],
  }),
  order("demo-disputed", "funded", sellers[0]!, {
    milestones: [milestone("mile-disputed", 1, "Final files", 15_000_000, "disputed")],
  }),
  order("demo-released", "completed", sellers[0]!, {
    completedAt: hoursFromNow(-4),
    milestones: [milestone("mile-released", 1, "Final files", 15_000_000, "released")],
  }),
  order("demo-refunded", "completed", sellers[0]!, {
    milestones: [milestone("mile-refunded", 1, "Final files", 15_000_000, "refunded")],
  }),
  order("demo-expired", "expired", sellers[1]!, { expiresAt: hoursFromNow(-4) }),
  order("demo-cancelled", "cancelled", sellers[1]!),
  order("demo-overpaid", "funded", sellers[0]!, {
    overpaidKobo: 500_000,
    amountFundedKobo: 15_000_000,
  }),
  order("demo-shoes", "awaiting_payment", sellers[1]!, {
    title: "Everyday trainers, size 42",
    description: "A pair of charcoal everyday trainers from Zara Streetwear.",
    totalKobo: 4_500_000,
    amountFundedKobo: 0,
    milestones: [milestone("mile-shoes", 1, "Trainer delivery", 4_500_000, "pending")],
  }),
];

const demoDispute: Dispute = {
  id: "DSP-2048",
  orderId: demoOrders.find((item) => item.token === "demo-disputed")!.id,
  milestoneId: "mile-disputed",
  openedBy: "buyer",
  reason: "not_as_described",
  note: "The delivered files do not match the approved direction. I have added the agreed brief.",
  status: "awaiting_response",
  responseDueAt: hoursFromNow(32),
  openedAt: hoursFromNow(-16),
  evidence: [
    {
      id: "evi-1",
      submittedBy: "buyer",
      type: "text",
      content: "The colour direction differs from the reference we approved.",
      createdAt: hoursFromNow(-16),
    },
    {
      id: "evi-2",
      submittedBy: "seller",
      type: "link",
      content: "https://example.test/brief-reference",
      createdAt: hoursFromNow(-12),
    },
  ],
};

const ledger: LedgerEntry[] = [
  {
    id: "led-1",
    orderId: demoOrders[2]!.id,
    type: "funding",
    amountKobo: 15_000_000,
    pagaReference: "MOCK-PG-10001",
    createdAt: hoursFromNow(-3),
  },
  {
    id: "led-2",
    orderId: demoOrders[6]!.id,
    type: "release",
    amountKobo: 15_000_000,
    pagaReference: "MOCK-PG-10002",
    createdAt: hoursFromNow(-4),
  },
  {
    id: "led-3",
    orderId: demoOrders[6]!.id,
    type: "fee",
    amountKobo: -calcFee(15_000_000),
    pagaReference: "MOCK-PG-FEE-10002",
    createdAt: hoursFromNow(-4),
  },
];

export function createSeedStore(): AppStore {
  return {
    orders: structuredClone(demoOrders),
    disputes: [structuredClone(demoDispute)],
    ledger: structuredClone(ledger),
    payouts: [
      {
        id: "pay-1",
        orderId: demoOrders[6]!.id,
        milestoneId: "mile-released",
        amountKobo: 14_700_000,
        status: "paid",
        pagaReference: "MOCK-PG-10002",
        attempts: 1,
      },
      {
        id: "pay-2",
        orderId: demoOrders[4]!.id,
        milestoneId: "mile-delivered",
        amountKobo: 14_700_000,
        status: "failed",
        pagaReference: "MOCK-PG-FAIL-20001",
        attempts: 2,
      },
    ],
    receipts: demoOrders
      .filter((item) => ["funded", "completed"].includes(item.status))
      .map((item, index) => ({
        id: `receipt-${item.id}`,
        number: `PS-2026-${String(123 + index).padStart(6, "0")}`,
        type: item.status === "completed" ? "completion" : "payment",
        orderId: item.id,
        issuedAt: item.completedAt ?? item.createdAt,
      })),
    auditLog: [
      {
        id: "audit-1",
        actor: "Admin Demo",
        action: "Reviewed seller profile",
        target: sellers[0]!.id,
        before: "new",
        after: "active",
        createdAt: hoursFromNow(-20),
      },
    ],
    notifications: [
      {
        id: "notice-1",
        type: "funded",
        title: "Payment received",
        message: "Money is held safely for Logo design for Zuri.",
        orderId: demoOrders[2]!.id,
        read: false,
        createdAt: hoursFromNow(-3),
      },
      {
        id: "notice-2",
        type: "delivered",
        title: "A delivery needs review",
        message: "Final files are ready for you to review.",
        orderId: demoOrders[4]!.id,
        read: false,
        createdAt: hoursFromNow(-1),
      },
    ],
  };
}

export function getSeedSeller(id: string): Seller | undefined {
  return sellers.find((seller) => seller.id === id);
}

export function seedOrders(): Order[] {
  return structuredClone(demoOrders);
}
