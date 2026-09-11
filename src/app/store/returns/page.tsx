import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReturnForm } from "@/components/return-form";
import type { SellableItem } from "@/components/sale-entry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";

export default async function StoreReturnsPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return <p className="text-sm text-muted-foreground">No store scope on this account.</p>;
  }
  const supabase = createClient();

  const [{ data: stock }, { data: returns }] = await Promise.all([
    supabase
      .from("stock_levels")
      .select("product_id, consignor_id, qty_on_hand, products(name, sku, unit_price), consignors(name)")
      .eq("store_id", profile.store_id)
      .gt("qty_on_hand", 0),
    supabase
      .from("returns")
      .select("id, qty, reason, return_date, products(name), consignors(name)")
      .eq("store_id", profile.store_id)
      .order("return_date", { ascending: false })
      .limit(15),
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

  const recent = (returns ?? []) as unknown as Array<{
    id: string;
    qty: number;
    reason: string | null;
    return_date: string;
    products: { name: string } | null;
    consignors: { name: string } | null;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Returns</h1>
        <p className="text-sm text-muted-foreground">
          Returning unsold stock reduces on-hand but never reverses recorded sales (BR6).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReturnForm storeId={profile.store_id} items={items} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent returns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Consignor</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(r.return_date)}
                    </TableCell>
                    <TableCell className="font-medium">{r.products?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.consignors?.name ?? "—"}</TableCell>
                    <TableCell className="tnum text-right">{formatNumber(r.qty)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No returns yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
