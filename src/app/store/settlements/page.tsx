import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GenerateSettlementForm, type AgreementOption } from "@/components/generate-settlement-form";
import { SettlementStatusPill, StatusPill } from "@/components/status-pill";
import { SettlementPayDialog } from "@/components/settlement-pay-dialog";
import { PaymentReceipt } from "@/components/payment-receipt";
import { SettlementStatementButton, type SettlementStatement } from "@/components/settlement-statement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatDate } from "@/lib/utils";

export const metadata = { title: "Partners & Settlements" };

export default async function StorePartnersSettlementsPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const supabase = createClient();

  const [{ data: agreements }, { data: settlements }] = await Promise.all([
    supabase.from("agreements")
      .select("id, commission_pct, settlement_cadence, consignment_period_days, damage_liability, end_of_period_action, consignors(name)")
      .eq("store_id", profile.store_id).eq("is_active", true),
    supabase.from("settlements")
      .select("*, agreements!inner(store_id, commission_pct, settlement_cadence, consignment_period_days, damage_liability, stores(name), consignors(name)), payments(paid_at, confirmed_at, method, reference, amount), settlement_lines(qty_sold, gross, unit_price, commission_pct, commission, products(sku, name))")
      .eq("agreements.store_id", profile.store_id)
      .order("period_end", { ascending: false }),
  ]);

  const agr = ((agreements ?? []) as unknown as Array<{
    id: string; commission_pct: number; settlement_cadence: string; consignment_period_days: number;
    damage_liability: string; end_of_period_action: string; consignors: { name: string } | null;
  }>);
  const agreementOptions: AgreementOption[] = agr.map((a) => ({ id: a.id, consignorName: a.consignors?.name ?? "—", commissionPct: a.commission_pct, cadence: a.settlement_cadence }));

  const rows = ((settlements ?? []) as unknown as Array<{
    id: string; period_start: string; period_end: string; created_at: string;
    gross_sales: number; commission: number; returns_total: number; damage_total: number; net_payable: number; status: string;
    agreements: { commission_pct: number; settlement_cadence: string; consignment_period_days: number; damage_liability: string; stores: { name: string } | null; consignors: { name: string } | null } | null;
    payments: { paid_at: string | null; confirmed_at: string | null; method: string | null; reference: string | null; amount: number | null }[];
    settlement_lines: { qty_sold: number; gross: number; unit_price: number | null; commission_pct: number | null; commission: number; products: { sku: string; name: string } | null }[];
  }>);

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
  // Attention order: pending first, then paid-awaiting, then settled.
  const rank = (s: string) => (s === "pending" ? 0 : s === "paid" ? 1 : 2);
  rows.sort((a, b) => rank(a.status) - rank(b.status) || b.period_end.localeCompare(a.period_end));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Partners &amp; Settlements</h1>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Partners</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Consignor</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Cadence</TableHead><TableHead>Terms</TableHead></TableRow></TableHeader>
              <TableBody>
                {agr.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.consignors?.name ?? "—"}</TableCell>
                    <TableCell className="tnum text-right">{a.commission_pct}%</TableCell>
                    <TableCell className="capitalize">{a.settlement_cadence}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{a.consignment_period_days}d · {a.damage_liability}-liable · {a.end_of_period_action}</TableCell>
                  </TableRow>
                ))}
                {agr.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No active agreements.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <GenerateSettlementForm agreements={agreementOptions} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Settlements</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Net payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const payment = s.payments?.[0];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm font-medium">{formatDate(s.period_start)} – {formatDate(s.period_end)}</div>
                        <div className="text-xs text-muted-foreground">{s.agreements?.consignors?.name ?? "—"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="tnum font-semibold">{formatPHP(s.net_payable)}</div>
                        <div className="tnum text-xs text-muted-foreground">{formatPHP(s.gross_sales)} gross · −{formatPHP(s.commission)} comm</div>
                      </TableCell>
                      <TableCell><SettlementStatusPill status={s.status} /></TableCell>
                      <TableCell><PaymentReceipt method={payment?.method ?? null} reference={payment?.reference ?? null} /></TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <SettlementStatementButton statement={toStatement(s)} />
                          {s.status === "pending" ? (
                            <SettlementPayDialog settlementId={s.id} amount={s.net_payable} consignorName={s.agreements?.consignors?.name ?? "the consignor"} />
                          ) : s.status === "paid" && !payment?.confirmed_at ? (
                            <span className="whitespace-nowrap text-xs text-muted-foreground">Awaiting consignor</span>
                          ) : <StatusPill tone="ok">Settled</StatusPill>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No settlements yet. Generate one for a period.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
