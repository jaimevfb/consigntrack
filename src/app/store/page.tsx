import Link from "next/link";
import { ShoppingCart, Boxes, Coins, FileClock, PackageSearch, Package } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getStoreDashboardLedger, getStoreSalesAnalytics } from "@/lib/ledger-data";
import { StaffDashboard } from "@/components/staff-dashboard";
import { LineChart, RankedBars } from "@/components/charts";
import { KpiTile } from "@/components/kpi-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPHP, formatNumber } from "@/lib/utils";

export default async function StoreDashboardPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        This account has no store scope.
      </div>
    );
  }
  if (profile.role === "store_staff") {
    return <StaffDashboard storeId={profile.store_id} name={profile.full_name} />;
  }

  const [dash, sales] = await Promise.all([
    getStoreDashboardLedger(profile.store_id),
    getStoreSalesAnalytics(profile.store_id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Dashboard</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/store/sales"><ShoppingCart className="h-4 w-4" /> Record sale</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Boxes} label="Active consignment stock" hint={`${formatNumber(dash.activeUnits)} units on hand`} value={formatPHP(dash.activeValue)} />
        <KpiTile icon={PackageSearch} label="Incoming packages" hint="In transit to you" value={formatNumber(dash.incoming)} tone={dash.incoming > 0 ? "ok" : "default"} />
        <KpiTile icon={Coins} label="Period gross sales" hint={`${formatPHP(dash.commission30)} commission earned`} value={formatPHP(dash.gross30)} />
        <KpiTile icon={FileClock} label="Settlements due" hint="Net payable pending" value={formatPHP(dash.settlementsDueAmount)} tone={dash.settlementsDueAmount > 0 ? "warn" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <CardTitle className="text-base">Total sales</CardTitle>
                <div className="tnum mt-1 text-3xl font-bold">{formatPHP(dash.gross30)}</div>
                <p className="text-xs text-muted-foreground">Gross this period · {formatPHP(dash.commission30)} commission earned</p>
              </div>
              <span className="text-xs text-muted-foreground">Daily</span>
            </div>
          </CardHeader>
          <CardContent>
            <LineChart points={sales.series} height={200} valueLabel={formatPHP} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top selling products</CardTitle>
          </CardHeader>
          <CardContent>
            {sales.topSkus.length > 0 ? (
              <RankedBars rows={sales.topSkus.map((p) => ({ label: p.name, value: p.gross, sub: `${p.qty} sold` }))} valueFormat={formatPHP} />
            ) : (
              <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Package className="h-4 w-4" /> No sales recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
