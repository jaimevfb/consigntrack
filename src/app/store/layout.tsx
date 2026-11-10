import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "store_manager" && profile.role !== "store_staff" && profile.role !== "admin") {
    redirect("/");
  }

  const supabase = createClient();
  let scopeLabel = profile.role === "store_staff" ? "Store staff" : "Store manager";
  let incoming = 0;
  if (profile.store_id) {
    const [{ data: store }, { count }] = await Promise.all([
      supabase.from("stores").select("name").eq("id", profile.store_id).maybeSingle(),
      supabase.from("packages").select("id", { count: "exact", head: true }).eq("consignee_id", profile.store_id).eq("status", "IN_TRANSIT"),
    ]);
    if (store?.name) scopeLabel = store.name;
    incoming = count ?? 0;
  }

  const isManager = profile.role === "store_manager" || profile.role === "admin";
  const nav = [
    { href: "/store", label: "Dashboard", icon: "dashboard" },
    { href: "/store/deliveries", label: "Deliveries & Receiving", icon: "deliveries" },
    { href: "/store/sales", label: "Sales", icon: "sell" },
    { href: "/store/inventory", label: "Inventory & Catalog", icon: "inventory" },
    ...(isManager
      ? [
          { href: "/store/returns", label: "Returns", icon: "returns" },
          { href: "/store/settlements", label: "Partners & Settlements", icon: "settlements" },
        ]
      : []),
  ];

  return (
    <AppShell
      role={profile.role}
      userName={profile.full_name}
      scopeLabel={scopeLabel}
      nav={nav}
      alertCount={incoming}
      alertHref="/store/deliveries"
    >
      {children}
    </AppShell>
  );
}
