import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getAlerts } from "@/lib/data";

export default async function ConsignorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "consignor" && profile.role !== "admin") {
    redirect("/");
  }

  let scopeLabel = "Consignor";
  if (profile.consignor_id) {
    const supabase = createClient();
    const { data } = await supabase
      .from("consignors")
      .select("name")
      .eq("id", profile.consignor_id)
      .maybeSingle();
    if (data?.name) scopeLabel = data.name;
  }
  const alerts = await getAlerts();
  const alertCount = alerts.counts.overdue + alerts.counts.discrepancies + alerts.counts.aged + alerts.counts.low;

  return (
    <AppShell
      role={profile.role}
      userName={profile.full_name}
      scopeLabel={scopeLabel}
      alertCount={alertCount}
      alertHref="/consignor"
      nav={[
        { href: "/consignor", label: "Dashboard", icon: "dashboard" },
        { href: "/consignor/analytics", label: "Analytics", icon: "analytics" },
        { href: "/consignor/items", label: "Tracked items", icon: "items" },
        { href: "/consignor/products", label: "Products", icon: "products" },
        { href: "/consignor/partners", label: "Partners", icon: "agreements" },
        { href: "/consignor/deliveries", label: "Deliveries", icon: "deliveries" },
        { href: "/consignor/settlements", label: "Settlements", icon: "settlements" },
        { href: "/consignor/reports", label: "Reports", icon: "reports" },
      ]}
    >
      {children}
    </AppShell>
  );
}
