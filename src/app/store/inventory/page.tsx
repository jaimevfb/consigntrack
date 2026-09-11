import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPHP } from "@/lib/utils";

interface Row {
  product_id: string;
  consignor_id: string;
  qty_on_hand: number;
  products: { name: string; sku: string | null; unit_price: number } | null;
  consignors: { name: string } | null;
}

export default async function StoreInventoryPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return <p className="text-sm text-muted-foreground">No store scope on this account.</p>;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_levels")
    .select("product_id, consignor_id, qty_on_hand, products(name, sku, unit_price), consignors(name)")
    .eq("store_id", profile.store_id)
    .order("qty_on_hand", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  // group by consignor
  const groups = new Map<string, { name: string; rows: Row[] }>();
  for (const r of rows) {
    const g = groups.get(r.consignor_id) ?? { name: r.consignors?.name ?? "—", rows: [] };
    g.rows.push(r);
    groups.set(r.consignor_id, g);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Stock on hand by consignor. Title stays with the consignor until sale (BR2).
        </p>
      </div>

      {Array.from(groups.entries()).map(([cid, g]) => {
        const totalValue = g.rows.reduce((a, r) => a + r.qty_on_hand * (r.products?.unit_price ?? 0), 0);
        return (
          <Card key={cid}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{g.name}</CardTitle>
              <span className="tnum text-sm text-muted-foreground">{formatPHP(totalValue)} at retail</span>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((r) => (
                    <TableRow key={r.product_id}>
                      <TableCell className="font-medium">{r.products?.name ?? "—"}</TableCell>
                      <TableCell className="tnum text-xs text-muted-foreground">
                        {r.products?.sku ?? "—"}
                      </TableCell>
                      <TableCell className="tnum text-right">{formatPHP(r.products?.unit_price ?? 0)}</TableCell>
                      <TableCell className="tnum text-right">{formatNumber(r.qty_on_hand)}</TableCell>
                      <TableCell className="tnum text-right">
                        {formatPHP(r.qty_on_hand * (r.products?.unit_price ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {groups.size === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No stock on hand. Confirm an incoming delivery to add stock.
        </div>
      ) : null}
    </div>
  );
}
