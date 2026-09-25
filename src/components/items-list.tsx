import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusPill } from "@/components/item-lifecycle";
import { formatPHP } from "@/lib/utils";
import type { ItemRow } from "@/lib/items-data";

export function ItemsList({
  items,
  basePath,
  party,
}: {
  items: ItemRow[];
  basePath: string;
  party: "store" | "consignor" | "both";
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Item</TableHead>
              {party !== "consignor" ? <TableHead>Consignor</TableHead> : null}
              {party !== "store" ? <TableHead>Store</TableHead> : null}
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id} className="cursor-pointer">
                <TableCell className="tnum text-xs">
                  <Link href={`${basePath}/${it.id}`} className="hover:underline">
                    {it.code}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`${basePath}/${it.id}`} className="font-medium hover:underline">
                    {it.description}
                  </Link>
                  {it.category ? <div className="text-xs text-muted-foreground">{it.category}</div> : null}
                </TableCell>
                {party !== "consignor" ? <TableCell className="text-sm">{it.consignors?.name ?? "—"}</TableCell> : null}
                {party !== "store" ? <TableCell className="text-sm">{it.stores?.name ?? "—"}</TableCell> : null}
                <TableCell className="tnum text-right">{formatPHP(it.sale_price ?? it.asking_price)}</TableCell>
                <TableCell>
                  <ItemStatusPill status={it.status} />
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No tracked items yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
