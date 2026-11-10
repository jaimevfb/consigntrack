import { createClient } from "@/lib/supabase/server";

export interface ConsignorNetwork {
  warehouseUnits: number; warehouseValue: number;
  inTransitUnits: number;
  atStoreUnits: number; atStoreValue: number;
  unbilledSales: number;
  pendingSettlements: number;
  net30: number;
  netSeries: { label: string; value: number }[];
  topProducts: { name: string; sku: string; sold: number; gross: number }[];
  payoutForecast: { store_name: string; period_end: string; net_payable: number; status: string }[];
  feed: { pkg_code: string; direction: string; status: string; store_name: string; units: number; updated_at: string }[];
  leaderboard: { store_id: string; store_name: string; onHand: number; sold: number; sellThrough: number }[];
}

export async function getConsignorNetwork(consignorId: string): Promise<ConsignorNetwork> {
  const supabase = createClient();
  const [{ data: wh }, { data: prods }, { data: ledger }, { data: packages }, { data: settlements }, { data: agreements }] = await Promise.all([
    supabase.from("v_warehouse_on_hand").select("sku_id, qty").eq("consignor_id", consignorId),
    supabase.from("products").select("id, sku, name, unit_price, consignor_id").eq("consignor_id", consignorId),
    supabase.from("ledger_entries").select("consignee_id, sku_id, entry_type, qty, unit_price, created_at, stores:consignee_id(name), products!inner(consignor_id)").eq("products.consignor_id", consignorId),
    supabase.from("packages").select("pkg_code, direction, status, updated_at, stores(name), package_lines(qty_expected)").eq("consignor_id", consignorId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("settlements").select("period_start, period_end, gross_sales, net_payable, status, agreements!inner(consignor_id, stores(name))").eq("agreements.consignor_id", consignorId).order("period_end", { ascending: false }),
    supabase.from("agreements").select("store_id, commission_pct").eq("consignor_id", consignorId),
  ]);

  const price = new Map(((prods ?? []) as { id: string; unit_price: number }[]).map((p) => [p.id, p.unit_price]));
  const commByStore = new Map(((agreements ?? []) as { store_id: string; commission_pct: number }[]).map((a) => [a.store_id, Number(a.commission_pct)]));
  const warehouseUnits = ((wh ?? []) as { sku_id: string; qty: number }[]).reduce((a, r) => a + r.qty, 0);
  const warehouseValue = ((wh ?? []) as { sku_id: string; qty: number }[]).reduce((a, r) => a + r.qty * (price.get(r.sku_id) ?? 0), 0);

  const led = ((ledger ?? []) as unknown as Array<{ consignee_id: string; entry_type: string; qty: number; unit_price: number | null; sku_id: string; created_at: string; stores: { name: string } | null }>);

  // Net profit (consignor's take = gross − store commission) as a 30-day daily series.
  const netByDay = new Map<string, number>();
  let net30 = 0;
  const since = new Date(); since.setDate(since.getDate() - 29); since.setHours(0, 0, 0, 0);
  for (const e of led) {
    if (e.entry_type !== "SALE") continue;
    const gross = -e.qty * (e.unit_price ?? price.get(e.sku_id) ?? 0);
    const pct = commByStore.get(e.consignee_id) ?? 0;
    const netVal = gross * (1 - pct / 100);
    if (new Date(e.created_at) >= since) {
      const k = e.created_at.slice(0, 10);
      netByDay.set(k, (netByDay.get(k) ?? 0) + netVal);
      net30 += netVal;
    }
  }
  const netSeries: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    netSeries.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: Math.round(netByDay.get(k) ?? 0) });
  }
  // at-stores on hand per store, sold per store, grossSales
  const perStore = new Map<string, { name: string; onHand: number; sold: number }>();
  let atStoreUnits = 0, atStoreValue = 0, grossAll = 0;
  for (const e of led) {
    const st = perStore.get(e.consignee_id) ?? { name: e.stores?.name ?? "—", onHand: 0, sold: 0 };
    st.onHand += e.qty; // signed sum = on hand
    if (e.entry_type === "SALE") { st.sold += -e.qty; grossAll += (-e.qty) * (e.unit_price ?? 0); }
    perStore.set(e.consignee_id, st);
  }
  for (const [, st] of perStore) { atStoreUnits += Math.max(0, st.onHand); atStoreValue += Math.max(0, st.onHand) * 0; }
  // value: approximate at agreed price via products price map is per-sku; recompute value from ledger on-hand × price
  atStoreValue = 0;
  const onHandBySku = new Map<string, number>();
  for (const e of led) onHandBySku.set(e.sku_id, (onHandBySku.get(e.sku_id) ?? 0) + e.qty);
  for (const [sku, q] of onHandBySku) atStoreValue += Math.max(0, q) * (price.get(sku) ?? 0);

  const inTransitUnits = ((packages ?? []) as unknown as Array<{ status: string; direction: string; package_lines: { qty_expected: number }[] }>)
    .filter((p) => p.status === "IN_TRANSIT" && p.direction === "OUTBOUND")
    .reduce((a, p) => a + p.package_lines.reduce((x, l) => x + l.qty_expected, 0), 0);

  const settledGross = ((settlements ?? []) as { gross_sales: number }[]).reduce((a, s) => a + Number(s.gross_sales), 0);
  const unbilledSales = Math.max(0, Math.round(grossAll - settledGross));
  const pendingSettlements = ((settlements ?? []) as { net_payable: number; status: string }[]).filter((s) => s.status !== "confirmed").reduce((a, s) => a + Number(s.net_payable), 0);

  const feed = ((packages ?? []) as unknown as Array<{ pkg_code: string; direction: string; status: string; updated_at: string; stores: { name: string } | null; package_lines: { qty_expected: number }[] }>)
    .map((p) => ({ pkg_code: p.pkg_code, direction: p.direction, status: p.status, store_name: p.stores?.name ?? "—", units: p.package_lines.reduce((a, l) => a + l.qty_expected, 0), updated_at: p.updated_at }));

  // Top products network-wide (by gross) + payout forecast from open settlements.
  const soldBySku = new Map<string, { sold: number; gross: number }>();
  for (const e of led) {
    if (e.entry_type !== "SALE") continue;
    const q = -e.qty; const amt = q * (e.unit_price ?? price.get(e.sku_id) ?? 0);
    const s = soldBySku.get(e.sku_id) ?? { sold: 0, gross: 0 }; s.sold += q; s.gross += amt; soldBySku.set(e.sku_id, s);
  }
  const prodInfo = new Map(((prods ?? []) as { id: string; sku: string; name: string }[]).map((p) => [p.id, p]));
  const topProducts = [...soldBySku.entries()].map(([sku, s]) => ({ name: prodInfo.get(sku)?.name ?? "—", sku: prodInfo.get(sku)?.sku ?? "—", sold: s.sold, gross: Math.round(s.gross) })).sort((a, b) => b.gross - a.gross).slice(0, 6);
  const payoutForecast = ((settlements ?? []) as unknown as Array<{ period_end: string; net_payable: number; status: string; agreements: { stores: { name: string } | null } | null }>)
    .filter((s) => s.status !== "confirmed")
    .map((s) => ({ store_name: s.agreements?.stores?.name ?? "—", period_end: s.period_end, net_payable: Number(s.net_payable), status: s.status }))
    .slice(0, 6);

  const leaderboard = [...perStore.entries()].map(([storeId, s]) => {
    const delivered = s.onHand + s.sold; // received into store across time ≈ on hand + sold
    return { store_id: storeId, store_name: s.name, onHand: Math.max(0, s.onHand), sold: s.sold, sellThrough: delivered > 0 ? Math.round((s.sold / delivered) * 100) : 0 };
  }).sort((a, b) => b.sellThrough - a.sellThrough);

  return {
    warehouseUnits, warehouseValue: Math.round(warehouseValue), inTransitUnits,
    atStoreUnits, atStoreValue: Math.round(atStoreValue),
    unbilledSales, pendingSettlements: Math.round(pendingSettlements),
    net30: Math.round(net30), netSeries, topProducts, payoutForecast, feed, leaderboard,
  };
}

export interface ConsignorSkuRow { sku_id: string; sku: string; name: string; unit_price: number; warehouse: number; atStores: number; sold30: number }

export async function getConsignorInsights(consignorId: string): Promise<{ rows: ConsignorSkuRow[]; byStore: { store: string; gross: number }[]; series: { label: string; value: number }[]; gross30: number }> {
  const supabase = createClient();
  const since = new Date(); since.setDate(since.getDate() - 30);
  const [{ data: prods }, { data: wh }, { data: led }] = await Promise.all([
    supabase.from("products").select("id, sku, name, unit_price").eq("consignor_id", consignorId).eq("status", "active"),
    supabase.from("v_warehouse_on_hand").select("sku_id, qty").eq("consignor_id", consignorId),
    supabase.from("ledger_entries").select("sku_id, consignee_id, entry_type, qty, unit_price, created_at, stores:consignee_id(name), products!inner(consignor_id)").eq("products.consignor_id", consignorId),
  ]);
  const whBy = new Map(((wh ?? []) as { sku_id: string; qty: number }[]).map((r) => [r.sku_id, r.qty]));
  const atStoreBy = new Map<string, number>();
  const sold30By = new Map<string, number>();
  const byStore = new Map<string, number>();
  const byDay = new Map<string, number>();
  let gross30 = 0;
  for (const e of ((led ?? []) as unknown as Array<{ sku_id: string; consignee_id: string; entry_type: string; qty: number; unit_price: number | null; created_at: string; stores: { name: string } | null }>)) {
    atStoreBy.set(e.sku_id, (atStoreBy.get(e.sku_id) ?? 0) + e.qty);
    if (e.entry_type === "SALE" && e.created_at >= since.toISOString()) {
      const q = -e.qty; const amt = q * (e.unit_price ?? 0);
      sold30By.set(e.sku_id, (sold30By.get(e.sku_id) ?? 0) + q);
      byStore.set(e.stores?.name ?? "—", (byStore.get(e.stores?.name ?? "—") ?? 0) + amt);
      byDay.set(e.created_at.slice(0, 10), (byDay.get(e.created_at.slice(0, 10)) ?? 0) + amt);
      gross30 += amt;
    }
  }
  const rows: ConsignorSkuRow[] = ((prods ?? []) as { id: string; sku: string; name: string; unit_price: number }[]).map((p) => ({
    sku_id: p.id, sku: p.sku, name: p.name, unit_price: p.unit_price,
    warehouse: whBy.get(p.id) ?? 0, atStores: Math.max(0, atStoreBy.get(p.id) ?? 0), sold30: sold30By.get(p.id) ?? 0,
  })).sort((a, b) => b.sold30 - a.sold30);

  const series: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); series.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: Math.round(byDay.get(k) ?? 0) }); }
  return { rows, byStore: [...byStore.entries()].map(([store, gross]) => ({ store, gross: Math.round(gross) })).sort((a, b) => b.gross - a.gross), series, gross30: Math.round(gross30) };
}

export interface ConsignorStoreDetail {
  storeId: string; storeName: string; found: boolean;
  commission_pct: number; cadence: string; periodDays: number; liability: string; active: boolean;
  onHandUnits: number; onHandValue: number;
  soldUnits: number; grossSales: number; netEarned: number;
  returnedUnits: number; deliveredUnits: number; sellThrough: number;
  inTransitUnits: number; pendingSettlement: number;
  netSeries: { label: string; value: number }[];
  topProducts: { name: string; sku: string; sold: number; gross: number }[];
  packages: { pkg_code: string; direction: string; status: string; units: number; updated_at: string }[];
  settlements: { id: string; period_start: string; period_end: string; gross_sales: number; net_payable: number; status: string }[];
}

/** One partner store, from the consignor's side — their stock, sales and net there. */
export async function getConsignorStoreDetail(consignorId: string, storeId: string): Promise<ConsignorStoreDetail> {
  const supabase = createClient();
  const [{ data: ag }, { data: store }, { data: prods }, { data: led }, { data: packages }, { data: settlements }] = await Promise.all([
    supabase.from("agreements").select("commission_pct, settlement_cadence, is_active, consignment_period_days, damage_liability").eq("consignor_id", consignorId).eq("store_id", storeId).maybeSingle(),
    supabase.from("stores").select("name").eq("id", storeId).maybeSingle(),
    supabase.from("products").select("id, sku, name, unit_price").eq("consignor_id", consignorId),
    supabase.from("ledger_entries").select("sku_id, entry_type, qty, unit_price, created_at, products!inner(consignor_id)").eq("products.consignor_id", consignorId).eq("consignee_id", storeId),
    supabase.from("packages").select("pkg_code, direction, status, updated_at, package_lines(qty_expected)").eq("consignor_id", consignorId).eq("consignee_id", storeId).order("updated_at", { ascending: false }).limit(10),
    supabase.from("settlements").select("id, period_start, period_end, gross_sales, net_payable, status, agreements!inner(consignor_id, store_id)").eq("agreements.consignor_id", consignorId).eq("agreements.store_id", storeId).order("period_end", { ascending: false }),
  ]);

  const a = (ag ?? null) as { commission_pct: number; settlement_cadence: string; is_active: boolean; consignment_period_days: number; damage_liability: string } | null;
  const pct = Number(a?.commission_pct ?? 0);
  const prod = new Map(((prods ?? []) as { id: string; sku: string; name: string; unit_price: number }[]).map((p) => [p.id, p]));

  const perSku = new Map<string, number>();
  const soldBySku = new Map<string, { sold: number; gross: number }>();
  let soldUnits = 0, grossSales = 0, returnedUnits = 0;
  const netByDay = new Map<string, number>();
  const since = new Date(); since.setDate(since.getDate() - 29); since.setHours(0, 0, 0, 0);
  for (const e of ((led ?? []) as unknown as Array<{ sku_id: string; entry_type: string; qty: number; unit_price: number | null; created_at: string }>)) {
    perSku.set(e.sku_id, (perSku.get(e.sku_id) ?? 0) + e.qty);
    if (e.entry_type === "SALE") {
      const q = -e.qty; const price = e.unit_price ?? prod.get(e.sku_id)?.unit_price ?? 0; const amt = q * price;
      soldUnits += q; grossSales += amt;
      const s = soldBySku.get(e.sku_id) ?? { sold: 0, gross: 0 }; s.sold += q; s.gross += amt; soldBySku.set(e.sku_id, s);
      if (new Date(e.created_at) >= since) netByDay.set(e.created_at.slice(0, 10), (netByDay.get(e.created_at.slice(0, 10)) ?? 0) + amt * (1 - pct / 100));
    }
    if (e.entry_type === "RETURN_OUT") returnedUnits += -e.qty;
  }
  let onHandUnits = 0, onHandValue = 0;
  for (const [sku, q] of perSku) { if (q > 0) { onHandUnits += q; onHandValue += q * (prod.get(sku)?.unit_price ?? 0); } }
  const deliveredUnits = onHandUnits + soldUnits + returnedUnits;
  const netEarned = grossSales * (1 - pct / 100);

  const netSeries: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); netSeries.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: Math.round(netByDay.get(k) ?? 0) }); }

  const topProducts = [...soldBySku.entries()].map(([sku, s]) => ({ name: prod.get(sku)?.name ?? "—", sku: prod.get(sku)?.sku ?? "—", sold: s.sold, gross: Math.round(s.gross) })).sort((x, y) => y.gross - x.gross).slice(0, 6);

  const pkgs = ((packages ?? []) as unknown as Array<{ pkg_code: string; direction: string; status: string; updated_at: string; package_lines: { qty_expected: number }[] }>);
  const inTransitUnits = pkgs.filter((p) => p.status === "IN_TRANSIT" && p.direction === "OUTBOUND").reduce((acc, p) => acc + p.package_lines.reduce((x, l) => x + l.qty_expected, 0), 0);
  const packagesOut = pkgs.map((p) => ({ pkg_code: p.pkg_code, direction: p.direction, status: p.status, units: p.package_lines.reduce((x, l) => x + l.qty_expected, 0), updated_at: p.updated_at }));

  const sets = ((settlements ?? []) as unknown as Array<{ id: string; period_start: string; period_end: string; gross_sales: number; net_payable: number; status: string }>);
  const pendingSettlement = sets.filter((s) => s.status !== "confirmed").reduce((acc, s) => acc + Number(s.net_payable), 0);

  return {
    storeId, storeName: (store as { name: string } | null)?.name ?? "—", found: !!store,
    commission_pct: pct, cadence: a?.settlement_cadence ?? "—", periodDays: a?.consignment_period_days ?? 0, liability: a?.damage_liability ?? "—", active: a?.is_active ?? false,
    onHandUnits, onHandValue: Math.round(onHandValue), soldUnits, grossSales: Math.round(grossSales), netEarned: Math.round(netEarned),
    returnedUnits, deliveredUnits, sellThrough: deliveredUnits > 0 ? Math.round((soldUnits / deliveredUnits) * 100) : 0,
    inTransitUnits, pendingSettlement: Math.round(pendingSettlement), netSeries, topProducts, packages: packagesOut, settlements: sets,
  };
}
