import { Receipt, AlertTriangle, ScanLine, Pencil, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SaleRecord } from "@/lib/ledger-data";
import { formatPHP, formatDateTime } from "@/lib/utils";

const SOURCE: Record<string, { label: string; icon: typeof ScanLine }> = {
  POS_SCAN: { label: "Scan", icon: ScanLine },
  MANUAL: { label: "Manual", icon: Pencil },
  CSV_IMPORT: { label: "Import", icon: FileUp },
};
function source(reason: string | null) {
  const base = (reason ?? "").split(" · ")[0];
  return SOURCE[base] ?? { label: base || "Sale", icon: Receipt };
}

export function SalesHistory({ sales }: { sales: SaleRecord[] }) {
  const today = sales.filter((s) => new Date(s.at).toDateString() === new Date().toDateString());
  const todayTotal = today.reduce((a, s) => a + s.total, 0);
  const todayUnits = today.reduce((a, s) => a + s.units, 0);
  const allTotal = sales.reduce((a, s) => a + s.total, 0);
  const allUnits = sales.reduce((a, s) => a + s.units, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-primary" /> Recent sales</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Today <span className="tnum font-semibold text-foreground">{formatPHP(todayTotal)}</span> · {todayUnits}u</span>
            <span className="hidden sm:inline">Shown <span className="tnum font-semibold text-foreground">{formatPHP(allTotal)}</span> · {sales.length} sale{sales.length === 1 ? "" : "s"} · {allUnits}u</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No sales recorded yet. Scan or add a product, then Record sale.</p>
        ) : (
          <div className="space-y-2.5">
            {sales.map((s, i) => {
              const src = source(s.source);
              const Icon = src.icon;
              return (
                <div key={i} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"><Icon className="h-3 w-3" /> {src.label}</span>
                      <span className="truncate text-sm font-medium">{formatDateTime(s.at)}</span>
                      {s.flagged ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-warn/30 px-1.5 py-0.5 text-[11px] text-warn-foreground"><AlertTriangle className="h-3 w-3" /> price edit</span> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="tnum text-sm font-bold">{formatPHP(s.total)}</span>
                      <span className="tnum ml-2 text-xs text-muted-foreground">{s.units}u · {s.lines.length} item{s.lines.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border/60">
                      {s.lines.map((l, j) => (
                        <tr key={j}>
                          <td className="px-3 py-1.5"><span className="font-medium">{l.name}</span> <span className="tnum text-xs text-muted-foreground">{l.sku}</span></td>
                          <td className="tnum whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted-foreground">{l.qty} × {formatPHP(l.unit_price)}</td>
                          <td className="tnum w-24 px-3 py-1.5 text-right font-medium">{formatPHP(l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
