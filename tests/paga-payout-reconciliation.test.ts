import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  q: vi.fn(),
  q1: vi.fn(),
  withTx: vi.fn(),
  writeAudit: vi.fn(),
  getPagaTransactionStatus: vi.fn(),
  initiatePayout: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  q: mocks.q,
  q1: mocks.q1,
  withTx: mocks.withTx,
}));

vi.mock("@/server/payments/paga", () => ({
  getPagaTransactionStatus: mocks.getPagaTransactionStatus,
  pagaProvider: { initiatePayout: mocks.initiatePayout },
}));

vi.mock("@/server/audit", () => ({
  writeAudit: mocks.writeAudit,
}));

import { reconcilePagaPayout } from "@/server/services/paga-payout-reconciliation";

describe("Paga payout code 135 reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.withTx.mockImplementation(async (callback) => callback({ query: vi.fn() }, () => undefined));
  });

  it("resubmits once with the same reference and saved destination", async () => {
    mocks.getPagaTransactionStatus.mockResolvedValue({ responseCode: "135" });
    mocks.q1
      .mockResolvedValueOnce({
        id: "payout-id",
        amount_kobo: 500_000,
        status: "pending",
        attempts: 1,
        paga_same_ref_retry_used: false,
        paga_destination_bank_code: "bank-uuid",
        paga_destination_account_number: "0123456789",
        paga_destination_account_name: "Seller Name",
      })
      .mockResolvedValueOnce({
        id: "payout-id",
        amount_kobo: 500_000,
        status: "pending",
        attempts: 2,
        paga_same_ref_retry_used: true,
        paga_destination_bank_code: "bank-uuid",
        paga_destination_account_number: "0123456789",
        paga_destination_account_name: "Seller Name",
      })
      .mockResolvedValueOnce(null);
    mocks.initiatePayout.mockResolvedValue({ status: "processing", reference: "payout-ref" });

    await expect(reconcilePagaPayout("payout-ref")).resolves.toBe("pending");
    await expect(reconcilePagaPayout("payout-ref")).resolves.toBe("unknown");

    expect(mocks.initiatePayout).toHaveBeenCalledTimes(1);
    expect(mocks.initiatePayout).toHaveBeenCalledWith({
      payoutId: "payout-ref",
      amountKobo: 500_000,
      bankCode: "bank-uuid",
      accountNumber: "0123456789",
      accountName: "Seller Name",
    });
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "paga.payout_same_reference_retry",
      targetId: "payout-id",
      after: expect.objectContaining({ referenceNumber: "payout-ref", sameReferenceRetryUsed: true }),
    }));
  });
});
