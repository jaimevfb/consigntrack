import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getStoreAnalytics } from "@/lib/data";
import { AreaTrend, Donut, RankedBars } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPHP, formatNumber } from "@/lib/utils";

export default async function StoreAnalyticsPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  if (profile.role === "store_staff") redirect("/store");
  const a = await getStoreAnalytics(profile.store_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">{a.windowLabel} · sales, products, and consignor mix.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Gross sales" value={formatPHP(a.tiles.gross30)} />
        <Tile label="Units sold" value={formatNumber(a.tiles.units30)} />
        <Tile label="Orders" value={formatNumber(a.tiles.orders30)} />
        <Tile label="Avg. order value" value={formatPHP(a.tiles.avgOrder)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales trend — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          <AreaTrend points={a.series} height={220} valueLabel={formatPHP} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars rows={a.topProducts.map((p) => ({ label: p.name, value: p.gross, sub: `${p.qtySold} sold` }))} valueFormat={formatPHP} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by consignor</CardTitle>
          </CardHeader>
          <CardContent>
            {a.mix.some((m) => m.value > 0) ? (
              <Donut segments={a.mix.map((m) => ({ label: `${m.label} · ${formatPHP(m.value)}`, value: m.value }))} centerLabel="consignors" centerValue={String(a.mix.length)} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tnum mt-1.5 text-2xl font-semibold">{value}</div>
    </div>
  );
}
