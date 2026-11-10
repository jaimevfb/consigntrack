import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShipmentBuilder, type StoreOption, type BuilderSku, type ShipmentRow } from "@/components/shipment-builder";

export const metadata = { title: "Shipments" };

export default async function ConsignorShipmentsPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const supabase = createClient();

  const [{ data: agreements }, { data: products }, { data: packages }] = await Promise.all([
    supabase.from("agreements").select("store_id, stores(name)").eq("consignor_id", profile.consignor_id).eq("is_active", true),
    supabase.from("products").select("id, sku, name, unit_price, status").eq("consignor_id", profile.consignor_id).eq("status", "active").order("name"),
    supabase.from("packages")
      .select("id, pkg_code, status, updated_at, stores(name), package_lines(qty_expected, products(unit_price))")
      .eq("consignor_id", profile.consignor_id).eq("direction", "OUTBOUND").order("updated_at", { ascending: false }),
  ]);

  const stores: StoreOption[] = ((agreements ?? []) as unknown as Array<{ store_id: string; stores: { name: string } | null }>)
    .map((a) => ({ id: a.store_id, name: a.stores?.name ?? "—" }));
  const skus: BuilderSku[] = ((products ?? []) as { id: string; sku: string; name: string; unit_price: number }[])
    .map((p) => ({ sku_id: p.id, sku: p.sku, name: p.name, unit_price: p.unit_price }));
  const history: ShipmentRow[] = ((packages ?? []) as unknown as Array<{
    id: string; pkg_code: string; status: string; updated_at: string; stores: { name: string } | null;
    package_lines: Array<{ qty_expected: number; products: { unit_price: number } | null }>;
  }>).map((p) => ({
    id: p.id, pkg_code: p.pkg_code, store_name: p.stores?.name ?? "—", status: p.status, updated_at: p.updated_at,
    units: p.package_lines.reduce((a, l) => a + l.qty_expected, 0),
    value: p.package_lines.reduce((a, l) => a + l.qty_expected * (l.products?.unit_price ?? 0), 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Shipments</h1>
        <p className="text-sm text-muted-foreground">Build a package for a store, print its QR, and dispatch it. One scan at the dock moves every SKU inside.</p>
      </div>
      <ShipmentBuilder consignorId={profile.consignor_id} stores={stores} skus={skus} history={history} />
    </div>
  );
}
