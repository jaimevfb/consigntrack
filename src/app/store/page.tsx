import Link from "next/link";
import { ShoppingCart, Boxes, Coins, FileClock, Package } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getStoreDashboard, getStoreAnalytics, getAlerts } from "@/lib/data";
import { getItemStatusCounts } from "@/lib/items-data";
import { AlertsPanel } from "@/components/alerts-panel";
import { CustodySummary } from "@/components/custody-summary";
import { StaffDashboard } from "@/components/staff-dashboard";
import { AreaTrend, RankedBars } from "@/components/charts";
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

  // Store staff get a task-focused operational view (no financials).
  if (profile.role === "store_staff") {
    return <StaffDashboard storeId={profile.store_id} name={profile.full_name} />;
  }

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
          <p className="text-sm text-muted-foreground">Your sales, inventory, and settlements at a glance.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/store/sales">
            <ShoppingCart className="h-4 w-4" /> Record sale
          </Link>
        </Button>
      </div>

      {/* The three things that matter — sales, inventory, settlement — plus volume. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Coins} label="Gross sales" hint="Last 30 days" value={formatPHP(analytics.tiles.gross30)} delta={analytics.tiles.deltaPct} />
        <KpiTile icon={ShoppingCart} label="Units sold" hint="Last 30 days" value={formatNumber(analytics.tiles.units30)} />
        <KpiTile icon={Boxes} label="Items on hand" hint="In your inventory" value={formatNumber(dash.tiles.onHand)} />
        <KpiTile
          icon={FileClock}
          label="Settlements due"
          hint="Awaiting payment"
          value={formatNumber(dash.tiles.settlementsDue)}
          tone={dash.tiles.settlementsDue > 0 ? "warn" : "default"}
        />
      </div>

      {/* Sales trend + what's selling — one clean analytics row, no repeated figures. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-base">Daily sales</CardTitle>
              <span className="text-xs text-muted-foreground">Last 14 days</span>
            </div>
          </CardHeader>
          <CardContent>
            <AreaTrend points={analytics.series} height={200} valueLabel={formatPHP} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top products</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topProducts.length > 0 ? (
              <RankedBars rows={analytics.topProducts.slice(0, 5).map((p) => ({ label: p.name, value: p.gross, sub: `${p.qtySold} sold` }))} valueFormat={formatPHP} />
            ) : (
              <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Package className="h-4 w-4" /> No sales recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <CustodySummary counts={itemCounts} itemsHref="/store/items" />
      <AlertsPanel alerts={alerts} maxItems={4} />
    </div>
  );
}
