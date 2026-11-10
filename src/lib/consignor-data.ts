import { createClient } from "@/lib/supabase/server";

export interface ConsignorNetwork {
  warehouseUnits: number; warehouseValue: number;
  inTransitUnits: number;
  atStoreUnits: number; atStoreValue: number;
  unbilledSales: number;
  pendingSettlements: number;
  feed: { pkg_code: string; direction: string; status: string; store_name: string; units: number; updated_at: string }[];
  leaderboard: { store_name: string; onHand: number; sold: number; sellThrough: number }[];
}

export async function getConsignorNetwork(consignorId: string): Promise<ConsignorNetwork> {
  const supabase = createClient();
  const [{ data: wh }, { data: prods }, { data: ledger }, { data: packages }, { data: settlements }] = await Promise.all([
    supabase.from("v_warehouse_on_hand").select("sku_id, qty").eq("consignor_id", consignorId),
    supabase.from("products").select("id, unit_price, consignor_id").eq("consignor_id", consignorId),
    supabase.from("ledger_entries").select("consignee_id, sku_id, entry_type, qty, unit_price, stores:consignee_id(name), products!inner(consignor_id)").eq("products.consignor_id", consignorId),
    supabase.from("packages").select("pkg_code, direction, status, updated_at, stores(name), package_lines(qty_expected)").eq("consignor_id", consignorId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("settlements").select("gross_sales, net_payable, status, agreements!inner(consignor_id)").eq("agreements.consignor_id", consignorId),
  ]);

  const price = new Map(((prods ?? []) as { id: string; unit_price: number }[]).map((p) => [p.id, p.unit_price]));
  const warehouseUnits = ((wh ?? []) as { sku_id: string; qty: number }[]).reduce((a, r) => a + r.qty, 0);
  const warehouseValue = ((wh ?? []) as { sku_id: string; qty: number }[]).reduce((a, r) => a + r.qty * (price.get(r.sku_id) ?? 0), 0);

  const led = ((ledger ?? []) as unknown as Array<{ consignee_id: string; entry_type: string; qty: number; unit_price: number | null; sku_id: string; stores: { name: string } | null }>);
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

  const leaderboard = [...perStore.values()].map((s) => {
    const delivered = s.onHand + s.sold; // received into store across time ≈ on hand + sold
    return { store_name: s.name, onHand: Math.max(0, s.onHand), sold: s.sold, sellThrough: delivered > 0 ? Math.round((s.sold / delivered) * 100) : 0 };
  }).sort((a, b) => b.sellThrough - a.sellThrough);

  return {
    warehouseUnits, warehouseValue: Math.round(warehouseValue), inTransitUnits,
    atStoreUnits, atStoreValue: Math.round(atStoreValue),
    unbilledSales, pendingSettlements: Math.round(pendingSettlements), feed, leaderboard,
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
