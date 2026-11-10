import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreInventory } from "@/lib/ledger-data";
import { InventoryTable, type InvRow } from "@/components/inventory-table";
import { formatPHP, formatNumber } from "@/lib/utils";

export const metadata = { title: "Inventory & Catalog" };

export default async function StoreInventoryPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const supabase = createClient();
  const since = new Date(); since.setDate(since.getDate() - 30);

  const [inv, { data: sales }] = await Promise.all([
    getStoreInventory(profile.store_id),
    supabase.from("ledger_entries").select("sku_id, qty").eq("consignee_id", profile.store_id).eq("entry_type", "SALE").gte("created_at", since.toISOString()),
  ]);
  const soldBy = new Map<string, number>();
  for (const s of ((sales ?? []) as { sku_id: string; qty: number }[])) soldBy.set(s.sku_id, (soldBy.get(s.sku_id) ?? 0) + -s.qty);

  const rows: InvRow[] = inv.map((r) => ({
    sku_id: r.sku_id, sku: r.sku, name: r.name, unit_of_measure: r.unit_of_measure, unit_price: r.unit_price,
    consignor_name: r.consignor_name, commission_pct: r.commission_pct, on_hand: r.on_hand, in_dispute: r.in_dispute,
    sold: soldBy.get(r.sku_id) ?? 0,
  }));

  const sellableUnits = rows.reduce((a, r) => a + Math.max(0, r.on_hand), 0);
  const value = rows.reduce((a, r) => a + Math.max(0, r.on_hand) * r.unit_price, 0);
  const disputed = rows.reduce((a, r) => a + r.in_dispute, 0);
  const lowCount = rows.filter((r) => r.on_hand > 0 && r.on_hand <= 3).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl">Inventory &amp; Catalog</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Strip label="Sellable units" value={formatNumber(sellableUnits)} />
        <Strip label="Retail value" value={formatPHP(value)} />
        <Strip label="Disputed" value={formatNumber(disputed)} tone={disputed > 0 ? "warn" : undefined} />
        <Strip label="Low stock" value={formatNumber(lowCount)} tone={lowCount > 0 ? "info" : undefined} />
      </div>

      <InventoryTable rows={rows} />
    </div>
  );
}

function Strip({ label, value, tone }: { label: string; value: string; tone?: "warn" | "info" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`tnum mt-1.5 text-2xl font-bold ${tone === "warn" ? "text-warn-foreground" : tone === "info" ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
