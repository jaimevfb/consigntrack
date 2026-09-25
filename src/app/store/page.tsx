import Link from "next/link";
import { ShoppingCart, Users, Package, Coins, FileClock, ArrowUpRight } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getStoreDashboard, getStoreAnalytics, getAlerts } from "@/lib/data";
import { getItemStatusCounts } from "@/lib/items-data";
import { AlertsPanel } from "@/components/alerts-panel";
import { CustodySummary } from "@/components/custody-summary";
import { AreaTrend, Donut, RankedBars } from "@/components/charts";
import { KpiTile, MiniStat } from "@/components/kpi-tile";
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

  const [dash, analytics, alerts, itemCounts] = await Promise.all([
    getStoreDashboard(profile.store_id),
    getStoreAnalytics(profile.store_id),
    getAlerts(),
    getItemStatusCounts(),
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Coins} label="Sold" hint="Last 30 days" value={formatPHP(analytics.tiles.gross30)} delta={analytics.tiles.deltaPct} />
        <KpiTile icon={Users} label="Consignors" hint="Active agreements" value={formatNumber(dash.tiles.consignors)} />
        <KpiTile icon={Package} label="Items on hand" hint="All consignors" value={formatNumber(dash.tiles.onHand)} />
        <KpiTile
          icon={FileClock}
          label="Settlements due"
          hint="Awaiting payment"
          value={formatNumber(dash.tiles.settlementsDue)}
          tone={dash.tiles.settlementsDue > 0 ? "warn" : "default"}
        />
      </div>

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

      <CustodySummary counts={itemCounts} itemsHref="/store/items" />
      <AlertsPanel alerts={alerts} />
    </div>
  );
}
