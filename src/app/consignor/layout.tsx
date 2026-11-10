import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ConsignorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "consignor" && profile.role !== "admin") {
    redirect("/");
  }

  const supabase = createClient();
  let scopeLabel = "Consignor";
  let incoming = 0;
  if (profile.consignor_id) {
    const [{ data: c }, { count }] = await Promise.all([
      supabase.from("consignors").select("name").eq("id", profile.consignor_id).maybeSingle(),
      supabase.from("packages").select("id", { count: "exact", head: true }).eq("consignor_id", profile.consignor_id).eq("direction", "RETURN").eq("status", "RETURN_IN_TRANSIT"),
    ]);
    if (c?.name) scopeLabel = c.name;
    incoming = count ?? 0;
  }

  return (
    <AppShell
      role={profile.role}
      userName={profile.full_name}
      scopeLabel={scopeLabel}
      alertCount={incoming}
      alertHref="/consignor/shipments"
      nav={[
        { href: "/consignor", label: "Dashboard", icon: "dashboard" },
        { href: "/consignor/products", label: "Catalog", icon: "catalog" },
        { href: "/consignor/shipments", label: "Shipments", icon: "deliveries" },
        { href: "/consignor/partners", label: "Stores & Agreements", icon: "agreements" },
        { href: "/consignor/settlements", label: "Settlements", icon: "settlements" },
        { href: "/consignor/analytics", label: "Insights", icon: "analytics" },
      ]}
    >
      {children}
    </AppShell>
  );
}
