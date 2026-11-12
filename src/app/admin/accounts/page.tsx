import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountsManager, type AccountRow, type ConsignorOption } from "@/components/accounts-manager";

export const metadata = { title: "Accounts" };

export default async function AdminAccountsPage() {
  await requireProfile();
  const supabase = createClient();

  const [{ data: consignors }, { data: stores }, { data: agreements }, { data: appUsers }] = await Promise.all([
    supabase.from("consignors").select("id, name, contact").order("name"),
    supabase.from("stores").select("id, name, contact").order("name"),
    supabase.from("agreements").select("consignor_id, store_id, is_active"),
    supabase.from("app_users").select("consignor_id, store_id"),
  ]);

  const consignorList = ((consignors ?? []) as { id: string; name: string; contact: string | null }[]);
  const storeList = ((stores ?? []) as { id: string; name: string; contact: string | null }[]);
  const agr = ((agreements ?? []) as { consignor_id: string; store_id: string; is_active: boolean }[]);
  const users = ((appUsers ?? []) as { consignor_id: string | null; store_id: string | null }[]);
  // an account is live only while a sign-in is still mapped to it
  const activeConsignors = new Set(users.map((u) => u.consignor_id).filter(Boolean) as string[]);
  const activeStores = new Set(users.map((u) => u.store_id).filter(Boolean) as string[]);

  const consignorName = Object.fromEntries(consignorList.map((c) => [c.id, c.name]));

  const consignorRows: AccountRow[] = consignorList.map((c) => ({
    kind: "consignor",
    id: c.id,
    name: c.name,
    email: c.contact,
    connectedTo: null,
    connections: agr.filter((a) => a.consignor_id === c.id && a.is_active).length,
    active: activeConsignors.has(c.id),
  }));

  const storeRows: AccountRow[] = storeList.map((s) => {
    const link = agr.find((a) => a.store_id === s.id && a.is_active);
    return {
      kind: "store",
      id: s.id,
      name: s.name,
      email: s.contact,
      connectedTo: link ? (consignorName[link.consignor_id] ?? null) : null,
      connections: 0,
      active: activeStores.has(s.id),
    };
  });

  const options: ConsignorOption[] = consignorList.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Issue consignor and consignee sign-ins. Accounts are admin-provisioned only — there is no
          public sign-up.
        </p>
      </div>
      <AccountsManager consignors={options} rows={[...consignorRows, ...storeRows]} />
    </div>
  );
}
