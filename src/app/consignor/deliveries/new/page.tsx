import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewDeliveryForm } from "@/components/new-delivery-form";
import type { Agreement, Product } from "@/lib/types";

export default async function NewDeliveryPage() {
  await requireProfile();
  const supabase = createClient();

  const [{ data: agreements }, { data: products }] = await Promise.all([
    supabase
      .from("agreements")
      .select("*, stores(name)")
      .eq("is_active", true),
    supabase.from("products").select("*").order("name"),
  ]);

  const ags = (agreements ?? []) as Array<Agreement & { stores: { name: string } | null }>;
  const stores = ags.map((a) => ({
    agreementId: a.id,
    storeId: a.store_id,
    name: a.stores?.name ?? "Store",
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl">New consignment delivery</h1>
        <p className="text-sm text-muted-foreground">
          Pick a store, add product lines, and send it for the store to confirm.
        </p>
      </div>
      <NewDeliveryForm stores={stores} products={(products ?? []) as Product[]} />
    </div>
  );
}
