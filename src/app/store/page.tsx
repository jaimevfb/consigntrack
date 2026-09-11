import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getStoreDashboard } from "@/lib/data";
import { StatTile, PerfBar } from "@/components/stat-tile";
import { AnomalyFeed } from "@/components/anomaly-feed";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatNumber } from "@/lib/utils";

export default async function StoreDashboardPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        This account has no store scope. Sign in as a store user to view this dashboard.
      </div>
    );
  }

  const dash = await getStoreDashboard(profile.store_id);
  const maxOnHand = Math.max(1, ...dash.consignors.map((c) => c.onHand));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Every consignor you carry, in one ledger.</p>
        </div>
        <Button asChild>
          <Link href="/store/sales">
            <ShoppingCart className="h-4 w-4" /> Record a sale
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Consignors" value={formatNumber(dash.tiles.consignors)} hint="Active agreements" />
        <StatTile label="Items on hand" value={formatNumber(dash.tiles.onHand)} hint="All consignors" />
        <StatTile label="Units sold today" value={formatNumber(dash.tiles.salesToday)} tone="ok" />
        <StatTile
          label="Settlements due"
          value={formatNumber(dash.tiles.settlementsDue)}
          tone={dash.tiles.settlementsDue > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">By consignor</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consignor</TableHead>
                  <TableHead className="w-40">On hand</TableHead>
                  <TableHead className="text-right">Sold (period)</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.consignors.map((c) => (
                  <TableRow key={c.consignorId}>
                    <TableCell className="font-medium">{c.consignorName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PerfBar value={c.onHand} max={maxOnHand} />
                        <span className="tnum w-8 text-right text-xs">{c.onHand}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tnum text-right">{formatNumber(c.soldThisPeriod)}</TableCell>
                    <TableCell className="tnum text-right">{formatPHP(c.owed)}</TableCell>
                    <TableCell>
                      <StatusPill tone={c.status === "overdue" ? "warn" : "ok"}>
                        {c.status === "overdue" ? "Overdue" : "On track"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
                {dash.consignors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No consignors yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AnomalyFeed discrepancies={dash.discrepancies} />
      </div>
    </div>
  );
}
