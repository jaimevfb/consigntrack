import { createClient } from "@/lib/supabase/server";
import { phDateKey, phMonthDay } from "@/lib/utils";

export interface SaleRecord {
  at: string; source: string | null; units: number; total: number; flagged: boolean;
  lines: { name: string; sku: string; qty: number; unit_price: number; total: number }[];
}

/** Recent sales for a store, reconstructed from SALE ledger entries grouped by transaction time. */
export async function getStoreSales(storeId: string, limit = 25): Promise<SaleRecord[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("ledger_entries")
    .select("qty, unit_price, price_flag, reason, created_at, products(sku, name, unit_price)")
    .eq("consignee_id", storeId)
    .eq("entry_type", "SALE")
    .order("created_at", { ascending: false })
    .limit(400);
  const rows = (data ?? []) as unknown as Array<{
    qty: number; unit_price: number | null; price_flag: boolean | null; reason: string | null; created_at: string;
    products: { sku: string; name: string; unit_price: number | null } | null;
  }>;
  const sales = new Map<string, SaleRecord>();
  for (const r of rows) {
    const key = r.created_at; // lines of one sale share the transaction timestamp
    const qty = -r.qty; // SALE qty is stored negative
    const price = r.unit_price ?? r.products?.unit_price ?? 0; // fall back to catalog price
    const line = { name: r.products?.name ?? "—", sku: r.products?.sku ?? "—", qty, unit_price: price, total: qty * price };
    const s = sales.get(key);
    if (s) { s.lines.push(line); s.units += qty; s.total += line.total; s.flagged = s.flagged || !!r.price_flag; }
    else sales.set(key, { at: r.created_at, source: r.reason, units: qty, total: line.total, flagged: !!r.price_flag, lines: [line] });
  }
  return [...sales.values()].slice(0, limit);
}

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
  category: string;
  photo_url: string | null;
}

/** All on-hand/in-dispute for a store, joined to catalog + agreement commission. */
export async function getStoreInventory(storeId: string): Promise<InventoryRow[]> {
  const supabase = createClient();
  const [{ data: onHand }, { data: inDispute }, { data: products }, { data: agreements }] = await Promise.all([
    supabase.from("v_on_hand").select("sku_id, qty").eq("consignee_id", storeId),
    supabase.from("v_in_dispute").select("sku_id, qty").eq("consignee_id", storeId),
    supabase.from("products").select("id, sku, name, unit_of_measure, unit_price, consignor_id, status, category, photo_url, consignors(name)"),
    supabase.from("agreements").select("consignor_id, commission_pct").eq("store_id", storeId).eq("is_active", true),
  ]);

  const onHandBy = new Map((onHand ?? []).map((r: { sku_id: string; qty: number }) => [r.sku_id, r.qty]));
  const dispBy = new Map((inDispute ?? []).map((r: { sku_id: string; qty: number }) => [r.sku_id, r.qty]));
  const commBy = new Map(((agreements ?? []) as { consignor_id: string; commission_pct: number }[]).map((a) => [a.consignor_id, a.commission_pct]));

  const rows: InventoryRow[] = [];
  for (const p of (products ?? []) as unknown as Array<{
    id: string; sku: string; name: string; unit_of_measure: string; unit_price: number;
    consignor_id: string; status: string; category: string | null; photo_url: string | null; consignors: { name: string } | null;
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
      on_hand: on, in_dispute: disp, category: p.category ?? "Other", photo_url: p.photo_url ?? null,
    });
  }
  return rows.sort((a, b) => a.consignor_name.localeCompare(b.consignor_name) || a.name.localeCompare(b.name));
}

export interface PackageRow {
  id: string; pkg_code: string; qr_token: string; direction: string; status: string;
  consignor_name: string; units: number; created_at: string; in_transit_at: string | null; updated_at: string;
}

/** Packages inbound to this store (optionally only IN_TRANSIT). */
export async function getStorePackages(storeId: string, opts?: { direction?: string; status?: string }): Promise<PackageRow[]> {
  const supabase = createClient();
  let q = supabase
    .from("packages")
    .select("id, pkg_code, qr_token, direction, status, created_at, in_transit_at, updated_at, consignors(name), package_lines(qty_expected, qty_received)")
    .eq("consignee_id", storeId)
    .order("updated_at", { ascending: false });
  if (opts?.direction) q = q.eq("direction", opts.direction);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return ((data ?? []) as unknown as Array<{
    id: string; pkg_code: string; qr_token: string; direction: string; status: string; created_at: string;
    in_transit_at: string | null; updated_at: string; consignors: { name: string } | null;
    package_lines: { qty_expected: number; qty_received: number | null }[];
  }>).map((p) => ({
    id: p.id, pkg_code: p.pkg_code, qr_token: p.qr_token, direction: p.direction, status: p.status,
    consignor_name: p.consignors?.name ?? "—",
    units: p.package_lines.reduce((a, l) => a + (l.qty_received ?? l.qty_expected ?? 0), 0),
    created_at: p.created_at, in_transit_at: p.in_transit_at, updated_at: p.updated_at,
  }));
}

export interface PackageDetail {
  id: string; pkg_code: string; qr_token: string; direction: string; status: string; consignor_id: string; consignee_id: string; consignor_name: string; store_name: string;
  liability: string;
  created_at: string; in_transit_at: string | null; updated_at: string; settled_at: string | null;
  lines: { id: string; sku_id: string; sku: string; name: string; qty_expected: number; qty_received: number | null; qty_disputed: number }[];
  events: { entry_type: string; qty: number; created_at: string; reason: string | null }[];
}

export async function getPackageDetail(packageId: string): Promise<PackageDetail | null> {
  const supabase = createClient();
  const { data: pkg } = await supabase
    .from("packages")
    .select("id, pkg_code, qr_token, direction, status, consignor_id, consignee_id, created_at, in_transit_at, updated_at, settled_at, consignors(name), stores(name), package_lines(id, sku_id, qty_expected, qty_received, qty_disputed, products(sku, name))")
    .eq("id", packageId).maybeSingle();
  if (!pkg) return null;
  const p = pkg as unknown as {
    id: string; pkg_code: string; qr_token: string; direction: string; status: string; consignor_id: string; consignee_id: string;
    created_at: string; in_transit_at: string | null; updated_at: string; settled_at: string | null;
    consignors: { name: string } | null; stores: { name: string } | null;
    package_lines: Array<{ id: string; sku_id: string; qty_expected: number; qty_received: number | null; qty_disputed: number; products: { sku: string; name: string } | null }>;
  };
  const [{ data: events }, { data: agr }] = await Promise.all([
    supabase.from("ledger_entries").select("entry_type, qty, created_at, reason")
      .eq("ref_type", "package").eq("ref_id", packageId).order("created_at", { ascending: true }),
    supabase.from("agreements").select("damage_liability").eq("consignor_id", p.consignor_id).eq("store_id", p.consignee_id).maybeSingle(),
  ]);
  return {
    id: p.id, pkg_code: p.pkg_code, qr_token: p.qr_token, direction: p.direction, status: p.status,
    consignor_id: p.consignor_id, consignee_id: p.consignee_id, consignor_name: p.consignors?.name ?? "—", store_name: p.stores?.name ?? "—",
    liability: (agr as { damage_liability: string } | null)?.damage_liability ?? "shared",
    created_at: p.created_at, in_transit_at: p.in_transit_at, updated_at: p.updated_at, settled_at: p.settled_at,
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
  // Sales rows and commission rates are independent — fetch in parallel (no waterfall).
  const [{ data }, { data: agr }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("sku_id, qty, unit_price, created_at, products(sku, name, consignor_id)")
      .eq("consignee_id", storeId).eq("entry_type", "SALE")
      .gte("created_at", since.toISOString()),
    supabase.from("agreements").select("consignor_id, commission_pct").eq("store_id", storeId).eq("is_active", true),
  ]);

  const rows = ((data ?? []) as unknown as Array<{
    sku_id: string; qty: number; unit_price: number | null; created_at: string;
    products: { sku: string; name: string; consignor_id: string } | null;
  }>);

  const commRate = new Map(((agr ?? []) as { consignor_id: string; commission_pct: number }[]).map((a) => [a.consignor_id, a.commission_pct]));

  let gross30 = 0, units30 = 0, commission30 = 0;
  const byDay = new Map<string, number>();
  const bySku = new Map<string, { sku: string; name: string; qty: number; gross: number }>();
  for (const r of rows) {
    const q = -r.qty;
    const amt = q * (r.unit_price ?? 0);
    gross30 += amt; units30 += q;
    commission30 += amt * ((commRate.get(r.products?.consignor_id ?? "") ?? 0) / 100);
    const day = phDateKey(r.created_at);
    byDay.set(day, (byDay.get(day) ?? 0) + amt);
    const key = r.sku_id;
    const cur = bySku.get(key) ?? { sku: r.products?.sku ?? "—", name: r.products?.name ?? "—", qty: 0, gross: 0 };
    cur.qty += q; cur.gross += amt; bySku.set(key, cur);
  }

  // last 14 days series
  const series: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    series.push({ label: phMonthDay(d), value: Math.round(byDay.get(phDateKey(d)) ?? 0) });
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
  settlementsDue: { consignor_name: string; period_end: string; net_payable: number; status: string }[];
}

export async function getStoreDashboardLedger(storeId: string): Promise<StoreDashboardLedger> {
  const supabase = createClient();
  const [inv, sales, { count: incoming }, { data: settlements }] = await Promise.all([
    getStoreInventory(storeId),
    getStoreSalesAnalytics(storeId),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("consignee_id", storeId).eq("status", "IN_TRANSIT"),
    supabase.from("settlements").select("net_payable, status, period_end, agreements!inner(store_id, consignors(name))").eq("agreements.store_id", storeId).neq("status", "confirmed").order("period_end", { ascending: true }),
  ]);
  const activeUnits = inv.reduce((a, r) => a + r.on_hand, 0);
  const activeValue = inv.reduce((a, r) => a + r.on_hand * r.unit_price, 0);
  const rows = ((settlements ?? []) as unknown as Array<{ net_payable: number; status: string; period_end: string; agreements: { consignors: { name: string } | null } | null }>);
  const settlementsDueAmount = rows.reduce((a, s) => a + Number(s.net_payable), 0);
  const rank = (s: string) => (s === "pending" ? 0 : s === "paid" ? 1 : 2);
  const settlementsDue = rows
    .map((s) => ({ consignor_name: s.agreements?.consignors?.name ?? "—", period_end: s.period_end, net_payable: Number(s.net_payable), status: s.status }))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.period_end.localeCompare(b.period_end))
    .slice(0, 6);
  return {
    activeUnits, activeValue: Math.round(activeValue),
    incoming: incoming ?? 0,
    gross30: sales.gross30, commission30: sales.commission30, settlementsDueAmount: Math.round(settlementsDueAmount), settlementsDue,
  };
}
