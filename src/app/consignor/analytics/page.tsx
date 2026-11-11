import { requireProfile } from "@/lib/auth";
import { getConsignorInsights } from "@/lib/consignor-data";
import { DailyBars, RankedBars } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatNumber } from "@/lib/utils";

export const metadata = { title: "Insights" };

export default async function ConsignorInsightsPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const { rows, byStore, series, gross30 } = await getConsignorInsights(profile.consignor_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Insights</h1>
        <p className="text-sm text-muted-foreground">What&rsquo;s selling where — to decide what to make more of and ship next. Gross last 30 days: {formatPHP(gross30)}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Daily gross sales</CardTitle></CardHeader>
          <CardContent><DailyBars points={series} height={200} valueLabel={formatPHP} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Gross by store</CardTitle></CardHeader>
          <CardContent>
            {byStore.length > 0 ? <RankedBars rows={byStore.map((s) => ({ label: s.store, value: s.gross }))} valueFormat={formatPHP} /> : <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">SKU velocity</CardTitle><p className="text-xs text-muted-foreground">Warehouse vs. on-shelf vs. 30-day sales — feeds what to produce and allocate.</p></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">In warehouse</TableHead><TableHead className="text-right">At stores</TableHead><TableHead className="text-right">Sold (30d)</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.sku_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tnum text-sm text-muted-foreground">{r.sku}</TableCell>
                    <TableCell className="tnum text-right">{formatNumber(r.warehouse)}</TableCell>
                    <TableCell className="tnum text-right">{formatNumber(r.atStores)}</TableCell>
                    <TableCell className="tnum text-right font-medium">{formatNumber(r.sold30)}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No products yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
