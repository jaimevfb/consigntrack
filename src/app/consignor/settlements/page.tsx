import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettlementStatusPill } from "@/components/status-pill";
import { RowActionButton } from "@/components/row-action-button";
import { PaymentReceipt } from "@/components/payment-receipt";
import { SettlementStatementButton, type SettlementStatement } from "@/components/settlement-statement";
import { formatPHP, formatDate } from "@/lib/utils";

export default async function ConsignorSettlementsPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("settlements")
    .select("*, agreements!inner(commission_pct, settlement_cadence, consignment_period_days, damage_liability, stores(name), consignors(name)), payments(paid_at, confirmed_at, method, reference, amount), settlement_lines(qty_sold, gross, unit_price, commission_pct, commission, products(sku, name))")
    .order("period_end", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    period_start: string;
    period_end: string;
    created_at: string;
    gross_sales: number;
    commission: number;
    returns_total: number;
    damage_total: number;
    net_payable: number;
    status: string;
    agreements: { commission_pct: number; settlement_cadence: string; consignment_period_days: number; damage_liability: string; stores: { name: string } | null; consignors: { name: string } | null } | null;
    payments: {
      paid_at: string | null;
      confirmed_at: string | null;
      method: string | null;
      reference: string | null;
      amount: number | null;
    }[];
    settlement_lines: { qty_sold: number; gross: number; unit_price: number | null; commission_pct: number | null; commission: number; products: { sku: string; name: string } | null }[];
  }>;

  const toStatement = (s: (typeof rows)[number]): SettlementStatement => ({
    id: s.id, period_start: s.period_start, period_end: s.period_end, status: s.status, created_at: s.created_at,
    consignor_name: s.agreements?.consignors?.name ?? "—", store_name: s.agreements?.stores?.name ?? "—",
    commission_pct: s.agreements?.commission_pct ?? 0, cadence: s.agreements?.settlement_cadence ?? "—",
    consignment_period_days: s.agreements?.consignment_period_days ?? 0, damage_liability: s.agreements?.damage_liability ?? "—",
    gross_sales: s.gross_sales, commission: s.commission, returns_total: s.returns_total, damage_total: s.damage_total, net_payable: s.net_payable,
    lines: (s.settlement_lines ?? []).map((l) => ({ name: l.products?.name ?? "—", sku: l.products?.sku ?? "—", qty_sold: l.qty_sold, unit_price: l.unit_price ?? 0, commission_pct: l.commission_pct ?? (s.agreements?.commission_pct ?? 0), gross: l.gross, commission: l.commission }))
      .sort((a, b) => b.gross - a.gross),
    payment: s.payments?.[0] ? { method: s.payments[0].method, reference: s.payments[0].reference, amount: s.payments[0].amount, paid_at: s.payments[0].paid_at, confirmed_at: s.payments[0].confirmed_at } : null,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl">Settlements</h1>
          <div className="flex gap-2">
            <a href="/api/export/settlements" download className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">Export statements (CSV)</a>
            <a href="/api/export/ledger" download className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">Export ledger (CSV)</a>
          </div>
        </div>
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
                <TableHead className="text-right">Damage</TableHead>
                <TableHead className="text-right">Net payable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
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
                    <TableCell className="tnum text-right text-muted-foreground">
                      −{formatPHP(s.damage_total)}
                    </TableCell>
                    <TableCell className="tnum text-right font-medium">{formatPHP(s.net_payable)}</TableCell>
                    <TableCell>
                      <SettlementStatusPill status={s.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentReceipt method={payment?.method ?? null} reference={payment?.reference ?? null} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <SettlementStatementButton statement={toStatement(s)} />
                        {canConfirm ? (
                          <RowActionButton
                            kind="confirmReceived"
                            id={s.id}
                            label="Confirm received"
                            pendingLabel="Confirming…"
                            variant="outline"
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
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
