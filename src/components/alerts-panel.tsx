import { AlertTriangle, Clock, PackageMinus, TrendingDown, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { AlertItem, AlertsBundle } from "@/lib/data";

const meta: Record<AlertItem["kind"], { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  aged: { icon: Clock, label: "Aged stock" },
  low: { icon: PackageMinus, label: "Low stock" },
  shrinkage: { icon: TrendingDown, label: "Shrinkage" },
  overdue: { icon: CircleDollarSign, label: "Overdue" },
};

export function AlertsPanel({ alerts, title = "Alerts & discrepancies" }: { alerts: AlertsBundle; title?: string }) {
  const total = alerts.items.length;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warn-foreground" />
          {title}
        </CardTitle>
        <span className="tnum text-sm text-muted-foreground">{total}</span>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid grid-cols-4 gap-2 text-center">
          {(["overdue", "shrinkage", "aged", "low"] as const).map((k) => (
            <div key={k} className="rounded-md bg-muted/60 p-2">
              <div className={`tnum text-lg font-semibold ${alerts.counts[k === "shrinkage" ? "discrepancies" : k] > 0 ? "text-warn-foreground" : ""}`}>
                {alerts.counts[k === "shrinkage" ? "discrepancies" : k]}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta[k].label}</div>
            </div>
          ))}
        </div>
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            All clear — no discrepancies, aged stock, or overdue settlements.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.items.map((a, i) => {
              const M = meta[a.kind];
              return (
                <li key={i} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warn text-warn-foreground">
                    <M.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                  {a.when ? <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.when)}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
