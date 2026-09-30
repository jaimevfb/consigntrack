import Link from "next/link";
import { ScanLine, ShoppingCart, RotateCcw, PackageCheck, PackageMinus, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/kpi-tile";
import { ItemStatusPill } from "@/components/item-lifecycle";

export async function StaffDashboard({ storeId, name }: { storeId: string; name: string }) {
  const supabase = createClient();
  const [{ data: inbound }, { data: listed }, { data: low }, { data: products }] = await Promise.all([
    supabase.from("items").select("id, code, description, status").eq("store_id", storeId).in("status", ["dispatched", "in_transit", "delivered"]),
    supabase.from("items").select("id", { count: "exact", head: false }).eq("store_id", storeId).eq("status", "listed"),
    supabase.rpc("find_low_stock", { p_threshold: 5 }),
    supabase.from("products").select("id, name"),
  ]);
  const inboundRows = (inbound ?? []) as Array<{ id: string; code: string; description: string; status: string }>;
  const lowRows = (low ?? []) as Array<{ product_id: string }>;
  const productName = Object.fromEntries(((products ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const lowFirst = (low ?? []) as Array<{ product_id: string; qty_on_hand: number }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Hi {name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">Your tasks for today.</p>
      </div>

      {/* Big quick actions — one-handed on a phone */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction href="/store/scan" icon={ScanLine} label="Scan" primary />
        <QuickAction href="/store/sales" icon={ShoppingCart} label="Sell" />
        <QuickAction href="/store/returns" icon={RotateCcw} label="Return" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiTile icon={PackageCheck} label="To receive" value={String(inboundRows.length)} hint="Inbound shipments" tone={inboundRows.length > 0 ? "warn" : "default"} />
        <KpiTile icon={Tag} label="On shelves" value={String(listed?.length ?? 0)} hint="Listed for sale" />
        <KpiTile icon={PackageMinus} label="Low stock" value={String(lowRows.length)} hint="≤ 5 on hand" tone={lowRows.length > 0 ? "warn" : "default"} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">To receive</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/store/scan"><ScanLine className="h-4 w-4" /> Scan to receive</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {inboundRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nothing inbound. You’re all caught up.</p>
          ) : (
            <ul className="divide-y divide-border">
              {inboundRows.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium">{i.description}</div>
                    <div className="tnum text-xs text-muted-foreground">{i.code}</div>
                  </div>
                  <ItemStatusPill status={i.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {lowFirst.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {lowFirst.slice(0, 8).map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>{productName[r.product_id] ?? "Product"}</span>
                  <span className="tnum text-warn-foreground">{r.qty_on_hand} left</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-5 transition-colors ${
        primary ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
