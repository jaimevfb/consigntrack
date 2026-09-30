import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductCatalog } from "@/components/product-catalog";
import type { Product } from "@/lib/types";

export default async function ConsignorProductsPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").order("name");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Product catalogue</h1>
        <p className="text-sm text-muted-foreground">
          Your products and prices. Price changes are logged to the audit trail and apply to new deliveries and sales.
        </p>
      </div>
      <ProductCatalog products={(data ?? []) as Product[]} />
    </div>
  );
}
