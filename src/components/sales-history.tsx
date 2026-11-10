"use client";

import * as React from "react";
import { Receipt, AlertTriangle, ScanLine, Pencil, FileUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SaleRecord } from "@/lib/ledger-data";
import { formatPHP, formatDate } from "@/lib/utils";

const SOURCE: Record<string, { label: string; icon: typeof ScanLine }> = {
  POS_SCAN: { label: "Scan", icon: ScanLine },
  MANUAL: { label: "Manual", icon: Pencil },
  CSV_IMPORT: { label: "Import", icon: FileUp },
};
function source(reason: string | null) {
  const base = (reason ?? "").split(" · ")[0];
  return SOURCE[base] ?? { label: base || "Sale", icon: Receipt };
}
const shortTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function SalesHistory({ sales }: { sales: SaleRecord[] }) {
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const today = sales.filter((s) => isToday(s.at));
  const todayTotal = today.reduce((a, s) => a + s.total, 0);
  const todayUnits = today.reduce((a, s) => a + s.units, 0);

  // group by day, preserving the newest-first order
  const groups: { label: string; items: SaleRecord[] }[] = [];
  for (const s of sales) {
    const label = isToday(s.at) ? "Today" : formatDate(s.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(s);
    else groups.push({ label, items: [s] });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-primary" /> Recent sales</CardTitle>
          {today.length > 0 ? (
            <span className="text-xs text-muted-foreground">Today <span className="tnum font-semibold text-foreground">{formatPHP(todayTotal)}</span> · {todayUnits} units</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No sales recorded yet. Scan or add a product, then Record sale.</p>
        ) : (
          <div className="mx-auto max-w-2xl">
            {groups.map((g, gi) => (
              <div key={gi} className="mb-1.5 last:mb-0">
                <div className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                <div className="overflow-hidden rounded-xl border border-border">
                  {g.items.map((s) => {
                    const src = source(s.source);
                    const Icon = src.icon;
                    const expanded = open.has(s.at);
                    const summary = s.lines.length === 1 ? `${s.lines[0].name} ×${s.lines[0].qty}` : `${s.lines[0].name} + ${s.lines.length - 1} more`;
                    return (
                      <div key={s.at} className="border-b border-border last:border-0">
                        <button onClick={() => toggle(s.at)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
                          <span className="tnum w-16 shrink-0 text-xs text-muted-foreground">{shortTime(s.at)}</span>
                          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex"><Icon className="h-3 w-3" /> {src.label}</span>
                          <span className="min-w-0 flex-1 truncate text-sm">{summary}</span>
                          {s.flagged ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn-foreground" /> : null}
                          <span className="tnum shrink-0 text-xs text-muted-foreground">{s.units}u</span>
                          <span className="tnum shrink-0 text-sm font-semibold">{formatPHP(s.total)}</span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                        {expanded ? (
                          <div className="space-y-1 bg-muted/20 px-3 pb-2.5 pt-1">
                            {s.lines.map((l, j) => (
                              <div key={j} className="flex items-baseline justify-between gap-3 pl-16 text-sm">
                                <span className="min-w-0 truncate text-muted-foreground"><span className="font-medium text-foreground">{l.name}</span> · {l.sku} · {l.qty} × {formatPHP(l.unit_price)}</span>
                                <span className="tnum shrink-0 font-medium">{formatPHP(l.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
