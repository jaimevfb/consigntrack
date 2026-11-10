import { Receipt, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SaleRecord } from "@/lib/ledger-data";
import { formatPHP, formatDateTime } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = { POS_SCAN: "Scan", MANUAL: "Manual", CSV_IMPORT: "Import" };
function sourceLabel(reason: string | null) {
  if (!reason) return "Sale";
  const base = reason.split(" · ")[0];
  return SOURCE_LABEL[base] ?? base;
}

export function SalesHistory({ sales }: { sales: SaleRecord[] }) {
  const today = sales.filter((s) => new Date(s.at).toDateString() === new Date().toDateString());
  const todayTotal = today.reduce((a, s) => a + s.total, 0);
  const todayUnits = today.reduce((a, s) => a + s.units, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-primary" /> Recent sales</CardTitle>
          {today.length > 0 ? (
            <span className="text-xs text-muted-foreground">Today: <span className="tnum font-medium text-foreground">{formatPHP(todayTotal)}</span> · {todayUnits} units</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sales recorded yet. Scan or add a product, then Record sale.</p>
        ) : (
          <div className="divide-y divide-border">
            {sales.map((s, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatDateTime(s.at)}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{sourceLabel(s.source)}</span>
                      {s.flagged ? <span className="inline-flex items-center gap-0.5 text-[11px] text-warn-foreground"><AlertTriangle className="h-3 w-3" /> price</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.lines.map((l, j) => (
                        <span key={j} className="tnum rounded-md bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
                          {l.name} ×{l.qty}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tnum text-sm font-semibold">{formatPHP(s.total)}</div>
                    <div className="tnum text-xs text-muted-foreground">{s.units} unit{s.units === 1 ? "" : "s"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
