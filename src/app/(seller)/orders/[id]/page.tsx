import { SellerPage } from "@/components/seller/seller-page";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SellerPage page="order-detail" orderId={id} />;
}
