export type FaqCategory = "Everyone" | "Buyers" | "Sellers" | "Money" | "Disputes";

export const faqs: { question: string; answer: string; category: FaqCategory }[] = [
  {
    question: "What is PaySafr?",
    answer:
      "PaySafr helps buyers and sellers complete a deal with confidence. The buyer pays into a protected order, and the seller is paid when the work or product is delivered and confirmed.",
    category: "Everyone",
  },
  {
    question: "Do I need an account to pay?",
    answer: "No. Buyers can open a payment link and pay by bank transfer. An account is optional.",
    category: "Buyers",
  },
  {
    question: "How does the buyer pay?",
    answer: "Transfer the exact amount shown on the payment page from any Nigerian bank or wallet.",
    category: "Buyers",
  },
  {
    question: "When does the seller get paid?",
    answer:
      "When the buyer confirms delivery, or automatically when the review window ends with no dispute. The default review window is 72 hours.",
    category: "Sellers",
  },
  {
    question: "What if the seller never delivers?",
    answer:
      "Open a dispute before the review window ends. The money stays on hold until it is settled. If the delivery deadline passes, you can ask for a refund.",
    category: "Disputes",
  },
  {
    question: "What if the buyer goes quiet after delivery?",
    answer:
      "The money is released to the seller automatically when the review window ends, as long as no dispute is open. The buyer is reminded before release.",
    category: "Sellers",
  },
  {
    question: "What happens when there is a dispute?",
    answer:
      "The money is held while both sides share evidence. A PaySafr admin reviews the information and records a written decision to release, refund, or split the amount.",
    category: "Disputes",
  },
  {
    question: "How much does PaySafr cost?",
    answer:
      "A fee is calculated automatically from the order amount and deducted from the seller's payout when funds are released. The buyer pays the agreed order amount.",
    category: "Money",
  },
  {
    question: "Is my money safe?",
    answer:
      "Money is held before work starts, then released only when you confirm or when the review window ends without a dispute. A payment counts only after bank confirmation.",
    category: "Money",
  },
  {
    question: "What if I pay too little or too much?",
    answer:
      "An underpaid order stays open and shows the remaining balance. An overpayment is flagged for a refund unless the seller agrees to credit the extra.",
    category: "Money",
  },
  {
    question: "What is the seller trust score?",
    answer:
      "It reflects a seller's completed orders, delivery history, dispute rate, response time, and experience. New sellers are shown as “New seller”, never as a zero.",
    category: "Sellers",
  },
  {
    question: "Can I get a receipt?",
    answer: "Yes. A payment receipt is available after a payment is verified.",
    category: "Everyone",
  },
];
