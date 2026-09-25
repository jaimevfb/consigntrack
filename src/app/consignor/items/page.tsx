import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getItems } from "@/lib/items-data";
import { ItemsList } from "@/components/items-list";
import { CreateItemForm, type StoreOption } from "@/components/create-item-form";
import type { Agreement } from "@/lib/types";

export default async function ConsignorItemsPage() {
  await requireProfile();
  const supabase = createClient();
  const [items, { data: agreements }] = await Promise.all([
    getItems(),
    supabase.from("agreements").select("*, stores(name)").eq("is_active", true),
  ]);
  const stores: StoreOption[] = ((agreements ?? []) as Array<Agreement & { stores: { name: string } | null }>).map((a) => ({
    agreementId: a.id,
    storeId: a.store_id,
    name: a.stores?.name ?? "Store",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Tracked items</h1>
        <p className="text-sm text-muted-foreground">
          Serialized units with a signed QR and full chain-of-custody. Create one to issue its label.
        </p>
      </div>
      <CreateItemForm stores={stores} />
      <ItemsList items={items} basePath="/consignor/items" party="consignor" />
    </div>
  );
}
