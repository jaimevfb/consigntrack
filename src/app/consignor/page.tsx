import { requireProfile } from "@/lib/auth";
import { getConsignorDashboard } from "@/lib/data";
import { StatTile, PerfBar } from "@/components/stat-tile";
import { AnomalyFeed } from "@/components/anomaly-feed";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatNumber } from "@/lib/utils";

export default async function ConsignorDashboardPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        This account has no consignor scope. Sign in as a consignor to view this dashboard.
      </div>
    );
  }

  const dash = await getConsignorDashboard(profile.consignor_id);
  const maxSold = Math.max(1, ...dash.stores.map((s) => s.soldThisPeriod));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your consignments across all stores, this month.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Items on hand" value={formatNumber(dash.tiles.onHand)} hint="Across all stores" />
        <StatTile label="Sold this period" value={formatPHP(dash.tiles.soldValue)} hint="Gross value" />
        <StatTile label="Net owed" value={formatPHP(dash.tiles.netOwed)} tone="ok" hint="Unconfirmed settlements" />
        <StatTile
          label="Overdue remittance"
          value={formatNumber(dash.tiles.overdue)}
          tone={dash.tiles.overdue > 0 ? "warn" : "default"}
          hint="Settlements past due"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Per-store performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="w-40">Sold (period)</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.stores.map((s) => (
                  <TableRow key={s.storeId}>
                    <TableCell className="font-medium">{s.storeName}</TableCell>
                    <TableCell className="tnum text-right">{formatNumber(s.onHand)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PerfBar value={s.soldThisPeriod} max={maxSold} />
                        <span className="tnum w-8 text-right text-xs">{s.soldThisPeriod}</span>
                      </div>
                    </TableCell>
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
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No active store agreements yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AnomalyFeed
          discrepancies={dash.discrepancies}
          productNames={dash.productNames}
          storeNames={dash.storeNames}
        />
      </div>
    </div>
  );
}
