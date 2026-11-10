import { requireProfile } from "@/lib/auth";
import { getStoreInventory, type InventoryRow } from "@/lib/ledger-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { formatPHP, formatNumber } from "@/lib/utils";
import { unitLabel } from "@/lib/units";

export const metadata = { title: "Inventory & Catalog" };

function stockStatus(onHand: number): { label: string; tone: "ok" | "warn" | "neutral" } {
  if (onHand <= 0) return { label: "Out of stock", tone: "neutral" };
  if (onHand <= 3) return { label: "Low stock", tone: "warn" };
  return { label: "In stock", tone: "ok" };
}

export default async function StoreInventoryPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const rows = await getStoreInventory(profile.store_id);

  const totalUnits = rows.reduce((a, r) => a + r.on_hand, 0);
  const totalValue = rows.reduce((a, r) => a + r.on_hand * r.unit_price, 0);
  const totalDisputed = rows.reduce((a, r) => a + r.in_dispute, 0);

  const byConsignor = new Map<string, InventoryRow[]>();
  for (const r of rows) {
    if (!byConsignor.has(r.consignor_name)) byConsignor.set(r.consignor_name, []);
    byConsignor.get(r.consignor_name)!.push(r);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Inventory &amp; Catalog</h1>
        <p className="text-sm text-muted-foreground">Live on-hand per SKU, grouped by consignor. Prices and commission are set by the agreement — read-only here.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryTile label="Units on hand" value={formatNumber(totalUnits)} />
        <SummaryTile label="Retail value" value={formatPHP(totalValue)} />
        <SummaryTile label="In dispute" value={formatNumber(totalDisputed)} tone={totalDisputed > 0 ? "warn" : undefined} />
      </div>

      {byConsignor.size === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No stock yet. Receive a package to build inventory.</CardContent></Card>
      ) : (
        [...byConsignor.entries()].map(([consignor, items]) => (
          <Card key={consignor}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{consignor}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Agreed price</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">In dispute</TableHead>
                      <TableHead className="text-right">Retail value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((r) => {
                      const st = stockStatus(r.on_hand);
                      return (
                        <TableRow key={r.sku_id}>
                          <TableCell className="font-medium">{r.name}<div className="text-xs text-muted-foreground">{unitLabel(r.unit_of_measure)}</div></TableCell>
                          <TableCell className="tnum text-sm text-muted-foreground">{r.sku}</TableCell>
                          <TableCell className="tnum text-right">{formatPHP(r.unit_price)}</TableCell>
                          <TableCell className="tnum text-right text-muted-foreground">{r.commission_pct}%</TableCell>
                          <TableCell className="tnum text-right font-medium">{r.on_hand}</TableCell>
                          <TableCell className="tnum text-right">{r.in_dispute > 0 ? <span className="text-warn-foreground">{r.in_dispute}</span> : "—"}</TableCell>
                          <TableCell className="tnum text-right">{formatPHP(r.on_hand * r.unit_price)}</TableCell>
                          <TableCell><StatusPill tone={st.tone}>{st.label}</StatusPill></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`tnum mt-1.5 text-2xl font-bold ${tone === "warn" ? "text-warn-foreground" : ""}`}>{value}</div>
    </div>
  );
}
