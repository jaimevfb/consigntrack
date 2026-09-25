import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  return (
    <AppShell
      role={profile.role}
      userName={profile.full_name}
      scopeLabel="Administrator"
      nav={[{ href: "/admin", label: "Overview", icon: "overview" }]}
    >
      {children}
    </AppShell>
  );
}
