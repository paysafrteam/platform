import { AdminPage } from "@/components/admin/admin-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPage page="order-detail" recordId={id} />;
}
