import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShipmentBuilder, type StoreOption, type BuilderSku, type ShipmentRow } from "@/components/shipment-builder";
import { InboundReturns, type InboundReturn } from "@/components/inbound-returns";

export const metadata = { title: "Shipments" };

export default async function ConsignorShipmentsPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const supabase = createClient();

  const [{ data: agreements }, { data: products }, { data: packages }, { data: returnsRaw }] = await Promise.all([
    supabase.from("agreements").select("store_id, stores(name)").eq("consignor_id", profile.consignor_id).eq("is_active", true),
    supabase.from("products").select("id, sku, name, unit_price, status").eq("consignor_id", profile.consignor_id).eq("status", "active").order("name"),
    supabase.from("packages")
      .select("id, pkg_code, qr_token, status, updated_at, stores(name), package_lines(qty_expected, products(unit_price))")
      .eq("consignor_id", profile.consignor_id).eq("direction", "OUTBOUND").order("updated_at", { ascending: false }),
    supabase.from("packages")
      .select("id, pkg_code, stores(name), package_lines(id, qty_expected, products(sku, name))")
      .eq("consignor_id", profile.consignor_id).eq("direction", "RETURN").eq("status", "RETURN_IN_TRANSIT").order("updated_at", { ascending: false }),
  ]);

  const inboundReturns: InboundReturn[] = ((returnsRaw ?? []) as unknown as Array<{
    id: string; pkg_code: string; stores: { name: string } | null;
    package_lines: Array<{ id: string; qty_expected: number; products: { sku: string; name: string } | null }>;
  }>).map((p) => ({
    id: p.id, pkg_code: p.pkg_code, store_name: p.stores?.name ?? "—",
    units: p.package_lines.reduce((a, l) => a + l.qty_expected, 0),
    lines: p.package_lines.map((l) => ({ line_id: l.id, sku: l.products?.sku ?? "—", name: l.products?.name ?? "—", qty_expected: l.qty_expected })),
  }));

  const stores: StoreOption[] = ((agreements ?? []) as unknown as Array<{ store_id: string; stores: { name: string } | null }>)
    .map((a) => ({ id: a.store_id, name: a.stores?.name ?? "—" }));
  const { data: avail } = await supabase.rpc("available_to_pack", { p_consignor: profile.consignor_id });
  const availMap = new Map<string, number>(((avail ?? []) as { sku_id: string; available: number }[]).map((a) => [a.sku_id, a.available]));
  const skus: BuilderSku[] = ((products ?? []) as { id: string; sku: string; name: string; unit_price: number }[])
    .map((p) => ({ sku_id: p.id, sku: p.sku, name: p.name, unit_price: p.unit_price, available: Math.max(0, availMap.get(p.id) ?? 0) }));
  const history: ShipmentRow[] = ((packages ?? []) as unknown as Array<{
    id: string; pkg_code: string; qr_token: string; status: string; updated_at: string; stores: { name: string } | null;
    package_lines: Array<{ qty_expected: number; products: { unit_price: number } | null }>;
  }>).map((p) => ({
    id: p.id, pkg_code: p.pkg_code, qr_token: p.qr_token, store_name: p.stores?.name ?? "—", status: p.status, updated_at: p.updated_at,
    units: p.package_lines.reduce((a, l) => a + l.qty_expected, 0),
    value: p.package_lines.reduce((a, l) => a + l.qty_expected * (l.products?.unit_price ?? 0), 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Shipments</h1>
      </div>
      <InboundReturns returns={inboundReturns} />
      <ShipmentBuilder consignorId={profile.consignor_id} stores={stores} skus={skus} history={history} />
    </div>
  );
}
