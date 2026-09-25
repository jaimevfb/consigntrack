import Link from "next/link";
import { ScanLine } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getItems } from "@/lib/items-data";
import { ItemsList } from "@/components/items-list";
import { Button } from "@/components/ui/button";

export default async function StoreItemsPage() {
  await requireProfile();
  const items = await getItems();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Tracked items</h1>
          <p className="text-sm text-muted-foreground">Serialized units in or bound for your custody.</p>
        </div>
        <Button asChild>
          <Link href="/store/scan">
            <ScanLine className="h-4 w-4" /> Scan
          </Link>
        </Button>
      </div>
      <ItemsList items={items} basePath="/store/items" party="store" />
    </div>
  );
}
