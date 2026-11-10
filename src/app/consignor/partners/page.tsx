import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConnectPartner, type ExistingAgreement } from "@/components/connect-partner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { formatPHP, formatNumber } from "@/lib/utils";

export const metadata = { title: "Stores & Agreements" };

export default async function ConsignorStoresPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const supabase = createClient();
  const [{ data: ags }, { data: dir }, { data: prods }, { data: led }, { data: settlements }] = await Promise.all([
    supabase.from("agreements").select("store_id, commission_pct, settlement_cadence, is_active, consignment_period_days, damage_liability, end_of_period_action, stores(name)").eq("consignor_id", profile.consignor_id),
    supabase.rpc("partner_directory", { p_kind: "store" }),
    supabase.from("products").select("id, unit_price").eq("consignor_id", profile.consignor_id),
    supabase.from("ledger_entries").select("consignee_id, sku_id, qty, products!inner(consignor_id)").eq("products.consignor_id", profile.consignor_id),
    supabase.from("settlements").select("net_payable, status, agreements!inner(consignor_id, store_id)").eq("agreements.consignor_id", profile.consignor_id).neq("status", "confirmed"),
  ]);

  const agreements = (ags ?? []) as unknown as Array<{ store_id: string; commission_pct: number; settlement_cadence: string; is_active: boolean; consignment_period_days: number; damage_liability: "consignor" | "store" | "shared"; end_of_period_action: "return" | "extend" | "discount"; stores: { name: string } | null }>;
  const price = new Map(((prods ?? []) as { id: string; unit_price: number }[]).map((p) => [p.id, p.unit_price]));
  const onHandByStore = new Map<string, { units: number; value: number }>();
  for (const e of ((led ?? []) as unknown as Array<{ consignee_id: string; sku_id: string; qty: number }>)) {
    const cur = onHandByStore.get(e.consignee_id) ?? { units: 0, value: 0 };
    cur.units += e.qty; cur.value += e.qty * (price.get(e.sku_id) ?? 0);
    onHandByStore.set(e.consignee_id, cur);
  }
  const pendingByStore = new Map<string, number>();
  for (const s of ((settlements ?? []) as unknown as Array<{ net_payable: number; agreements: { store_id: string } | null }>)) {
    const sid = s.agreements?.store_id ?? ""; pendingByStore.set(sid, (pendingByStore.get(sid) ?? 0) + Number(s.net_payable));
  }

  const existing: ExistingAgreement[] = agreements.map((a) => ({
    partnerName: a.stores?.name ?? "—", commission_pct: a.commission_pct, cadence: a.settlement_cadence, active: a.is_active,
    periodDays: a.consignment_period_days, liability: a.damage_liability, endOfPeriod: a.end_of_period_action,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Stores &amp; Agreements</h1>
        <p className="text-sm text-muted-foreground">Every partner store: agreed terms, what they&rsquo;re holding, and what they owe.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Partner stores</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Store</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Terms</TableHead><TableHead className="text-right">On shelf</TableHead><TableHead className="text-right">Shelf value</TableHead><TableHead className="text-right">Owed</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Monitor</TableHead></TableRow></TableHeader>
              <TableBody>
                {agreements.map((a) => {
                  const oh = onHandByStore.get(a.store_id) ?? { units: 0, value: 0 };
                  return (
                    <TableRow key={a.store_id}>
                      <TableCell className="font-medium"><Link href={`/consignor/stores/${a.store_id}`} className="text-primary hover:underline">{a.stores?.name ?? "—"}</Link></TableCell>
                      <TableCell className="tnum text-right">{a.commission_pct}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.consignment_period_days}d · {a.damage_liability}-liable · {a.end_of_period_action}</TableCell>
                      <TableCell className="tnum text-right">{formatNumber(Math.max(0, oh.units))}</TableCell>
                      <TableCell className="tnum text-right">{formatPHP(Math.max(0, oh.value))}</TableCell>
                      <TableCell className="tnum text-right">{formatPHP(pendingByStore.get(a.store_id) ?? 0)}</TableCell>
                      <TableCell><StatusPill tone={a.is_active ? "ok" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</StatusPill></TableCell>
                      <TableCell className="text-right"><Link href={`/consignor/stores/${a.store_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link></TableCell>
                    </TableRow>
                  );
                })}
                {agreements.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No store partners yet — your administrator connects stores to you.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConnectPartner perspective="consignor" selfId={profile.consignor_id} directory={(dir ?? []) as { id: string; name: string }[]} existing={existing} connectedIds={agreements.map((a) => a.store_id)} />
    </div>
  );
}
