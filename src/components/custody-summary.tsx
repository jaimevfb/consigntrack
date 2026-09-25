import Link from "next/link";
import { QrCode, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CustodySummary({
  counts,
  itemsHref,
}: {
  counts: Record<string, number>;
  itemsHref: string;
}) {
  const get = (...keys: string[]) => keys.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const cells = [
    { label: "Labeled", value: get("labeled", "created") },
    { label: "In transit", value: get("dispatched", "in_transit", "delivered") },
    { label: "In custody", value: get("received_confirmed", "listed") },
    { label: "Sold", value: get("sold", "settled") },
    { label: "Flagged", value: get("lost", "damaged", "returned_to_consignor", "disputed"), warn: true },
  ];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4 text-primary" /> Chain of custody
        </CardTitle>
        <Link href={itemsHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {total} tracked items <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 text-center">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg bg-muted/60 p-3">
              <div className={`tnum text-xl font-semibold ${c.warn && c.value > 0 ? "text-warn-foreground" : ""}`}>{c.value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
