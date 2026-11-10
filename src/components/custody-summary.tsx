import Link from "next/link";
import { Tag, Truck, PackageCheck, Banknote, ArrowRight, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stage {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
}

export function CustodySummary({
  counts,
  itemsHref,
}: {
  counts: Record<string, number>;
  itemsHref: string;
}) {
  const get = (...keys: string[]) => keys.reduce((a, k) => a + (counts[k] ?? 0), 0);

  const stages: Stage[] = [
    { key: "labeled", label: "Labeled", icon: Tag, value: get("labeled", "created") },
    { key: "transit", label: "In transit", icon: Truck, value: get("dispatched", "in_transit", "delivered") },
    { key: "custody", label: "In custody", icon: PackageCheck, value: get("received_confirmed", "listed") },
    { key: "sold", label: "Sold", icon: Banknote, value: get("sold", "settled") },
  ];
  const flagged = get("lost", "damaged", "returned_to_consignor", "disputed");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const flowTotal = stages.reduce((a, s) => a + s.value, 0) || 1;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Chain of custody</CardTitle>
          <p className="text-xs text-muted-foreground">Where every tracked item sits in the consignment journey.</p>
        </div>
        <Link href={itemsHref} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground">
          {total} tracked items <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage flow — reads left to right as the item's journey. */}
        <div className="flex items-stretch gap-1.5">
          {stages.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center gap-1.5">
              <div className="flex-1 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <s.icon className="h-4 w-4" />
                  <span className="text-[11px] font-medium uppercase tracking-wide">{s.label}</span>
                </div>
                <div className="tnum mt-1.5 text-2xl font-semibold">{s.value}</div>
              </div>
              {i < stages.length - 1 ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" /> : null}
            </div>
          ))}
        </div>

        {/* Proportion bar — distribution across stages at a glance. */}
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {stages.map((s) => (
            <div
              key={s.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(s.value / flowTotal) * 100}%`,
                background:
                  s.key === "sold"
                    ? "var(--ok-foreground)"
                    : s.key === "custody"
                      ? "var(--primary)"
                      : s.key === "transit"
                        ? "var(--muted-foreground)"
                        : "var(--border)",
              }}
            />
          ))}
        </div>

        {flagged > 0 ? (
          <Link
            href={itemsHref}
            className="flex items-center justify-between rounded-lg bg-warn/50 px-3 py-2 text-sm text-warn-foreground transition-colors hover:bg-warn/70"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {flagged} item{flagged === 1 ? "" : "s"} flagged — lost, damaged, returned, or disputed
            </span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">No items are flagged — the whole chain is clean.</p>
        )}
      </CardContent>
    </Card>
  );
}
