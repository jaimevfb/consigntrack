import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getItemById } from "@/lib/items-data";
import { ItemDetailView } from "@/components/item-detail-view";
import { availableActions } from "@/lib/item-flow";

export default async function StoreItemPage({ params }: { params: { id: string } }) {
  const { profile } = await requireProfile();
  const detail = await getItemById(params.id);
  if (!detail) notFound();
  const perspective = profile.role === "admin" ? "admin" : "consignee";
  return (
    <ItemDetailView
      detail={detail}
      actions={availableActions(perspective, detail.item.status)}
      canDispute
      showQr={false}
      backHref="/store/items"
    />
  );
}
