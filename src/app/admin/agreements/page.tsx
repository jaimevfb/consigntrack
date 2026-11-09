import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgreementsManager, type AgreementRow, type OverrideRow } from "@/components/agreements-manager";

export default async function AdminAgreementsPage() {
  await requireProfile();
  const supabase = createClient();
  const [{ data: agreements }, { data: consignors }, { data: stores }, { data: products }, { data: overrides }] =
    await Promise.all([
      supabase.from("agreements").select("*, consignors(name), stores(name)").order("created_at", { ascending: false }),
      supabase.from("consignors").select("id, name").order("name"),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("products").select("id, name, consignor_id").order("name"),
      supabase.from("commission_overrides").select("agreement_id, product_id, commission_pct"),
    ]);

  const rows: AgreementRow[] = ((agreements ?? []) as Array<{
    id: string; consignor_id: string; store_id: string; commission_pct: number; settlement_cadence: string; is_active: boolean;
    damage_liability: "consignor" | "store" | "shared"; damage_store_share_pct: number; consignment_period_days: number;
    end_of_period_action: "return" | "extend" | "discount"; grace_extend_days: number; markdown_pct: number; receipt_grace_days: number;
    consignors: { name: string } | null; stores: { name: string } | null;
  }>).map((a) => ({
    id: a.id,
    consignorId: a.consignor_id,
    consignorName: a.consignors?.name ?? "—",
    storeName: a.stores?.name ?? "—",
    commission_pct: a.commission_pct,
    settlement_cadence: a.settlement_cadence,
    is_active: a.is_active,
    damage_liability: a.damage_liability,
    damage_store_share_pct: a.damage_store_share_pct,
    consignment_period_days: a.consignment_period_days,
    end_of_period_action: a.end_of_period_action,
    grace_extend_days: a.grace_extend_days,
    markdown_pct: a.markdown_pct,
    receipt_grace_days: a.receipt_grace_days,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Agreements &amp; commissions</h1>
        <p className="text-sm text-muted-foreground">
          Set commission, settlement cadence, damage liability, consignment period, and end-of-period handling per
          consignor–store pair. Per-product commission overrides and commission changes are audited.
        </p>
      </div>
      <AgreementsManager
        agreements={rows}
        consignors={(consignors ?? []) as { id: string; name: string }[]}
        stores={(stores ?? []) as { id: string; name: string }[]}
        products={(products ?? []) as { id: string; name: string; consignor_id: string }[]}
        overrides={(overrides ?? []) as OverrideRow[]}
      />
    </div>
  );
}
