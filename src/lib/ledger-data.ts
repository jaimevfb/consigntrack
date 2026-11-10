import { createClient } from "@/lib/supabase/server";

/** One inventory row for a store: on-hand + in-dispute, with catalog + terms. */
export interface InventoryRow {
  sku_id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  unit_price: number;
  consignor_id: string;
  consignor_name: string;
  commission_pct: number;
  on_hand: number;
  in_dispute: number;
}

/** All on-hand/in-dispute for a store, joined to catalog + agreement commission. */
export async function getStoreInventory(storeId: string): Promise<InventoryRow[]> {
  const supabase = createClient();
  const [{ data: onHand }, { data: inDispute }, { data: products }, { data: agreements }] = await Promise.all([
    supabase.from("v_on_hand").select("sku_id, qty").eq("consignee_id", storeId),
    supabase.from("v_in_dispute").select("sku_id, qty").eq("consignee_id", storeId),
    supabase.from("products").select("id, sku, name, unit_of_measure, unit_price, consignor_id, status, consignors(name)"),
    supabase.from("agreements").select("consignor_id, commission_pct").eq("store_id", storeId).eq("is_active", true),
  ]);

  const onHandBy = new Map((onHand ?? []).map((r: { sku_id: string; qty: number }) => [r.sku_id, r.qty]));
  const dispBy = new Map((inDispute ?? []).map((r: { sku_id: string; qty: number }) => [r.sku_id, r.qty]));
  const commBy = new Map(((agreements ?? []) as { consignor_id: string; commission_pct: number }[]).map((a) => [a.consignor_id, a.commission_pct]));

  const rows: InventoryRow[] = [];
  for (const p of (products ?? []) as unknown as Array<{
    id: string; sku: string; name: string; unit_of_measure: string; unit_price: number;
    consignor_id: string; status: string; consignors: { name: string } | null;
  }>) {
    const on = onHandBy.get(p.id) ?? 0;
    const disp = dispBy.get(p.id) ?? 0;
    // Show agreed SKUs that are active or still carry stock/dispute.
    if (!commBy.has(p.consignor_id)) continue;
    if (p.status === "archived" && on === 0 && disp === 0) continue;
    rows.push({
      sku_id: p.id, sku: p.sku, name: p.name, unit_of_measure: p.unit_of_measure,
      unit_price: p.unit_price, consignor_id: p.consignor_id,
      consignor_name: p.consignors?.name ?? "—", commission_pct: commBy.get(p.consignor_id) ?? 0,
      on_hand: on, in_dispute: disp,
    });
  }
  return rows.sort((a, b) => a.consignor_name.localeCompare(b.consignor_name) || a.name.localeCompare(b.name));
}

export interface PackageRow {
  id: string; pkg_code: string; direction: string; status: string;
  consignor_name: string; units: number; created_at: string; in_transit_at: string | null; updated_at: string;
}

/** Packages inbound to this store (optionally only IN_TRANSIT). */
export async function getStorePackages(storeId: string, opts?: { direction?: string; status?: string }): Promise<PackageRow[]> {
  const supabase = createClient();
  let q = supabase
    .from("packages")
    .select("id, pkg_code, direction, status, created_at, in_transit_at, updated_at, consignors(name), package_lines(qty_expected, qty_received)")
    .eq("consignee_id", storeId)
    .order("updated_at", { ascending: false });
  if (opts?.direction) q = q.eq("direction", opts.direction);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return ((data ?? []) as unknown as Array<{
    id: string; pkg_code: string; direction: string; status: string; created_at: string;
    in_transit_at: string | null; updated_at: string; consignors: { name: string } | null;
    package_lines: { qty_expected: number; qty_received: number | null }[];
  }>).map((p) => ({
    id: p.id, pkg_code: p.pkg_code, direction: p.direction, status: p.status,
    consignor_name: p.consignors?.name ?? "—",
    units: p.package_lines.reduce((a, l) => a + (l.qty_received ?? l.qty_expected ?? 0), 0),
    created_at: p.created_at, in_transit_at: p.in_transit_at, updated_at: p.updated_at,
  }));
}

export interface PackageDetail {
  id: string; pkg_code: string; direction: string; status: string; consignor_id: string; consignor_name: string;
  lines: { id: string; sku_id: string; sku: string; name: string; qty_expected: number; qty_received: number | null; qty_disputed: number }[];
  events: { entry_type: string; qty: number; created_at: string; reason: string | null }[];
}

export async function getPackageDetail(packageId: string): Promise<PackageDetail | null> {
  const supabase = createClient();
  const { data: pkg } = await supabase
    .from("packages")
    .select("id, pkg_code, direction, status, consignor_id, consignors(name), package_lines(id, sku_id, qty_expected, qty_received, qty_disputed, products(sku, name))")
    .eq("id", packageId).maybeSingle();
  if (!pkg) return null;
  const p = pkg as unknown as {
    id: string; pkg_code: string; direction: string; status: string; consignor_id: string;
    consignors: { name: string } | null;
    package_lines: Array<{ id: string; sku_id: string; qty_expected: number; qty_received: number | null; qty_disputed: number; products: { sku: string; name: string } | null }>;
  };
  const { data: events } = await supabase
    .from("ledger_entries").select("entry_type, qty, created_at, reason")
    .eq("ref_type", "package").eq("ref_id", packageId).order("created_at", { ascending: true });
  return {
    id: p.id, pkg_code: p.pkg_code, direction: p.direction, status: p.status,
    consignor_id: p.consignor_id, consignor_name: p.consignors?.name ?? "—",
    lines: p.package_lines.map((l) => ({
      id: l.id, sku_id: l.sku_id, sku: l.products?.sku ?? "—", name: l.products?.name ?? "—",
      qty_expected: l.qty_expected, qty_received: l.qty_received, qty_disputed: l.qty_disputed,
    })),
    events: (events ?? []) as PackageDetail["events"],
  };
}

export interface StoreSalesAnalytics {
  gross30: number;
  units30: number;
  commission30: number;
  series: { label: string; value: number }[];
  topSkus: { sku: string; name: string; qty: number; gross: number }[];
}

/** Sales analytics for a store, strictly from SALE ledger entries. */
export async function getStoreSalesAnalytics(storeId: string): Promise<StoreSalesAnalytics> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data } = await supabase
    .from("ledger_entries")
    .select("sku_id, qty, unit_price, created_at, products(sku, name, consignor_id)")
    .eq("consignee_id", storeId).eq("entry_type", "SALE")
    .gte("created_at", since.toISOString());

  const rows = ((data ?? []) as unknown as Array<{
    sku_id: string; qty: number; unit_price: number | null; created_at: string;
    products: { sku: string; name: string; consignor_id: string } | null;
  }>);

  // commission rates per consignor
  const { data: agr } = await supabase.from("agreements").select("consignor_id, commission_pct").eq("store_id", storeId).eq("is_active", true);
  const commRate = new Map(((agr ?? []) as { consignor_id: string; commission_pct: number }[]).map((a) => [a.consignor_id, a.commission_pct]));

  let gross30 = 0, units30 = 0, commission30 = 0;
  const byDay = new Map<string, number>();
  const bySku = new Map<string, { sku: string; name: string; qty: number; gross: number }>();
  for (const r of rows) {
    const q = -r.qty;
    const amt = q * (r.unit_price ?? 0);
    gross30 += amt; units30 += q;
    commission30 += amt * ((commRate.get(r.products?.consignor_id ?? "") ?? 0) / 100);
    const day = r.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + amt);
    const key = r.sku_id;
    const cur = bySku.get(key) ?? { sku: r.products?.sku ?? "—", name: r.products?.name ?? "—", qty: 0, gross: 0 };
    cur.qty += q; cur.gross += amt; bySku.set(key, cur);
  }

  // last 14 days series
  const series: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: Math.round(byDay.get(key) ?? 0) });
  }
  const topSkus = [...bySku.values()].filter((s) => s.qty > 0).sort((a, b) => b.gross - a.gross).slice(0, 5);
  return { gross30: Math.round(gross30), units30, commission30: Math.round(commission30), series, topSkus };
}

export interface StoreDashboardLedger {
  activeUnits: number;
  activeValue: number;
  incoming: number;
  gross30: number;
  commission30: number;
  settlementsDueAmount: number;
}

export async function getStoreDashboardLedger(storeId: string): Promise<StoreDashboardLedger> {
  const supabase = createClient();
  const [inv, sales, { count: incoming }, { data: settlements }] = await Promise.all([
    getStoreInventory(storeId),
    getStoreSalesAnalytics(storeId),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("consignee_id", storeId).eq("status", "IN_TRANSIT"),
    supabase.from("settlements").select("net_payable, status, agreements!inner(store_id)").eq("agreements.store_id", storeId).neq("status", "confirmed"),
  ]);
  const activeUnits = inv.reduce((a, r) => a + r.on_hand, 0);
  const activeValue = inv.reduce((a, r) => a + r.on_hand * r.unit_price, 0);
  const settlementsDueAmount = ((settlements ?? []) as { net_payable: number }[]).reduce((a, s) => a + Number(s.net_payable), 0);
  return {
    activeUnits, activeValue: Math.round(activeValue),
    incoming: incoming ?? 0,
    gross30: sales.gross30, commission30: sales.commission30, settlementsDueAmount: Math.round(settlementsDueAmount),
  };
}
