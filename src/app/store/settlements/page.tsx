import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GenerateSettlementForm, type AgreementOption } from "@/components/generate-settlement-form";
import { StoreSettlementRow } from "@/components/store-settlement-row";
import type { SettlementStatement } from "@/components/settlement-statement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl">Partners &amp; Settlements</h1>
          <div className="flex gap-2">
            <a href="/api/export/settlements" download className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">Export statements (CSV)</a>
            <a href="/api/export/ledger" download className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">Export ledger (CSV)</a>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Partners</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {agr.map((a) => (
            <div key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{a.consignors?.name ?? "—"}</span>
                <span className="tnum shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{a.commission_pct}% commission</span>
              </div>
              <div className="mt-1 text-xs capitalize text-muted-foreground">{a.settlement_cadence} · {a.consignment_period_days}-day period · {a.damage_liability}-liable · {a.end_of_period_action}</div>
            </div>
          ))}
          {agr.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No active agreements.</p> : null}
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
                  const paid = (s.payments ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);
                  const remaining = Math.max(0, Math.round((s.net_payable - paid) * 100) / 100);
                  return (
                    <StoreSettlementRow key={s.id} data={{
                      id: s.id,
                      consignorName: s.agreements?.consignors?.name ?? "the consignor",
                      periodStart: s.period_start, periodEnd: s.period_end,
                      net: s.net_payable, gross: s.gross_sales, commission: s.commission,
                      commissionPct: s.agreements?.commission_pct ?? 0,
                      returnsTotal: s.returns_total, damageTotal: s.damage_total,
                      paid, remaining, status: s.status,
                      payment: { method: payment?.method ?? null, reference: payment?.reference ?? null, confirmed_at: payment?.confirmed_at ?? null },
                      statement: toStatement(s),
                    }} />
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
