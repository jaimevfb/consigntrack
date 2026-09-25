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
    { href: "/store", label: "Dashboard", icon: "dashboard" },
    ...(isManager ? [{ href: "/store/analytics", label: "Analytics", icon: "analytics" }] : []),
    { href: "/store/scan", label: "Scan", icon: "scan" },
    { href: "/store/items", label: "Tracked items", icon: "items" },
    { href: "/store/sales", label: "Sell", icon: "sell" },
    { href: "/store/deliveries", label: "Deliveries", icon: "deliveries" },
    { href: "/store/inventory", label: "Inventory", icon: "inventory" },
    { href: "/store/returns", label: "Returns", icon: "returns" },
    ...(isManager
      ? [
          { href: "/store/settlements", label: "Settlements", icon: "settlements" },
          { href: "/store/reports", label: "Reports", icon: "reports" },
        ]
      : []),
  ];

  return (
    <AppShell role={profile.role} userName={profile.full_name} scopeLabel={scopeLabel} nav={nav}>
      {children}
    </AppShell>
  );
}
