import { requireProfile } from "@/lib/auth";
import { getItems } from "@/lib/items-data";
import { ItemsList } from "@/components/items-list";

export default async function AdminItemsPage() {
  await requireProfile();
  const items = await getItems();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">All tracked items</h1>
        <p className="text-sm text-muted-foreground">Every serialized unit across all consignors and stores.</p>
      </div>
      <ItemsList items={items} basePath="/store/items" party="both" />
    </div>
  );
}
