import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStorePackages } from "@/lib/ledger-data";
import { ReceivingPanel, type AwaitingPackage, type HistoryRow } from "@/components/receiving-panel";

export const metadata = { title: "Deliveries & Receiving" };

export default async function StoreDeliveriesPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const supabase = createClient();

  const [{ data: awaitingRaw }, history] = await Promise.all([
    supabase
      .from("packages")
      .select("id, pkg_code, consignors(name), package_lines(id, qty_expected, products(sku, name))")
      .eq("consignee_id", profile.store_id).eq("status", "IN_TRANSIT").eq("direction", "OUTBOUND")
      .order("in_transit_at", { ascending: true }),
    getStorePackages(profile.store_id),
  ]);

  const awaiting: AwaitingPackage[] = ((awaitingRaw ?? []) as unknown as Array<{
    id: string; pkg_code: string; consignors: { name: string } | null;
    package_lines: Array<{ id: string; qty_expected: number; products: { sku: string; name: string } | null }>;
  }>).map((p) => ({
    id: p.id, pkg_code: p.pkg_code, consignor_name: p.consignors?.name ?? "—",
    units: p.package_lines.reduce((a, l) => a + l.qty_expected, 0),
    lines: p.package_lines.map((l) => ({ line_id: l.id, sku: l.products?.sku ?? "—", name: l.products?.name ?? "—", qty_expected: l.qty_expected })),
  }));

  const historyRows: HistoryRow[] = history.map((p) => ({
    id: p.id, pkg_code: p.pkg_code, consignor_name: p.consignor_name, units: p.units, status: p.status, updated_at: p.updated_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Deliveries &amp; Receiving</h1>
        <p className="text-sm text-muted-foreground">Confirm incoming packages at the dock — one scan moves every SKU inside the box.</p>
      </div>
      <ReceivingPanel awaiting={awaiting} history={historyRows} />
    </div>
  );
}
