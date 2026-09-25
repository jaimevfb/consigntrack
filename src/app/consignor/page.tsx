import Link from "next/link";
import { Package, Coins, Wallet, AlertCircle, ArrowUpRight } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConsignorDashboard, getConsignorAnalytics, getAlerts } from "@/lib/data";
import { AnomalyFeed } from "@/components/anomaly-feed";
import { AlertsPanel } from "@/components/alerts-panel";
import { AreaTrend, Donut, RankedBars } from "@/components/charts";
import { KpiTile, MiniStat } from "@/components/kpi-tile";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatNumber } from "@/lib/utils";

export default async function ConsignorDashboardPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        This account has no consignor scope.
      </div>
    );
  }

  const supabase = createClient();
  const [dash, analytics, alerts, { data: settRows }] = await Promise.all([
    getConsignorDashboard(profile.consignor_id),
    getConsignorAnalytics(profile.consignor_id),
    getAlerts(),
    supabase.from("settlements").select("gross_sales, commission, returns_total, net_payable"),
  ]);

  const setts = (settRows ?? []) as Array<{ gross_sales: number; commission: number; returns_total: number; net_payable: number }>;
  const econ = setts.reduce(
    (a, s) => ({
      gross: a.gross + Number(s.gross_sales),
      commission: a.commission + Number(s.commission),
      returns: a.returns + Number(s.returns_total),
      net: a.net + Number(s.net_payable),
    }),
    { gross: 0, commission: 0, returns: 0, net: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your consignments across all stores.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/consignor/analytics">
            View analytics <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Coins} label="Sold" hint="Last 30 days" value={formatPHP(analytics.tiles.gross30)} delta={analytics.tiles.deltaPct} />
        <KpiTile icon={Package} label="Items on hand" hint="Across all stores" value={formatNumber(dash.tiles.onHand)} />
        <KpiTile icon={Wallet} label="Net owed" hint="Unconfirmed settlements" value={formatPHP(dash.tiles.netOwed)} tone="ok" />
        <KpiTile
          icon={AlertCircle}
          label="Overdue"
          hint="Settlements past due"
          value={formatNumber(dash.tiles.overdue)}
          tone={dash.tiles.overdue > 0 ? "warn" : "default"}
        />
      </div>

      {/* Trend + economics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sales analytics</CardTitle>
              <span className="text-xs text-muted-foreground">Last 14 days</span>
            </div>
            <div className="mt-3 flex gap-6">
              <MiniStat label="Gross" value={formatPHP(analytics.tiles.gross30)} />
              <MiniStat label="Units" value={formatNumber(analytics.tiles.units30)} />
              <MiniStat label="Avg. order" value={formatPHP(analytics.tiles.avgOrder)} />
            </div>
          </CardHeader>
          <CardContent>
            <AreaTrend points={analytics.series} valueLabel={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settlement economics</CardTitle>
            <p className="text-xs text-muted-foreground">All statements to date</p>
          </CardHeader>
          <CardContent>
            {econ.gross > 0 ? (
              <Donut
                centerLabel="gross"
                centerValue={formatPHP(econ.gross).replace("₱", "₱")}
                segments={[
                  { label: `Net payable · ${formatPHP(econ.net)}`, value: econ.net },
                  { label: `Commission · ${formatPHP(econ.commission)}`, value: econ.commission },
                  { label: `Returns · ${formatPHP(econ.returns)}`, value: econ.returns },
                ]}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No settlements generated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products + per-store */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              rows={analytics.topProducts.map((p) => ({ label: p.name, value: p.gross, sub: `${p.qtySold} sold` }))}
              valueFormat={formatPHP}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-store performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.stores.map((s) => (
                  <TableRow key={s.storeId}>
                    <TableCell className="font-medium">{s.storeName}</TableCell>
                    <TableCell className="tnum text-right">{formatNumber(s.onHand)}</TableCell>
                    <TableCell className="tnum text-right">{formatPHP(s.owed)}</TableCell>
                    <TableCell>
                      <StatusPill tone={s.status === "overdue" ? "warn" : "ok"}>
                        {s.status === "overdue" ? "Overdue" : "On track"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
                {dash.stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No active store agreements yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Alerts + anomaly */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AlertsPanel alerts={alerts} />
        <AnomalyFeed discrepancies={dash.discrepancies} productNames={dash.productNames} storeNames={dash.storeNames} />
      </div>
    </div>
  );
}
