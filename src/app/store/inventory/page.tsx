import { Boxes, Coins, AlertTriangle, TrendingDown } from "lucide-react";
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
    sold: soldBy.get(r.sku_id) ?? 0, category: r.category, photo_url: r.photo_url,
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
        <Strip label="Sellable units" value={formatNumber(sellableUnits)} icon={Boxes} color="blue" />
        <Strip label="Retail value" value={formatPHP(value)} icon={Coins} color="green" />
        <Strip label="Disputed" value={formatNumber(disputed)} icon={AlertTriangle} color="amber" active={disputed > 0} />
        <Strip label="Low stock" value={formatNumber(lowCount)} icon={TrendingDown} color="rose" active={lowCount > 0} />
      </div>

      <InventoryTable rows={rows} />
    </div>
  );
}

const STRIP_COLORS = {
  blue: { badge: "bg-primary/10 text-primary", value: "", border: "border-border" },
  green: { badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", value: "", border: "border-border" },
  amber: { badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", valueActive: "text-amber-600 dark:text-amber-400", borderActive: "border-amber-500/40 bg-amber-500/[0.04]" },
  rose: { badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400", valueActive: "text-rose-600 dark:text-rose-400", borderActive: "border-rose-500/40 bg-rose-500/[0.04]" },
} as const;

function Strip({ label, value, icon: Icon, color, active }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: "blue" | "green" | "amber" | "rose"; active?: boolean }) {
  const s = STRIP_COLORS[color];
  const border = active && "borderActive" in s ? s.borderActive : "border" in s ? s.border : "border-border";
  const valueColor = active && "valueActive" in s ? s.valueActive : "value" in s ? s.value : "";
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.badge}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className={`tnum mt-2 text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
