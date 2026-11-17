import "server-only";

export interface CollectionAccount { bankName: string; accountNumber: string; accountName: string; expiresAt: Date }
export interface PayoutResult { status: "paid" | "failed" | "processing"; reference: string; error?: string }

/** Everything that talks to a payment rail lives behind this interface. Nothing else calls Paga. */
export interface PaymentProvider {
  readonly name: string;
  createCollectionAccount(input: { orderId: string; amountKobo: number; reference: string; expiresAt: Date }): Promise<CollectionAccount>;
  initiatePayout(input: { payoutId: string; amountKobo: number; bankCode: string; accountNumber: string; accountName: string }): Promise<PayoutResult>;
  initiateRefund(input: { payoutId: string; amountKobo: number; orderId: string }): Promise<PayoutResult>;
}
