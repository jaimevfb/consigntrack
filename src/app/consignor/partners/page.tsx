import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConnectPartner, type ExistingAgreement } from "@/components/connect-partner";

export default async function ConsignorPartnersPage() {
  const { profile } = await requireProfile();
  if (!profile.consignor_id) return <p className="text-sm text-muted-foreground">No consignor scope.</p>;
  const supabase = createClient();
  const [{ data: ags }, { data: dir }] = await Promise.all([
    supabase.from("agreements").select("store_id, commission_pct, settlement_cadence, is_active, stores(name)").eq("consignor_id", profile.consignor_id),
    supabase.rpc("partner_directory", { p_kind: "store" }),
  ]);
  const agreements = (ags ?? []) as unknown as Array<{ store_id: string; commission_pct: number; settlement_cadence: string; is_active: boolean; stores: { name: string } | null }>;
  const existing: ExistingAgreement[] = agreements.map((a) => ({
    partnerName: a.stores?.name ?? "—",
    commission_pct: a.commission_pct,
    cadence: a.settlement_cadence,
    active: a.is_active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Store partners</h1>
        <p className="text-sm text-muted-foreground">Connect to stores that will carry your goods, and set the commission.</p>
      </div>
      <ConnectPartner
        perspective="consignor"
        selfId={profile.consignor_id}
        directory={(dir ?? []) as { id: string; name: string }[]}
        existing={existing}
        connectedIds={agreements.map((a) => a.store_id)}
      />
    </div>
  );
}
