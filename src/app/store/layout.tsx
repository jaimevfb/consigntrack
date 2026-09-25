import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "store_manager" && profile.role !== "store_staff" && profile.role !== "admin") {
    redirect("/");
  }

  let scopeLabel = profile.role === "store_staff" ? "Store staff" : "Store manager";
  if (profile.store_id) {
    const supabase = createClient();
    const { data } = await supabase.from("stores").select("name").eq("id", profile.store_id).maybeSingle();
    if (data?.name) scopeLabel = data.name;
  }

  const isManager = profile.role === "store_manager" || profile.role === "admin";
  const nav = [
    { href: "/store", label: "Dashboard" },
    ...(isManager ? [{ href: "/store/analytics", label: "Analytics" }] : []),
    { href: "/store/sales", label: "Sell" },
    { href: "/store/deliveries", label: "Deliveries" },
    { href: "/store/inventory", label: "Inventory" },
    { href: "/store/returns", label: "Returns" },
    ...(isManager
      ? [
          { href: "/store/settlements", label: "Settlements" },
          { href: "/store/reports", label: "Reports" },
        ]
      : []),
  ];

  return (
    <AppShell role={profile.role} userName={profile.full_name} scopeLabel={scopeLabel} nav={nav}>
      {children}
    </AppShell>
  );
}
