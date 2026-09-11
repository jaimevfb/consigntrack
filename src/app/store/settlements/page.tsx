import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GenerateSettlementForm, type AgreementOption } from "@/components/generate-settlement-form";
import { SettlementStatusPill } from "@/components/status-pill";
import { RowActionButton } from "@/components/row-action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP, formatDate } from "@/lib/utils";

export default async function StoreSettlementsPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) {
    return <p className="text-sm text-muted-foreground">No store scope on this account.</p>;
  }
  const supabase = createClient();

  const [{ data: agreements }, { data: settlements }] = await Promise.all([
    supabase
      .from("agreements")
      .select("id, commission_pct, settlement_cadence, consignors(name)")
      .eq("store_id", profile.store_id)
      .eq("is_active", true),
    supabase
      .from("settlements")
      .select("*, agreements!inner(consignors(name)), payments(paid_at, confirmed_at)")
      .order("period_end", { ascending: false }),
  ]);

  const agreementOptions: AgreementOption[] = ((agreements ?? []) as unknown as Array<{
    id: string;
    commission_pct: number;
    settlement_cadence: string;
    consignors: { name: string } | null;
  }>).map((a) => ({
    id: a.id,
    consignorName: a.consignors?.name ?? "—",
    commissionPct: a.commission_pct,
    cadence: a.settlement_cadence,
  }));

  const rows = (settlements ?? []) as unknown as Array<{
    id: string;
    period_start: string;
    period_end: string;
    gross_sales: number;
    commission: number;
    returns_total: number;
    net_payable: number;
    status: string;
    agreements: { consignors: { name: string } | null } | null;
    payments: { paid_at: string | null; confirmed_at: string | null }[];
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Settlements</h1>
        <p className="text-sm text-muted-foreground">
          Statements auto-compute gross − commission − returns (BR3). Mark paid; the consignor confirms receipt (BR7).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <GenerateSettlementForm agreements={agreementOptions} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consignor</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Net payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const payment = s.payments?.[0];
                  const canMarkPaid = s.status === "pending";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.agreements?.consignors?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(s.period_start)} – {formatDate(s.period_end)}
                      </TableCell>
                      <TableCell className="tnum text-right font-medium">{formatPHP(s.net_payable)}</TableCell>
                      <TableCell>
                        <SettlementStatusPill status={s.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {canMarkPaid ? (
                          <RowActionButton kind="markPaid" id={s.id} label="Mark paid" pendingLabel="Saving…" />
                        ) : s.status === "paid" && !payment?.confirmed_at ? (
                          <span className="text-xs text-muted-foreground">Awaiting consignor</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No statements yet. Generate one from an agreement.
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
