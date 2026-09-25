import Link from "next/link";
import { Upload } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SaleEntry, type SellableItem } from "@/components/sale-entry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatPHP } from "@/lib/utils";

export default async function StoreSalesPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return <p className="text-sm text-muted-foreground">No store scope on this account.</p>;
  }
  const supabase = createClient();

  const [{ data: stock }, { data: recent }] = await Promise.all([
    supabase
      .from("stock_levels")
      .select("product_id, consignor_id, qty_on_hand, products(name, sku, unit_price), consignors(name)")
      .eq("store_id", profile.store_id)
      .gt("qty_on_hand", 0),
    supabase
      .from("sales")
      .select("id, sold_at, sale_items(qty, unit_price, products(name))")
      .eq("store_id", profile.store_id)
      .order("sold_at", { ascending: false })
      .limit(8),
  ]);

  const items: SellableItem[] = ((stock ?? []) as unknown as Array<{
    product_id: string;
    consignor_id: string;
    qty_on_hand: number;
    products: { name: string; sku: string | null; unit_price: number } | null;
    consignors: { name: string } | null;
  }>).map((s) => ({
    productId: s.product_id,
    consignorId: s.consignor_id,
    name: s.products?.name ?? "—",
    sku: s.products?.sku ?? null,
    price: s.products?.unit_price ?? 0,
    consignorName: s.consignors?.name ?? "—",
    onHand: s.qty_on_hand,
  }));

  const recentSales = (recent ?? []) as unknown as Array<{
    id: string;
    sold_at: string;
    sale_items: { qty: number; unit_price: number; products: { name: string } | null }[];
  }>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Record a sale</h1>
          <p className="text-sm text-muted-foreground">Tap items to build the sale, then record it.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/store/sales/import">
            <Upload className="h-4 w-4" /> Import CSV / POS
          </Link>
        </Button>
      </div>

      <SaleEntry storeId={profile.store_id} items={items} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((s) => {
                const total = s.sale_items.reduce((a, i) => a + i.qty * i.unit_price, 0);
                const summary = s.sale_items
                  .map((i) => `${i.qty}× ${i.products?.name ?? "—"}`)
                  .join(", ");
                return (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(s.sold_at)}
                    </TableCell>
                    <TableCell className="text-sm">{summary}</TableCell>
                    <TableCell className="tnum text-right">{formatPHP(total)}</TableCell>
                  </TableRow>
                );
              })}
              {recentSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    No sales yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
