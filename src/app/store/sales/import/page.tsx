import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SalesImport, type ImportProduct } from "@/components/sales-import";
import { Button } from "@/components/ui/button";

export default async function SalesImportPage() {
  const { profile } = await requireProfile();
  if (!profile.store_id) return <p className="text-sm text-muted-foreground">No store scope.</p>;
  const supabase = createClient();
  const { data } = await supabase.from("products").select("id, name, sku, unit_price").order("name");
  const products = ((data ?? []) as Array<{ id: string; name: string; sku: string | null; unit_price: number }>).map(
    (p): ImportProduct => ({ id: p.id, name: p.name, sku: p.sku, price: p.unit_price }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/store/sales">
            <ArrowLeft className="h-4 w-4" /> Back to sell
          </Link>
        </Button>
        <h1 className="text-2xl">Import sales</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-record sales from a point-of-sale or spreadsheet export. Stock and consignor attribution update automatically.
        </p>
      </div>
      <SalesImport storeId={profile.store_id} products={products} />
    </div>
  );
}
