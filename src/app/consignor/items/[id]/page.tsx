import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getItemById } from "@/lib/items-data";
import { ItemDetailView } from "@/components/item-detail-view";
import { availableActions } from "@/lib/item-flow";

export default async function ConsignorItemPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const detail = await getItemById(params.id);
  if (!detail) notFound();
  return (
    <ItemDetailView
      detail={detail}
      actions={availableActions("consignor", detail.item.status)}
      canDispute
      showQr
      backHref="/consignor/items"
    />
  );
}
