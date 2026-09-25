import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <AppShell
      role={profile.role}
      userName={profile.full_name}
      scopeLabel={scopeLabel}
      nav={[
        { href: "/consignor", label: "Dashboard" },
        { href: "/consignor/analytics", label: "Analytics" },
        { href: "/consignor/deliveries", label: "Deliveries" },
        { href: "/consignor/settlements", label: "Settlements" },
        { href: "/consignor/reports", label: "Reports" },
      ]}
    >
      {children}
    </AppShell>
  );
}
