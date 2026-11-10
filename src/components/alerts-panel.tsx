import Link from "next/link";
import { AlertTriangle, Clock, PackageMinus, TrendingDown, CircleDollarSign, CheckCircle2, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { AlertItem, AlertsBundle } from "@/lib/data";

const meta: Record<AlertItem["kind"], { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  aged: { icon: Clock, label: "Aged stock" },
  low: { icon: PackageMinus, label: "Low stock" },
  shrinkage: { icon: TrendingDown, label: "Shrinkage" },
  overdue: { icon: CircleDollarSign, label: "Overdue" },
};

export function AlertsPanel({
  alerts,
  title = "Needs attention",
  maxItems = 4,
  moreHref = "/store/items",
}: {
  alerts: AlertsBundle;
  title?: string;
  maxItems?: number;
  moreHref?: string;
}) {
  const total = alerts.items.length;

  // One tidy summary line of counts; only non-zero categories draw the eye.
  const summary = (["overdue", "shrinkage", "aged", "low"] as const).map((k) => ({
    key: k,
    label: meta[k].label,
    value: alerts.counts[k === "shrinkage" ? "discrepancies" : k] ?? 0,
  }));

  const shown = alerts.items.slice(0, maxItems);
  const rest = total - shown.length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {total === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-ok-foreground" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warn-foreground" />
          )}
          {title}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          {summary.map((s) => (
            <span
              key={s.key}
              className={
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs " +
                (s.value > 0
                  ? "border-warn-foreground/30 bg-warn/50 text-warn-foreground"
                  : "border-border text-muted-foreground")
              }
            >
              <span className="tnum font-semibold">{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-2 text-sm text-ok-foreground">
            Everything&rsquo;s in order — no overdue settlements, aged stock, or discrepancies.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {shown.map((a, i) => {
                const M = meta[a.kind];
                return (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warn text-warn-foreground">
                      <M.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                    </div>
                    {a.when ? <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.when)}</span> : null}
                  </li>
                );
              })}
            </ul>
            {rest > 0 ? (
              <Link href={moreHref} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                {rest} more {rest === 1 ? "item" : "items"} <ArrowUpRight className="h-3 w-3" />
              </Link>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
