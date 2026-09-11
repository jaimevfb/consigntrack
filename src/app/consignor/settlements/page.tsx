import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettlementStatusPill } from "@/components/status-pill";
import { RowActionButton } from "@/components/row-action-button";
import { formatPHP, formatDate } from "@/lib/utils";

export default async function ConsignorSettlementsPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("settlements")
    .select("*, agreements!inner(stores(name)), payments(paid_at, confirmed_at)")
    .order("period_end", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    period_start: string;
    period_end: string;
    gross_sales: number;
    commission: number;
    returns_total: number;
    net_payable: number;
    status: string;
    agreements: { stores: { name: string } | null } | null;
    payments: { paid_at: string | null; confirmed_at: string | null }[];
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Settlements</h1>
        <p className="text-sm text-muted-foreground">
          Statements per store and period. Confirm receipt once a store marks a payment paid.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Returns</TableHead>
                <TableHead className="text-right">Net payable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const payment = s.payments?.[0];
                const canConfirm = s.status === "paid" && payment?.paid_at && !payment?.confirmed_at;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.agreements?.stores?.name ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(s.period_start)} – {formatDate(s.period_end)}
                    </TableCell>
                    <TableCell className="tnum text-right">{formatPHP(s.gross_sales)}</TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      −{formatPHP(s.commission)}
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      −{formatPHP(s.returns_total)}
                    </TableCell>
                    <TableCell className="tnum text-right font-medium">{formatPHP(s.net_payable)}</TableCell>
                    <TableCell>
                      <SettlementStatusPill status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canConfirm ? (
                        <RowActionButton
                          kind="confirmReceived"
                          id={s.id}
                          label="Confirm received"
                          pendingLabel="Confirming…"
                          variant="outline"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    No settlements yet.
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
