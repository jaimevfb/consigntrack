import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConnectPartner, type ExistingAgreement } from "@/components/connect-partner";

export default async function StorePartnersPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  if (profile.role === "store_staff") redirect("/store");
  const supabase = createClient();
  const [{ data: ags }, { data: dir }] = await Promise.all([
    supabase.from("agreements").select("consignor_id, commission_pct, settlement_cadence, is_active, consignors(name)").eq("store_id", profile.store_id),
    supabase.rpc("partner_directory", { p_kind: "consignor" }),
  ]);
  const agreements = (ags ?? []) as unknown as Array<{ consignor_id: string; commission_pct: number; settlement_cadence: string; is_active: boolean; consignors: { name: string } | null }>;
  const existing: ExistingAgreement[] = agreements.map((a) => ({
    partnerName: a.consignors?.name ?? "—",
    commission_pct: a.commission_pct,
    cadence: a.settlement_cadence,
    active: a.is_active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Consignor partners</h1>
        <p className="text-sm text-muted-foreground">Connect consignors whose goods you’ll carry, and set each commission rate.</p>
      </div>
      <ConnectPartner
        perspective="consignee"
        selfId={profile.store_id}
        directory={(dir ?? []) as { id: string; name: string }[]}
        existing={existing}
        connectedIds={agreements.map((a) => a.consignor_id)}
      />
    </div>
  );
}
