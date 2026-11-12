import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductCatalog } from "@/components/product-catalog";
import type { Product } from "@/lib/types";

export default async function ConsignorProductsPage() {
  const { profile } = await requireProfile();
  const supabase = createClient();
  const [{ data }, { data: wh }, { data: units }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    profile.consignor_id
      ? supabase.from("v_warehouse_on_hand").select("sku_id, qty").eq("consignor_id", profile.consignor_id)
      : Promise.resolve({ data: [] as { sku_id: string; qty: number }[] }),
    profile.consignor_id
      ? supabase.from("product_units").select("product_id, status").eq("consignor_id", profile.consignor_id)
      : Promise.resolve({ data: [] as { product_id: string; status: string }[] }),
  ]);
  const stock = Object.fromEntries(((wh ?? []) as { sku_id: string; qty: number }[]).map((r) => [r.sku_id, r.qty]));

  // per-product barcode tallies
  const pieces: Record<string, { labeled: number; inStock: number; sold: number }> = {};
  for (const u of ((units ?? []) as { product_id: string; status: string }[])) {
    const p = (pieces[u.product_id] ??= { labeled: 0, inStock: 0, sold: 0 });
    p.labeled += 1;
    if (u.status === "in_stock") p.inStock += 1;
    else if (u.status === "sold") p.sold += 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Product catalogue</h1>
      </div>
      <ProductCatalog products={(data ?? []) as Product[]} stock={stock} pieces={pieces} />
    </div>
  );
}
