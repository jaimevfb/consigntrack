import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductCatalog } from "@/components/product-catalog";
import type { Product } from "@/lib/types";

export default async function ConsignorProductsPage() {
  const { profile } = await requireProfile();
  const supabase = createClient();
  const [{ data }, { data: wh }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    profile.consignor_id
      ? supabase.from("v_warehouse_on_hand").select("sku_id, qty").eq("consignor_id", profile.consignor_id)
      : Promise.resolve({ data: [] as { sku_id: string; qty: number }[] }),
  ]);
  const stock = Object.fromEntries(((wh ?? []) as { sku_id: string; qty: number }[]).map((r) => [r.sku_id, r.qty]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Product catalogue</h1>
      </div>
      <ProductCatalog products={(data ?? []) as Product[]} stock={stock} />
    </div>
  );
}
