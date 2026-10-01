import Link from "next/link";
import { Plus } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeliveryStatusPill } from "@/components/status-pill";
import { formatDate, shortId } from "@/lib/utils";

export default async function ConsignorDeliveriesPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("deliveries")
    .select("*, stores(name), items(id), delivery_items(qty)")
    .order("delivery_date", { ascending: false });

  const deliveries = (data ?? []) as unknown as Array<{
    id: string;
    delivery_date: string;
    status: string;
    stores: { name: string } | null;
    items: { id: string }[];
    delivery_items: { qty: number }[];
  }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Deliveries</h1>
          <p className="text-sm text-muted-foreground">Consignments you have sent to stores.</p>
        </div>
        <Button asChild>
          <Link href="/consignor/deliveries/new">
            <Plus className="h-4 w-4" /> New delivery
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => {
                const units = d.items.length > 0 ? d.items.length : d.delivery_items.reduce((a, i) => a + i.qty, 0);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="tnum text-xs">
                      <Link href={`/consignor/deliveries/${d.id}`} className="hover:underline">{shortId(d.id)}</Link>
                    </TableCell>
                    <TableCell>{formatDate(d.delivery_date)}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/consignor/deliveries/${d.id}`} className="hover:underline">{d.stores?.name ?? "—"}</Link>
                    </TableCell>
                    <TableCell className="tnum text-right">{units}</TableCell>
                    <TableCell>
                      <DeliveryStatusPill status={d.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No deliveries yet. Create one to send stock to a store.
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
