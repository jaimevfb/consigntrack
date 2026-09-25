import { CheckCircle2, AlertTriangle, Coins, Activity } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDiscrepancies, getAdminAnalytics, getAlerts } from "@/lib/data";
import { StatTile } from "@/components/stat-tile";
import { KpiTile } from "@/components/kpi-tile";
import { AnomalyFeed } from "@/components/anomaly-feed";
import { AlertsPanel } from "@/components/alerts-panel";
import { AreaTrend } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDateTime, formatPHP } from "@/lib/utils";

export default async function AdminPage() {
  await requireProfile();
  const supabase = createClient();

  const [
    { count: consignorCount },
    { count: storeCount },
    { count: agreementCount },
    { data: mismatches },
    { data: products },
    { data: stores },
    { data: consignors },
    { data: audit },
  ] = await Promise.all([
    supabase.from("consignors").select("*", { count: "exact", head: true }),
    supabase.from("stores").select("*", { count: "exact", head: true }),
    supabase.from("agreements").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.rpc("reconcile_stock"),
    supabase.from("products").select("id, name"),
    supabase.from("stores").select("id, name"),
    supabase.from("consignors").select("id, name"),
    supabase
      .from("audit_log")
      .select("id, table_name, field, old_value, new_value, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const [discrepancies, adminA, alerts] = await Promise.all([getDiscrepancies(), getAdminAnalytics(), getAlerts()]);
  const mismatchRows = (mismatches ?? []) as Array<{
    store_id: string;
    product_id: string;
    level_qty: number;
    movement_sum: number;
    diff: number;
  }>;
  const productNames = Object.fromEntries(((products ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const storeNames = Object.fromEntries(((stores ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const consignorNames = Object.fromEntries(((consignors ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const auditRows = (audit ?? []) as Array<{
    id: string;
    table_name: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
  }>;

  const reconciled = mismatchRows.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Admin overview</h1>
        <p className="text-sm text-muted-foreground">Ledger integrity, anomalies, and the change audit trail.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={Coins} label="GMV (30 days)" value={formatPHP(adminA.gmv30)} hint={`${adminA.units30} units`} spark={adminA.series.map((s) => s.value)} />
        <KpiTile icon={Activity} label="Ledger movements" value={formatNumber(adminA.movements)} hint="Append-only entries" />
        <StatTile label="Consignors / Stores" value={`${formatNumber(consignorCount ?? 0)} / ${formatNumber(storeCount ?? 0)}`} hint={`${formatNumber(agreementCount ?? 0)} active agreements`} />
        <StatTile
          label="Open discrepancies"
          value={formatNumber(discrepancies.length)}
          tone={discrepancies.length > 0 ? "warn" : "ok"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System GMV trend</CardTitle>
          <p className="text-xs text-muted-foreground">Gross sales across all stores, last 14 days</p>
        </CardHeader>
        <CardContent>
          <AreaTrend points={adminA.series} valueLabel={formatPHP} />
        </CardContent>
      </Card>

      <AlertsPanel alerts={alerts} title="System alerts & discrepancies" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {reconciled ? (
              <CheckCircle2 className="h-4 w-4 text-ok-foreground" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warn-foreground" />
            )}
            Stock reconciliation (BR5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reconciled ? (
            <p className="text-sm text-ok-foreground">
              Reconciled — every stock level equals the sum of its movements. Zero mismatches.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">stock_levels</TableHead>
                  <TableHead className="text-right">Σ movements</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mismatchRows.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>{productNames[m.product_id] ?? m.product_id}</TableCell>
                    <TableCell>{storeNames[m.store_id] ?? m.store_id}</TableCell>
                    <TableCell className="tnum text-right">{m.level_qty}</TableCell>
                    <TableCell className="tnum text-right">{m.movement_sum}</TableCell>
                    <TableCell className="tnum text-right text-warn-foreground">{m.diff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnomalyFeed
          discrepancies={discrepancies}
          productNames={productNames}
          storeNames={storeNames}
          consignorNames={consignorNames}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price &amp; commission audit (BR8)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead className="text-right">Old → New</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{a.table_name}</TableCell>
                    <TableCell className="text-sm">{a.field}</TableCell>
                    <TableCell className="tnum text-right text-sm">
                      {a.old_value ?? "—"} → {a.new_value ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {auditRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No price or commission changes recorded.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
