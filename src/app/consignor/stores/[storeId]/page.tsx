import Link from "next/link";
import { ArrowLeft, Boxes, ShoppingCart, Coins, Truck, Package } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getConsignorStoreDetail } from "@/lib/consignor-data";
import { KpiTile } from "@/components/kpi-tile";
import { LineChart, RankedBars } from "@/components/charts";
import { StatusPill, SettlementStatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Store monitor" };

const TONE: Record<string, "ok" | "warn" | "info" | "neutral"> = { DELIVERED: "ok", RECEIVED_BY_CONSIGNOR: "ok", PARTIAL_DISPUTED: "warn", IN_TRANSIT: "info", RETURN_IN_TRANSIT: "info", RETURN_PACKED: "neutral", PACKED: "neutral" };
function label(s: string) { return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export default async function ConsignorStoreMonitorPage({ params }: { params: { storeId: string } }) {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const d = await getConsignorStoreDetail(profile.consignor_id, params.storeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/consignor/partners" className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> All stores</Link>
          <h1 className="text-2xl">{d.storeName}</h1>
          <p className="text-sm text-muted-foreground">{d.commission_pct}% commission · {d.cadence} · {d.periodDays}-day period · <StatusPill tone={d.active ? "ok" : "neutral"}>{d.active ? "Active" : "Inactive"}</StatusPill></p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={Boxes} label="On shelf" hint={`${formatNumber(d.onHandUnits)} units`} value={formatPHP(d.onHandValue)} />
        <KpiTile icon={ShoppingCart} label="Sold here" hint={`${d.sellThrough}% sell-through`} value={formatNumber(d.soldUnits)} tone={d.sellThrough >= 50 ? "ok" : "default"} />
        <KpiTile icon={Coins} label="Net earned" hint={`${formatPHP(d.grossSales)} gross`} value={formatPHP(d.netEarned)} />
        <KpiTile icon={Truck} label="In transit" hint="To this store" value={formatNumber(d.inTransitUnits)} tone={d.inTransitUnits > 0 ? "ok" : "default"} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-base">Net from this store</CardTitle>
              <div className="tnum mt-1 text-2xl font-bold">{formatPHP(d.netEarned)}</div>
              <p className="text-xs text-muted-foreground">Your take after commission · last 30 days</p>
            </div>
            <span className="text-xs text-muted-foreground">Daily net</span>
          </div>
        </CardHeader>
        <CardContent><LineChart points={d.netSeries} height={180} valueLabel={formatPHP} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top sellers here</CardTitle></CardHeader>
          <CardContent>
            {d.topProducts.length > 0 ? (
              <RankedBars rows={d.topProducts.map((p) => ({ label: p.name, value: p.gross, sub: `${p.sold} sold` }))} valueFormat={formatPHP} />
            ) : <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Package className="h-4 w-4" /> No sales at this store yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Package activity</CardTitle></CardHeader>
          <CardContent>
            {d.packages.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No packages to this store yet.</p> : (
              <div className="divide-y divide-border">
                {d.packages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="tnum text-sm font-medium">{p.pkg_code}</div>
                      <div className="text-xs text-muted-foreground">{p.direction === "RETURN" ? "← " : "→ "}{p.units} units · {formatDate(p.updated_at)}</div>
                    </div>
                    <StatusPill tone={TONE[p.status] ?? "neutral"}>{label(p.status)}</StatusPill>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Settlements · {formatPHP(d.pendingSettlement)} pending</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net payable</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(s.period_start)} – {formatDate(s.period_end)}</TableCell>
                    <TableCell className="tnum text-right">{formatPHP(s.gross_sales)}</TableCell>
                    <TableCell className="tnum text-right font-medium">{formatPHP(s.net_payable)}</TableCell>
                    <TableCell><SettlementStatusPill status={s.status} /></TableCell>
                  </TableRow>
                ))}
                {d.settlements.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No statements for this store yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
