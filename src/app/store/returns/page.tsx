import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getStoreInventory, getStorePackages } from "@/lib/ledger-data";
import { ReturnBuilder, type ReturnConsignor, type ReturnPkg } from "@/components/return-builder";

export const metadata = { title: "Returns" };

export default async function StoreReturnsPage() {
  const { profile } = await requireProfile();
  if (profile.role === "store_staff") redirect("/store"); // [ACC-07] managers only
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;

  const [inv, pkgs] = await Promise.all([
    getStoreInventory(profile.store_id),
    getStorePackages(profile.store_id, { direction: "RETURN" }),
  ]);

  const byConsignor = new Map<string, ReturnConsignor>();
  for (const r of inv.filter((x) => x.on_hand > 0)) {
    if (!byConsignor.has(r.consignor_id)) byConsignor.set(r.consignor_id, { consignor_id: r.consignor_id, consignor_name: r.consignor_name, skus: [] });
    byConsignor.get(r.consignor_id)!.skus.push({ sku_id: r.sku_id, sku: r.sku, name: r.name, on_hand: r.on_hand });
  }
  const existing: ReturnPkg[] = pkgs.map((p) => ({ id: p.id, pkg_code: p.pkg_code, qr_token: p.qr_token, consignor_name: p.consignor_name, units: p.units, status: p.status, updated_at: p.updated_at }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Returns</h1>
      </div>
      <ReturnBuilder storeId={profile.store_id} consignors={[...byConsignor.values()]} existing={existing} />
    </div>
  );
}
