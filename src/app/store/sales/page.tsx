import { requireProfile } from "@/lib/auth";
import { getStoreInventory } from "@/lib/ledger-data";
import { SalesTerminal, type SellableSku } from "@/components/sales-terminal";

export const metadata = { title: "Sales" };

export default async function StoreSalesPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const inv = await getStoreInventory(profile.store_id);
  const skus: SellableSku[] = inv
    .filter((r) => r.on_hand > 0)
    .map((r) => ({ sku_id: r.sku_id, sku: r.sku, name: r.name, unit_price: r.unit_price, on_hand: r.on_hand, consignor_name: r.consignor_name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Sales</h1>
      </div>
      <SalesTerminal storeId={profile.store_id} skus={skus} />
    </div>
  );
}
