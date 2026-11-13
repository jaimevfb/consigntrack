import Link from "next/link";
import { ScanLine } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStorePackages } from "@/lib/ledger-data";
import { ReceivingPanel, type AwaitingPackage, type HistoryRow } from "@/components/receiving-panel";
import { DisputeResolver, type DisputedPackage } from "@/components/dispute-resolver";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Deliveries & Receiving" };

export default async function StoreDeliveriesPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const supabase = createClient();

  const [{ data: awaitingRaw }, { data: openRaw }, { data: holdRaw }, history] = await Promise.all([
    supabase
      .from("packages")
      .select("id, pkg_code, consignors(name), package_lines(id, qty_expected, products(sku, name))")
      .eq("consignee_id", profile.store_id).eq("status", "IN_TRANSIT").eq("direction", "OUTBOUND")
      .order("in_transit_at", { ascending: true }),
    // Any SKU still in dispute (v_in_dispute nets HOLD vs RELEASE), regardless of
    // the originating package's current status — so legacy/partial disputes surface.
    supabase.from("v_in_dispute").select("sku_id, qty").eq("consignee_id", profile.store_id),
    // Trace each dispute back to the package that raised it (latest hold wins).
    supabase.from("ledger_entries").select("sku_id, ref_id, reason, created_at")
      .eq("consignee_id", profile.store_id).eq("entry_type", "DISPUTE_HOLD").eq("ref_type", "package")
      .order("created_at", { ascending: false }),
    getStorePackages(profile.store_id),
  ]);

  const open = ((openRaw ?? []) as { sku_id: string; qty: number }[]).filter((d) => d.qty > 0);
  const latestPkg = new Map<string, string>();
  const itemsForSku = new Map<string, string | null>();
  for (const h of ((holdRaw ?? []) as { sku_id: string; ref_id: string | null; reason: string | null }[])) {
    if (!latestPkg.has(h.sku_id)) {
      if (h.ref_id) latestPkg.set(h.sku_id, h.ref_id);
      const m = h.reason?.match(/scanned:\s*(.+)$/i);
      itemsForSku.set(h.sku_id, m ? m[1] : null);
    }
  }

  let disputed: DisputedPackage[] = [];
  if (open.length > 0) {
    const skuIds = open.map((d) => d.sku_id);
    const pkgIds = [...new Set(open.map((d) => latestPkg.get(d.sku_id)).filter(Boolean) as string[])];
    type PkgRow = { id: string; pkg_code: string; consignors: { name: string } | null; package_lines: { sku_id: string; dispute_photo_url: string | null }[] };
    const [{ data: prods }, pkgRes] = await Promise.all([
      supabase.from("products").select("id, sku, name").in("id", skuIds),
      pkgIds.length
        ? supabase.from("packages").select("id, pkg_code, consignors(name), package_lines(sku_id, dispute_photo_url)").in("id", pkgIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);
    const prodById = new Map(((prods ?? []) as { id: string; sku: string; name: string }[]).map((p) => [p.id, p]));
    const pkgById = new Map(((pkgRes.data ?? []) as unknown as PkgRow[]).map((p) => [p.id, p]));
    const byPkg = new Map<string, DisputedPackage>();
    for (const d of open) {
      const pkgId = latestPkg.get(d.sku_id);
      if (!pkgId) continue; // only disputes traceable to a package can be resolved
      const pk = pkgById.get(pkgId);
      if (!byPkg.has(pkgId)) byPkg.set(pkgId, { id: pkgId, pkg_code: pk?.pkg_code ?? "Package", consignor_name: pk?.consignors?.name ?? "—", lines: [] });
      const prod = prodById.get(d.sku_id);
      const photo = pk?.package_lines.find((l) => l.sku_id === d.sku_id)?.dispute_photo_url ?? null;
      byPkg.get(pkgId)!.lines.push({ sku_id: d.sku_id, sku: prod?.sku ?? "—", name: prod?.name ?? "—", qty_disputed: d.qty, photo, items: itemsForSku.get(d.sku_id) ?? null });
    }
    disputed = [...byPkg.values()];
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Deliveries &amp; Receiving</h1>
        </div>
        <Button asChild><Link href="/scan"><ScanLine className="h-4 w-4" /> Scan a package</Link></Button>
      </div>
      <DisputeResolver packages={disputed} />
      <ReceivingPanel awaiting={awaiting} history={historyRows} />
    </div>
  );
}
