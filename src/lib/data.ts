import { createClient } from "@/lib/supabase/server";
import type {
  Agreement,
  Consignor,
  Delivery,
  Discrepancy,
  Product,
  Settlement,
  Store,
} from "@/lib/types";
import { isSettlementOverdue } from "@/lib/business";

/** First and last day of the current month as YYYY-MM-DD. */
export function currentMonthRange(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

type StockRow = {
  store_id: string;
  product_id: string;
  consignor_id: string;
  qty_on_hand: number;
  products: Pick<Product, "name" | "sku" | "unit_price"> | null;
  stores: Pick<Store, "name"> | null;
  consignors: Pick<Consignor, "name"> | null;
};

type SaleItemRow = {
  qty: number;
  unit_price: number;
  consignor_id: string;
  product_id: string;
  sales: { store_id: string; sold_at: string } | null;
  products: Pick<Product, "name"> | null;
};

// ---------------------------------------------------------------------------
// Discrepancies (BR9) — the anomaly feed, RLS-scoped to the caller.
// ---------------------------------------------------------------------------
export async function getDiscrepancies(): Promise<Discrepancy[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("find_discrepancies");
  if (error) return [];
  return (data ?? []) as Discrepancy[];
}

// ---------------------------------------------------------------------------
// Consignor dashboard
// ---------------------------------------------------------------------------
export interface ConsignorStoreRow {
  storeId: string;
  storeName: string;
  onHand: number;
  soldThisPeriod: number;
  owed: number;
  status: string;
}

export interface ConsignorDashboard {
  tiles: { onHand: number; soldValue: number; netOwed: number; overdue: number };
  stores: ConsignorStoreRow[];
  discrepancies: Discrepancy[];
  productNames: Record<string, string>;
  storeNames: Record<string, string>;
}

export async function getConsignorDashboard(consignorId: string): Promise<ConsignorDashboard> {
  const supabase = createClient();
  const { start, end } = currentMonthRange();

  const [{ data: stock }, { data: saleItems }, { data: settlements }, { data: agreements }, { data: stores }] =
    await Promise.all([
      supabase
        .from("stock_levels")
        .select("store_id, product_id, consignor_id, qty_on_hand, products(name, sku, unit_price), stores(name), consignors(name)")
        .eq("consignor_id", consignorId),
      supabase
        .from("sale_items")
        .select("qty, unit_price, consignor_id, product_id, sales!inner(store_id, sold_at)")
        .eq("consignor_id", consignorId)
        .gte("sales.sold_at", `${start}T00:00:00`)
        .lte("sales.sold_at", `${end}T23:59:59`),
      supabase
        .from("settlements")
        .select("*, agreements!inner(consignor_id, store_id)")
        .eq("agreements.consignor_id", consignorId),
      supabase.from("agreements").select("*").eq("consignor_id", consignorId).eq("is_active", true),
      supabase.from("stores").select("*"),
    ]);

  const stockRows = (stock ?? []) as unknown as StockRow[];
  const items = (saleItems ?? []) as unknown as SaleItemRow[];
  const setts = (settlements ?? []) as unknown as Settlement[];
  const agrs = (agreements ?? []) as Agreement[];
  const storeList = (stores ?? []) as Store[];
  const storeNameById = Object.fromEntries(storeList.map((s) => [s.id, s.name]));

  const onHand = stockRows.reduce((a, r) => a + r.qty_on_hand, 0);
  const soldValue = items.reduce((a, r) => a + r.qty * r.unit_price, 0);
  const netOwed = setts
    .filter((s) => s.status !== "confirmed")
    .reduce((a, s) => a + Number(s.net_payable), 0);
  const overdue = setts.filter((s) => isSettlementOverdue(s.period_end, s.status)).length;

  // Per-store aggregation
  const storeAgg = new Map<string, ConsignorStoreRow>();
  const ensure = (storeId: string): ConsignorStoreRow => {
    let row = storeAgg.get(storeId);
    if (!row) {
      row = {
        storeId,
        storeName: storeNameById[storeId] ?? "—",
        onHand: 0,
        soldThisPeriod: 0,
        owed: 0,
        status: "on track",
      };
      storeAgg.set(storeId, row);
    }
    return row;
  };
  agrs.forEach((a) => ensure(a.store_id));
  stockRows.forEach((r) => (ensure(r.store_id).onHand += r.qty_on_hand));
  items.forEach((r) => {
    if (r.sales) ensure(r.sales.store_id).soldThisPeriod += r.qty;
  });
  setts.forEach((s) => {
    const storeId = (s as unknown as { agreements?: { store_id: string } }).agreements?.store_id;
    if (!storeId) return;
    const row = ensure(storeId);
    if (s.status !== "confirmed") row.owed += Number(s.net_payable);
    if (isSettlementOverdue(s.period_end, s.status)) row.status = "overdue";
  });

  const productNames: Record<string, string> = {};
  stockRows.forEach((r) => {
    if (r.products) productNames[r.product_id] = r.products.name;
  });

  return {
    tiles: { onHand, soldValue, netOwed, overdue },
    stores: Array.from(storeAgg.values()).sort((a, b) => a.storeName.localeCompare(b.storeName)),
    discrepancies: await getDiscrepancies(),
    productNames,
    storeNames: storeNameById,
  };
}

// ---------------------------------------------------------------------------
// Store dashboard
// ---------------------------------------------------------------------------
export interface StoreConsignorRow {
  consignorId: string;
  consignorName: string;
  onHand: number;
  soldThisPeriod: number;
  owed: number;
  status: string;
}

export interface StoreDashboard {
  tiles: { consignors: number; onHand: number; salesToday: number; settlementsDue: number };
  consignors: StoreConsignorRow[];
  discrepancies: Discrepancy[];
}

export async function getStoreDashboard(storeId: string): Promise<StoreDashboard> {
  const supabase = createClient();
  const { start, end } = currentMonthRange();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data: stock }, { data: saleItems }, { data: settlements }, { data: agreements }] =
    await Promise.all([
      supabase
        .from("stock_levels")
        .select("store_id, product_id, consignor_id, qty_on_hand, consignors(name)")
        .eq("store_id", storeId),
      supabase
        .from("sale_items")
        .select("qty, unit_price, consignor_id, product_id, sales!inner(store_id, sold_at)")
        .eq("sales.store_id", storeId)
        .gte("sales.sold_at", `${start}T00:00:00`)
        .lte("sales.sold_at", `${end}T23:59:59`),
      supabase
        .from("settlements")
        .select("*, agreements!inner(consignor_id, store_id)")
        .eq("agreements.store_id", storeId),
      supabase
        .from("agreements")
        .select("*, consignors(name)")
        .eq("store_id", storeId)
        .eq("is_active", true),
    ]);

  const stockRows = (stock ?? []) as unknown as StockRow[];
  const items = (saleItems ?? []) as unknown as SaleItemRow[];
  const setts = (settlements ?? []) as unknown as (Settlement & { agreements?: { consignor_id: string } })[];
  const agrs = (agreements ?? []) as unknown as (Agreement & { consignors?: { name: string } })[];

  const onHand = stockRows.reduce((a, r) => a + r.qty_on_hand, 0);
  const salesToday = items.filter(
    (r) => r.sales && new Date(r.sales.sold_at) >= todayStart,
  ).reduce((a, r) => a + r.qty, 0);
  const settlementsDue = setts.filter((s) => s.status !== "confirmed").length;

  const agg = new Map<string, StoreConsignorRow>();
  const ensure = (cid: string, name?: string): StoreConsignorRow => {
    let row = agg.get(cid);
    if (!row) {
      row = { consignorId: cid, consignorName: name ?? "—", onHand: 0, soldThisPeriod: 0, owed: 0, status: "on track" };
      agg.set(cid, row);
    } else if (name && row.consignorName === "—") {
      row.consignorName = name;
    }
    return row;
  };
  agrs.forEach((a) => ensure(a.consignor_id, a.consignors?.name));
  stockRows.forEach((r) => {
    const row = ensure(r.consignor_id, r.consignors?.name);
    row.onHand += r.qty_on_hand;
  });
  items.forEach((r) => ensure(r.consignor_id).soldThisPeriod += r.qty);
  setts.forEach((s) => {
    const cid = s.agreements?.consignor_id;
    if (!cid) return;
    const row = ensure(cid);
    if (s.status !== "confirmed") row.owed += Number(s.net_payable);
    if (isSettlementOverdue(s.period_end, s.status)) row.status = "overdue";
  });

  return {
    tiles: { consignors: agg.size, onHand, salesToday, settlementsDue },
    consignors: Array.from(agg.values()).sort((a, b) => a.consignorName.localeCompare(b.consignorName)),
    discrepancies: await getDiscrepancies(),
  };
}

// ---------------------------------------------------------------------------
// Reports (per-product / per-store / per-consignor performance, all-time)
// ---------------------------------------------------------------------------
export interface PerfRow {
  id: string;
  name: string;
  qtySold: number;
  gross: number;
}

/** Consignor report: performance by product and by store (all sales). */
export async function getConsignorReport(consignorId: string): Promise<{
  byProduct: PerfRow[];
  byStore: PerfRow[];
}> {
  const supabase = createClient();
  const [{ data: items }, { data: stores }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("qty, unit_price, product_id, products(name), sales!inner(store_id)")
      .eq("consignor_id", consignorId),
    supabase.from("stores").select("id, name"),
  ]);
  const rows = (items ?? []) as unknown as SaleItemRow[];
  const storeName = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s.name]));

  const byProduct = new Map<string, PerfRow>();
  const byStore = new Map<string, PerfRow>();
  for (const r of rows) {
    const gross = r.qty * r.unit_price;
    const p = byProduct.get(r.product_id) ?? { id: r.product_id, name: r.products?.name ?? "—", qtySold: 0, gross: 0 };
    p.qtySold += r.qty;
    p.gross += gross;
    byProduct.set(r.product_id, p);
    const sid = r.sales?.store_id ?? "—";
    const s = byStore.get(sid) ?? { id: sid, name: storeName[sid] ?? "—", qtySold: 0, gross: 0 };
    s.qtySold += r.qty;
    s.gross += gross;
    byStore.set(sid, s);
  }
  const sort = (m: Map<string, PerfRow>) => Array.from(m.values()).sort((a, b) => b.gross - a.gross);
  return { byProduct: sort(byProduct), byStore: sort(byStore) };
}

/** Store report: performance by product and by consignor (all sales). */
export async function getStoreReport(storeId: string): Promise<{
  byProduct: PerfRow[];
  byConsignor: PerfRow[];
}> {
  const supabase = createClient();
  const [{ data: items }, { data: consignors }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("qty, unit_price, product_id, consignor_id, products(name), sales!inner(store_id)")
      .eq("sales.store_id", storeId),
    supabase.from("consignors").select("id, name"),
  ]);
  const rows = (items ?? []) as unknown as (SaleItemRow & { consignor_id: string })[];
  const consignorName = Object.fromEntries(((consignors ?? []) as Consignor[]).map((c) => [c.id, c.name]));

  const byProduct = new Map<string, PerfRow>();
  const byConsignor = new Map<string, PerfRow>();
  for (const r of rows) {
    const gross = r.qty * r.unit_price;
    const p = byProduct.get(r.product_id) ?? { id: r.product_id, name: r.products?.name ?? "—", qtySold: 0, gross: 0 };
    p.qtySold += r.qty;
    p.gross += gross;
    byProduct.set(r.product_id, p);
    const c = byConsignor.get(r.consignor_id) ?? { id: r.consignor_id, name: consignorName[r.consignor_id] ?? "—", qtySold: 0, gross: 0 };
    c.qtySold += r.qty;
    c.gross += gross;
    byConsignor.set(r.consignor_id, c);
  }
  const sort = (m: Map<string, PerfRow>) => Array.from(m.values()).sort((a, b) => b.gross - a.gross);
  return { byProduct: sort(byProduct), byConsignor: sort(byConsignor) };
}

// ---------------------------------------------------------------------------
// Analytics — daily series + mixes, per lens (RLS-scoped)
// ---------------------------------------------------------------------------
export interface DayPoint {
  label: string;
  value: number;
}

function lastNDates(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({
      key: d.toISOString().slice(0, 10),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
    });
  }
  return out;
}

export interface AnalyticsBundle {
  tiles: { gross30: number; units30: number; orders30: number; avgOrder: number };
  series: DayPoint[]; // last 14 days gross
  topProducts: PerfRow[];
  breakdown: PerfRow[]; // by store (consignor) or by consignor (store)
  mix: { label: string; value: number }[]; // gross split for donut
  windowLabel: string;
}

type WindowItem = {
  qty: number;
  unit_price: number;
  product_id: string;
  consignor_id?: string;
  products: { name: string } | null;
  sales: { store_id: string; sold_at: string; id?: string } | null;
};

function buildSeries(items: WindowItem[]): DayPoint[] {
  const days = lastNDates(14);
  const byDay = new Map(days.map((d) => [d.key, 0]));
  for (const it of items) {
    const key = it.sales?.sold_at?.slice(0, 10);
    if (key && byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + it.qty * it.unit_price);
  }
  return days.map((d) => ({ label: d.label, value: Math.round(byDay.get(d.key) ?? 0) }));
}

function tilesFrom(items: WindowItem[]) {
  const gross30 = items.reduce((a, r) => a + r.qty * r.unit_price, 0);
  const units30 = items.reduce((a, r) => a + r.qty, 0);
  const orders = new Set(items.map((r) => r.sales?.id ?? r.sales?.sold_at)).size;
  return {
    gross30: Math.round(gross30),
    units30,
    orders30: orders,
    avgOrder: orders ? Math.round(gross30 / orders) : 0,
  };
}

export async function getConsignorAnalytics(consignorId: string): Promise<AnalyticsBundle> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [{ data: win }, report, { data: stores }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("qty, unit_price, product_id, products(name), sales!inner(id, store_id, sold_at)")
      .eq("consignor_id", consignorId)
      .gte("sales.sold_at", since.toISOString()),
    getConsignorReport(consignorId),
    supabase.from("stores").select("id, name"),
  ]);
  const items = (win ?? []) as unknown as WindowItem[];
  const storeName = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s.name]));
  const mix = report.byStore.slice(0, 5).map((s) => ({ label: storeName[s.id] ?? s.name, value: Math.round(s.gross) }));
  return {
    tiles: tilesFrom(items),
    series: buildSeries(items),
    topProducts: report.byProduct.slice(0, 6),
    breakdown: report.byStore,
    mix,
    windowLabel: "Last 30 days",
  };
}

export async function getStoreAnalytics(storeId: string): Promise<AnalyticsBundle> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [{ data: win }, report] = await Promise.all([
    supabase
      .from("sale_items")
      .select("qty, unit_price, product_id, consignor_id, products(name), sales!inner(id, store_id, sold_at)")
      .eq("sales.store_id", storeId)
      .gte("sales.sold_at", since.toISOString()),
    getStoreReport(storeId),
  ]);
  const items = (win ?? []) as unknown as WindowItem[];
  const mix = report.byConsignor.slice(0, 5).map((c) => ({ label: c.name, value: Math.round(c.gross) }));
  return {
    tiles: tilesFrom(items),
    series: buildSeries(items),
    topProducts: report.byProduct.slice(0, 6),
    breakdown: report.byConsignor,
    mix,
    windowLabel: "Last 30 days",
  };
}

export interface AdminAnalytics {
  series: DayPoint[];
  gmv30: number;
  units30: number;
  movements: number;
}

/** System-wide analytics for admin (sees all rows via RLS is_admin). */
export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [{ data: win }, { count: movements }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("qty, unit_price, product_id, sales!inner(id, store_id, sold_at)")
      .gte("sales.sold_at", since.toISOString()),
    supabase.from("stock_movements").select("*", { count: "exact", head: true }),
  ]);
  const items = (win ?? []) as unknown as WindowItem[];
  return {
    series: buildSeries(items),
    gmv30: Math.round(items.reduce((a, r) => a + r.qty * r.unit_price, 0)),
    units30: items.reduce((a, r) => a + r.qty, 0),
    movements: movements ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Alerts (paper SOP#5) — aged stock, low stock, discrepancies, overdue pay
// ---------------------------------------------------------------------------
export interface AlertItem {
  kind: "aged" | "low" | "shrinkage" | "overdue";
  title: string;
  detail: string;
  when?: string;
}

export interface AlertsBundle {
  counts: { aged: number; low: number; discrepancies: number; overdue: number };
  items: AlertItem[];
}

async function nameMaps() {
  const supabase = createClient();
  const [{ data: p }, { data: s }, { data: c }] = await Promise.all([
    supabase.from("products").select("id, name"),
    supabase.from("stores").select("id, name"),
    supabase.from("consignors").select("id, name"),
  ]);
  return {
    product: Object.fromEntries(((p ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
    store: Object.fromEntries(((s ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
    consignor: Object.fromEntries(((c ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
  };
}

export async function getAlerts(): Promise<AlertsBundle> {
  const supabase = createClient();
  const names = await nameMaps();
  const [{ data: aged }, { data: low }, disc, { data: setts }] = await Promise.all([
    supabase.rpc("find_aged_stock", { p_days: 30 }),
    supabase.rpc("find_low_stock", { p_threshold: 5 }),
    getDiscrepancies(),
    supabase.from("settlements").select("id, period_end, status, net_payable, agreements!inner(store_id, consignor_id)"),
  ]);

  const agedRows = (aged ?? []) as Array<{ store_id: string; product_id: string; qty_on_hand: number; days_idle: number | null }>;
  const lowRows = (low ?? []) as Array<{ store_id: string; product_id: string; qty_on_hand: number }>;
  const overdue = ((setts ?? []) as unknown as Array<{ period_end: string; status: string; net_payable: number; agreements: { store_id: string; consignor_id: string } }>).filter(
    (s) => isSettlementOverdue(s.period_end, s.status),
  );

  const items: AlertItem[] = [];
  for (const a of agedRows.slice(0, 8)) {
    items.push({
      kind: "aged",
      title: `${names.product[a.product_id] ?? "Product"} · ${names.store[a.store_id] ?? "Store"}`,
      detail: `${a.qty_on_hand} on hand, no sale in ${a.days_idle ?? "30+"} days`,
    });
  }
  for (const l of lowRows.slice(0, 8)) {
    items.push({
      kind: "low",
      title: `${names.product[l.product_id] ?? "Product"} · ${names.store[l.store_id] ?? "Store"}`,
      detail: `Only ${l.qty_on_hand} left on hand`,
    });
  }
  for (const d of disc.slice(0, 8)) {
    items.push({
      kind: "shrinkage",
      title: `${names.product[d.product_id] ?? "Product"} · ${names.store[d.store_id] ?? "Store"}`,
      detail: d.detail,
      when: d.occurred_at,
    });
  }
  for (const o of overdue.slice(0, 8)) {
    items.push({
      kind: "overdue",
      title: `${names.consignor[o.agreements.consignor_id] ?? "Consignor"} · ${names.store[o.agreements.store_id] ?? "Store"}`,
      detail: `Overdue settlement of ₱${Number(o.net_payable).toLocaleString()} (due ${o.period_end})`,
    });
  }

  return {
    counts: { aged: agedRows.length, low: lowRows.length, discrepancies: disc.length, overdue: overdue.length },
    items,
  };
}

/** Minimal CSV serialiser (quotes fields, escapes quotes). */
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
