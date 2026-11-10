import { Coins, Boxes, Warehouse, Activity, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KpiTile } from "@/components/kpi-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDateTime } from "@/lib/utils";

export default async function AdminPage() {
  await requireProfile();
  const supabase = createClient();

  const [
    { count: consignorCount },
    { count: storeCount },
    { count: agreementCount },
    { count: inTransit },
    { data: onHand },
    { data: warehouse },
    { data: activity },
    { data: audit },
  ] = await Promise.all([
    supabase.from("consignors").select("*", { count: "exact", head: true }),
    supabase.from("stores").select("*", { count: "exact", head: true }),
    supabase.from("agreements").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("packages").select("*", { count: "exact", head: true }).eq("status", "IN_TRANSIT"),
    supabase.from("v_on_hand").select("qty"),
    supabase.from("v_warehouse_on_hand").select("qty"),
    supabase.from("ledger_entries").select("entry_type, qty, created_at, products(sku), stores:consignee_id(name)").order("created_at", { ascending: false }).limit(15),
    supabase.from("audit_log").select("id, table_name, field, old_value, new_value, created_at").order("created_at", { ascending: false }).limit(12),
  ]);

  const storeUnits = ((onHand ?? []) as { qty: number }[]).reduce((a, r) => a + r.qty, 0);
  const warehouseUnits = ((warehouse ?? []) as { qty: number }[]).reduce((a, r) => a + r.qty, 0);
  const acts = (activity ?? []) as unknown as Array<{ entry_type: string; qty: number; created_at: string; products: { sku: string } | null; stores: { name: string } | null }>;
  const auditRows = (audit ?? []) as Array<{ id: string; table_name: string; field: string; old_value: string | null; new_value: string | null; created_at: string }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">System overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide stock and activity, all from the one ledger.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Users} label="Consignors / Stores" hint={`${formatNumber(agreementCount ?? 0)} active agreements`} value={`${formatNumber(consignorCount ?? 0)} / ${formatNumber(storeCount ?? 0)}`} />
        <KpiTile icon={Warehouse} label="In warehouses" hint="Across all consignors" value={formatNumber(warehouseUnits)} />
        <KpiTile icon={Boxes} label="On store shelves" hint="Across all stores" value={formatNumber(storeUnits)} />
        <KpiTile icon={Coins} label="Packages in transit" hint="Awaiting receipt" value={formatNumber(inTransit ?? 0)} tone={(inTransit ?? 0) > 0 ? "ok" : "default"} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> Recent ledger activity</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Event</TableHead><TableHead>SKU</TableHead><TableHead>Store</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
              <TableBody>
                {acts.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                    <TableCell className="text-sm capitalize">{a.entry_type.replace(/_/g, " ").toLowerCase()}</TableCell>
                    <TableCell className="tnum text-sm text-muted-foreground">{a.products?.sku ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.stores?.name ?? "—"}</TableCell>
                    <TableCell className={`tnum text-right ${a.qty < 0 ? "text-muted-foreground" : ""}`}>{a.qty > 0 ? `+${a.qty}` : a.qty}</TableCell>
                  </TableRow>
                ))}
                {acts.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No activity yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Price &amp; commission changes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Record</TableHead><TableHead>Field</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
              <TableBody>
                {auditRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                    <TableCell className="text-sm capitalize">{a.table_name.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm capitalize">{a.field.replace(/_/g, " ")}</TableCell>
                    <TableCell className="tnum text-right text-sm">{a.old_value ?? "—"} → {a.new_value ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {auditRows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No changes recorded.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
