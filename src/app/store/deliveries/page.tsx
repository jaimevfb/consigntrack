import Link from "next/link";
import { ScanLine } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeliveryStatusPill } from "@/components/status-pill";
import { RowActionButton } from "@/components/row-action-button";
import { Button } from "@/components/ui/button";
import { formatDate, formatPHP, shortId } from "@/lib/utils";

interface DeliveryRow {
  id: string;
  delivery_date: string;
  status: string;
  consignors: { name: string } | null;
  items: { status: string }[];
  delivery_items: { qty: number; unit_price: number; products: { name: string } | null }[];
}

const NOT_RECEIVED = ["created", "labeled", "dispatched", "in_transit", "delivered"];
const RECEIVABLE = ["dispatched", "in_transit", "delivered"];

export default async function StoreDeliveriesPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("deliveries")
    .select("*, consignors(name), items(status), delivery_items(qty, unit_price, products(name))")
    .order("delivery_date", { ascending: false });

  const deliveries = (data ?? []) as unknown as DeliveryRow[];
  const itemBased = (d: DeliveryRow) => d.items.length > 0;
  const receivable = (d: DeliveryRow) => d.items.filter((i) => RECEIVABLE.includes(i.status)).length;
  const receivedCount = (d: DeliveryRow) => d.items.filter((i) => !NOT_RECEIVED.includes(i.status)).length;
  const units = (d: DeliveryRow) => (itemBased(d) ? d.items.length : d.delivery_items.reduce((a, i) => a + i.qty, 0));
  const value = (d: DeliveryRow) => d.delivery_items.reduce((a, i) => a + i.qty * i.unit_price, 0);

  // Needs store action: item-based with units ready to receive, or legacy bulk still 'sent'.
  const toReceive = deliveries.filter((d) => (itemBased(d) ? receivable(d) > 0 : d.status === "sent"));
  const rest = deliveries.filter((d) => !toReceive.includes(d));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Confirm receipt by scanning each item’s QR — stock becomes sellable only after a valid receive scan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Awaiting receipt ({toReceive.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {toReceive.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to receive right now.</p>
          ) : (
            toReceive.map((d) => (
              <div key={d.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.consignors?.name ?? "—"}</span>
                    <span className="tnum text-xs text-muted-foreground">{shortId(d.id)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(d.delivery_date)}
                    {itemBased(d)
                      ? ` · ${receivedCount(d)}/${units(d)} received · ${receivable(d)} ready to scan`
                      : ` · ${units(d)} units · ${formatPHP(value(d))}`}
                  </div>
                </div>
                {itemBased(d) ? (
                  <Button asChild size="sm">
                    <Link href="/store/scan"><ScanLine className="h-4 w-4" /> Scan to receive</Link>
                  </Button>
                ) : (
                  <RowActionButton kind="confirmDelivery" id={d.id} label="Confirm delivery" pendingLabel="Confirming…" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Consignor</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rest.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="tnum text-xs">{shortId(d.id)}</TableCell>
                  <TableCell>{formatDate(d.delivery_date)}</TableCell>
                  <TableCell className="font-medium">{d.consignors?.name ?? "—"}</TableCell>
                  <TableCell className="tnum text-right">{units(d)}</TableCell>
                  <TableCell>
                    <DeliveryStatusPill status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
              {rest.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No past deliveries.
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
