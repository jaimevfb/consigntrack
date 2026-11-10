import Link from "next/link";
import { QrCode, ShoppingCart, PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

/** Store-staff view: task-focused, no financials. Scan a box, record a sale. */
export async function StaffDashboard({ storeId, name }: { storeId: string; name: string }) {
  const supabase = createClient();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [{ count: incoming }, { data: soldToday }] = await Promise.all([
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("consignee_id", storeId).eq("status", "IN_TRANSIT"),
    supabase.from("ledger_entries").select("qty").eq("consignee_id", storeId).eq("entry_type", "SALE").gte("created_at", todayStart.toISOString()),
  ]);
  const unitsSoldToday = ((soldToday ?? []) as { qty: number }[]).reduce((a, r) => a + -r.qty, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Hi, {name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Two jobs today: receive boxes and record sales.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div><div className="text-sm text-muted-foreground">Packages to receive</div><div className="tnum text-3xl font-bold">{formatNumber(incoming ?? 0)}</div></div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground"><PackageSearch className="h-5 w-5" /></span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div><div className="text-sm text-muted-foreground">Units sold today</div><div className="tnum text-3xl font-bold">{formatNumber(unitsSoldToday)}</div></div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground"><ShoppingCart className="h-5 w-5" /></span>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg" className="h-16 text-base"><Link href="/store/deliveries"><QrCode className="h-5 w-5" /> Scan package QR</Link></Button>
        <Button asChild size="lg" variant="outline" className="h-16 text-base"><Link href="/store/sales"><ShoppingCart className="h-5 w-5" /> Record a sale</Link></Button>
      </div>
    </div>
  );
}
