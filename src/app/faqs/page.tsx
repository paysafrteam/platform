import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { faqs } from "@/content/faqs";
export const metadata: Metadata = { title: "FAQs", description: "Answers about PaySafr payments, delivery, seller accounts and disputes." };
export default function Page() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) };
  return <><script type="application/ld+json">{JSON.stringify(jsonLd)}</script><MarketingPage kind="faqs" eyebrow="FAQs" title="You have questions. We have answers." description="Plain-language answers for buyers and sellers using the PaySafr demo." /></>;
}
