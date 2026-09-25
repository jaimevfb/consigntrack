import Link from "next/link";
import { ShoppingCart, Users, Package, Coins, FileClock, ArrowUpRight } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getStoreDashboard, getStoreAnalytics, getAlerts } from "@/lib/data";
import { AnomalyFeed } from "@/components/anomaly-feed";
import { AlertsPanel } from "@/components/alerts-panel";
import { AreaTrend, Donut, RankedBars } from "@/components/charts";
import { KpiTile } from "@/components/kpi-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPHP, formatNumber } from "@/lib/utils";

export default async function StoreDashboardPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        This account has no store scope.
      </div>
    );
  }
  const isManager = profile.role === "store_manager" || profile.role === "admin";

  const [dash, analytics, alerts] = await Promise.all([
    getStoreDashboard(profile.store_id),
    getStoreAnalytics(profile.store_id),
    getAlerts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Every consignor you carry, in one ledger.</p>
        </div>
        <div className="flex gap-2">
          {isManager ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/store/analytics">
                Analytics <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href="/store/sales">
              <ShoppingCart className="h-4 w-4" /> Record a sale
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile icon={Users} label="Consignors" value={formatNumber(dash.tiles.consignors)} hint="Active agreements" />
        <KpiTile icon={Package} label="Items on hand" value={formatNumber(dash.tiles.onHand)} hint="All consignors" />
        <KpiTile
          icon={Coins}
          label="Sold (30 days)"
          value={formatPHP(analytics.tiles.gross30)}
          hint={`${analytics.tiles.units30} units`}
          spark={analytics.series.map((s) => s.value)}
        />
        <KpiTile
          icon={FileClock}
          label="Settlements due"
          value={formatNumber(dash.tiles.settlementsDue)}
          tone={dash.tiles.settlementsDue > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Sales trend</CardTitle>
            <p className="text-xs text-muted-foreground">Gross sales, last 14 days</p>
          </CardHeader>
          <CardContent>
            <AreaTrend points={analytics.series} valueLabel={formatPHP} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales by consignor</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.mix.some((m) => m.value > 0) ? (
              <Donut segments={analytics.mix.map((m) => ({ label: `${m.label} · ${formatPHP(m.value)}`, value: m.value }))} centerLabel="carried" centerValue={String(dash.tiles.consignors)} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars rows={analytics.topProducts.map((p) => ({ label: p.name, value: p.gross, sub: `${p.qtySold} sold` }))} valueFormat={formatPHP} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">On hand by consignor</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              rows={dash.consignors.map((c) => ({ label: c.consignorName, value: c.onHand, sub: `${formatPHP(c.owed)} owed` }))}
              valueFormat={formatNumber}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AlertsPanel alerts={alerts} />
        <AnomalyFeed discrepancies={dash.discrepancies} />
      </div>
    </div>
  );
}
