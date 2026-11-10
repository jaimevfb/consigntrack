import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP } from "@/lib/utils";

export const metadata = { title: "Catalog" };

export default async function StoreCatalogPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return <p className="text-sm text-muted-foreground">No store scope on this account.</p>;
  }
  const supabase = createClient();

  // products_select RLS already limits this to consignors this store has an
  // active agreement with — the agreed catalog surfaces here automatically.
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, unit_price, consignors(name)")
    .order("name");

  const rows = ((products ?? []) as unknown as Array<{
    id: string;
    name: string;
    sku: string;
    unit_price: number;
    consignors: { name: string } | null;
  }>);

  const byConsignor = new Map<string, typeof rows>();
  for (const p of rows) {
    const key = p.consignors?.name ?? "—";
    if (!byConsignor.has(key)) byConsignor.set(key, []);
    byConsignor.get(key)!.push(p);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Products from the consignors you have an active agreement with. Prices are set by the
          signed agreement; deliveries draw from this catalog.
        </p>
      </div>

      {byConsignor.size === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No agreed products yet. Once your administrator connects you to a consignor, their
            products appear here.
          </CardContent>
        </Card>
      ) : (
        [...byConsignor.entries()].map(([consignor, items]) => (
          <Card key={consignor}>
            <CardHeader>
              <CardTitle className="text-base">{consignor}</CardTitle>
              <p className="text-xs text-muted-foreground">{items.length} product{items.length === 1 ? "" : "s"}</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Agreed price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="tnum text-sm text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="tnum text-right">{formatPHP(p.unit_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
