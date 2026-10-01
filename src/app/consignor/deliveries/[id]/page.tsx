import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanLine } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemsList } from "@/components/items-list";
import { DeliveryStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ItemRow } from "@/lib/items-data";

export default async function ConsignorDeliveryDetail({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = createClient();
  const [{ data: delivery }, { data: items }] = await Promise.all([
    supabase.from("deliveries").select("*, stores(name)").eq("id", params.id).maybeSingle(),
    supabase.from("items").select("*, stores(name), consignors(name)").eq("delivery_id", params.id).order("code"),
  ]);
  if (!delivery) notFound();
  const d = delivery as unknown as { id: string; delivery_date: string; status: string; stores: { name: string } | null };
  const rows = (items ?? []) as unknown as ItemRow[];
  const labeled = rows.filter((i) => i.status === "labeled").length;
  const dispatched = rows.filter((i) => ["dispatched", "in_transit", "delivered"].includes(i.status)).length;
  const received = rows.filter((i) => !["created", "labeled", "dispatched", "in_transit", "delivered"].includes(i.status)).length;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/consignor/deliveries"><ArrowLeft className="h-4 w-4" /> Back to deliveries</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">Delivery to {d.stores?.name}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(d.delivery_date)} · {rows.length} tracked items</p>
          </div>
          <DeliveryStatusPill status={d.status} />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div className="grid grid-cols-3 gap-6">
            <Stat label="To dispatch" value={labeled} />
            <Stat label="In transit" value={dispatched} />
            <Stat label="Received" value={received} />
          </div>
          {labeled > 0 ? (
            <Button asChild>
              <Link href="/consignor/scan"><ScanLine className="h-4 w-4" /> Scan to dispatch</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Each unit has a signed QR label (open an item to print it). Dispatch by scanning each QR on the <strong>Scan</strong> screen — the store confirms receipt by scanning the same codes.
        </p>
        <ItemsList items={rows} basePath="/consignor/items" party="consignor" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="tnum text-xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
