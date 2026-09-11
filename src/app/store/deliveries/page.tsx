import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeliveryStatusPill } from "@/components/status-pill";
import { RowActionButton } from "@/components/row-action-button";
import { formatDate, formatPHP, shortId } from "@/lib/utils";

interface DeliveryRow {
  id: string;
  delivery_date: string;
  status: string;
  consignors: { name: string } | null;
  delivery_items: { qty: number; unit_price: number; products: { name: string } | null }[];
}

function unitCount(d: DeliveryRow) {
  return d.delivery_items.reduce((a, i) => a + i.qty, 0);
}
function value(d: DeliveryRow) {
  return d.delivery_items.reduce((a, i) => a + i.qty * i.unit_price, 0);
}

export default async function StoreDeliveriesPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("deliveries")
    .select("*, consignors(name), delivery_items(qty, unit_price, products(name))")
    .order("delivery_date", { ascending: false });

  const deliveries = (data ?? []) as unknown as DeliveryRow[];
  const incoming = deliveries.filter((d) => d.status === "sent");
  const rest = deliveries.filter((d) => d.status !== "sent");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Confirm incoming consignments — stock becomes sellable only after you confirm (BR4).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Awaiting your confirmation ({incoming.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {incoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to confirm right now.</p>
          ) : (
            incoming.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.consignors?.name ?? "—"}</span>
                      <span className="tnum text-xs text-muted-foreground">{shortId(d.id)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(d.delivery_date)} · {unitCount(d)} units · {formatPHP(value(d))}
                    </div>
                    <ul className="mt-2 text-sm text-muted-foreground">
                      {d.delivery_items.map((i, idx) => (
                        <li key={idx} className="tnum">
                          {i.qty} × {i.products?.name ?? "—"} @ {formatPHP(i.unit_price)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <RowActionButton
                    kind="confirmDelivery"
                    id={d.id}
                    label="Confirm delivery"
                    pendingLabel="Confirming…"
                  />
                </div>
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
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rest.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="tnum text-xs">{shortId(d.id)}</TableCell>
                  <TableCell>{formatDate(d.delivery_date)}</TableCell>
                  <TableCell className="font-medium">{d.consignors?.name ?? "—"}</TableCell>
                  <TableCell className="tnum text-right">{unitCount(d)}</TableCell>
                  <TableCell className="tnum text-right">{formatPHP(value(d))}</TableCell>
                  <TableCell>
                    <DeliveryStatusPill status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
              {rest.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
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
