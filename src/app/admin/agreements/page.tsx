import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgreementsManager, type AgreementRow } from "@/components/agreements-manager";

export default async function AdminAgreementsPage() {
  await requireProfile();
  const supabase = createClient();
  const [{ data: agreements }, { data: consignors }, { data: stores }] = await Promise.all([
    supabase.from("agreements").select("*, consignors(name), stores(name)").order("created_at", { ascending: false }),
    supabase.from("consignors").select("id, name").order("name"),
    supabase.from("stores").select("id, name").order("name"),
  ]);

  const rows: AgreementRow[] = ((agreements ?? []) as Array<{
    id: string; consignor_id: string; store_id: string; commission_pct: number; settlement_cadence: string; is_active: boolean;
    consignors: { name: string } | null; stores: { name: string } | null;
  }>).map((a) => ({
    id: a.id,
    consignorName: a.consignors?.name ?? "—",
    storeName: a.stores?.name ?? "—",
    commission_pct: a.commission_pct,
    settlement_cadence: a.settlement_cadence,
    is_active: a.is_active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Agreements &amp; commissions</h1>
        <p className="text-sm text-muted-foreground">
          Set commission rate and settlement cadence per consignor–store pair. Commission changes are audited.
        </p>
      </div>
      <AgreementsManager
        agreements={rows}
        consignors={(consignors ?? []) as { id: string; name: string }[]}
        stores={(stores ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
