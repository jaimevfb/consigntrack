import Link from "next/link";
import { Warehouse, Truck, Store as StoreIcon, Coins, FileClock, ArrowUpRight, PackageSearch } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getConsignorNetwork } from "@/lib/consignor-data";
import { KpiTile } from "@/components/kpi-tile";
import { LineChart, RankedBars } from "@/components/charts";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { SettlementStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { formatPHP, formatNumber, formatDate } from "@/lib/utils";

const TONE: Record<string, "ok" | "warn" | "info" | "neutral"> = { DELIVERED: "ok", RECEIVED_BY_CONSIGNOR: "ok", PARTIAL_DISPUTED: "warn", IN_TRANSIT: "info", RETURN_IN_TRANSIT: "info", PACKED: "neutral" };
function label(s: string) { return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export default async function ConsignorDashboardPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const net = await getConsignorNetwork(profile.consignor_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Dashboard</h1>
        </div>
        <Button asChild size="sm"><Link href="/consignor/shipments"><PackageSearch className="h-4 w-4" /> Build shipment</Link></Button>
      </div>

      <OnboardingChecklist steps={[
        { label: "Add your first product", hint: "Build your catalogue — a SKU is issued automatically", href: "/consignor/products", done: net.onboarding.products },
        { label: "Connect a partner store", hint: "Set commission and terms with a store", href: "/consignor/partners", done: net.onboarding.store },
        { label: "Build & dispatch a shipment", hint: "Pack a package, scan its QR to send it", href: "/consignor/shipments", done: net.onboarding.shipment },
        { label: "Generate a settlement", hint: "Statement of sales, computed from the ledger", href: "/consignor/settlements", done: net.onboarding.settlement },
      ]} />

      {/* Network inventory strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Warehouse} label="In warehouse" hint={`${formatNumber(net.warehouseUnits)} units`} value={formatPHP(net.warehouseValue)} href="/consignor/insights" />
        <KpiTile icon={Truck} label="In transit" hint="To your stores" value={formatNumber(net.inTransitUnits)} tone={net.inTransitUnits > 0 ? "ok" : "default"} href="/consignor/shipments" />
        <KpiTile icon={StoreIcon} label="At stores" hint={`${formatNumber(net.atStoreUnits)} units`} value={formatPHP(net.atStoreValue)} href="/consignor/partners" />
        <KpiTile icon={Coins} label="Unbilled sales" hint="Accruing this cycle" value={formatPHP(net.unbilledSales)} href="/consignor/settlements" />
      </div>

      {/* Net profit trend */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">Net profit</CardTitle>
              <div className="tnum mt-1 text-3xl font-bold">{formatPHP(net.net30)}</div>
              <p className="text-xs text-muted-foreground">Your take after commission · last 30 days</p>
            </div>
            <span className="text-xs text-muted-foreground">Daily net</span>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart points={net.netSeries} height={190} valueLabel={formatPHP} />
        </CardContent>
      </Card>

      {/* Top products + payout forecast */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top products across stores</CardTitle></CardHeader>
          <CardContent>
            {net.topProducts.length > 0 ? (
              <RankedBars rows={net.topProducts.map((p) => ({ label: p.name, value: p.gross, sub: `${p.sold} sold` }))} valueFormat={formatPHP} />
            ) : <p className="py-8 text-center text-sm text-muted-foreground">No sales across your stores yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Payout forecast</CardTitle><p className="text-xs text-muted-foreground">Expected settlement cashflow, by store and period.</p></CardHeader>
          <CardContent>
            {net.payoutForecast.length > 0 ? (
              <div className="divide-y divide-border">
                {net.payoutForecast.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.store_name}</div>
                      <div className="text-xs text-muted-foreground">Period to {formatDate(p.period_end)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tnum text-sm font-semibold">{formatPHP(p.net_payable)}</span>
                      <SettlementStatusPill status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">Nothing pending — all statements settled.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Live shipment feed</CardTitle></CardHeader>
          <CardContent>
            {net.feed.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No shipments yet.</p> : (
              <div className="divide-y divide-border">
                {net.feed.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="tnum text-sm font-medium">{f.pkg_code}</div>
                      <div className="text-xs text-muted-foreground">{f.direction === "RETURN" ? "← " : "→ "}{f.store_name} · {f.units} units · {formatDate(f.updated_at)}</div>
                    </div>
                    <StatusPill tone={TONE[f.status] ?? "neutral"}>{label(f.status)}</StatusPill>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Pending settlements</CardTitle>
            <Link href="/consignor/settlements" className="text-xs text-muted-foreground hover:text-foreground"><ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"><FileClock className="h-[18px] w-[18px]" /></span>
              <div className="tnum text-2xl font-bold">{formatPHP(net.pendingSettlements)}</div>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Statements issued and awaiting payment.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Partner leaderboard</CardTitle><p className="text-xs text-muted-foreground">Stores ranked by sell-through. The bottom of the list holds stagnant stock.</p></CardHeader>
        <CardContent>
          {net.leaderboard.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No store activity yet.</p> : (
            <div className="space-y-2.5">
              {net.leaderboard.map((s, i) => (
                <Link key={i} href={`/consignor/stores/${s.store_id}`} className="flex items-center gap-3 rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/50">
                  <span className="w-28 shrink-0 truncate text-sm font-medium text-primary">{s.store_name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, s.sellThrough)}%` }} />
                  </div>
                  <span className="tnum w-12 text-right text-sm">{s.sellThrough}%</span>
                  <span className="tnum w-20 text-right text-xs text-muted-foreground">{s.sold} sold</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
