import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getExceptionsQueue } from "@/lib/items-data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const openExceptions = (await getExceptionsQueue(true)).length;

  return (
    <AppShell
      role={profile.role}
      userName={profile.full_name}
      scopeLabel="Administrator"
      alertCount={openExceptions}
      alertHref="/admin/exceptions"
      nav={[
        { href: "/admin", label: "Overview", icon: "overview" },
        { href: "/admin/agreements", label: "Agreements", icon: "agreements" },
        { href: "/admin/exceptions", label: "Exceptions", icon: "exceptions" },
        { href: "/admin/items", label: "Items", icon: "items" },
      ]}
    >
      {children}
    </AppShell>
  );
}
