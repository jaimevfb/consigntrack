"use client";

import * as React from "react";
import { Receipt, AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SaleRecord } from "@/lib/ledger-data";
import { formatPHP, formatDate, phDateKey, PH_TZ } from "@/lib/utils";

const shortTime = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: PH_TZ });
const isToday = (iso: string) => phDateKey(iso) === phDateKey(new Date());

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
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-primary" /> Sales records</CardTitle>
          {today.length > 0 ? (
            <span className="text-xs text-muted-foreground">Today <span className="tnum font-semibold text-foreground">{formatPHP(todayTotal)}</span> · {todayUnits} units</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No sales recorded yet. Scan or add a product, then Record sale.</p>
        ) : (
          <div className="space-y-6">
            {groups.map((g, gi) => {
              const daySubtotal = g.items.reduce((a, s) => a + s.total, 0);
              return (
                <div key={gi}>
                  <div className="mb-1 flex items-baseline justify-between border-b border-border px-2 pb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</span>
                    <span className="tnum text-xs text-muted-foreground">{g.items.length} sale{g.items.length === 1 ? "" : "s"} · <span className="font-semibold text-foreground">{formatPHP(daySubtotal)}</span></span>
                  </div>
                  <div className="divide-y divide-border">
                    {g.items.map((s) => {
                      const expanded = open.has(s.at);
                      const summary = s.lines.length === 1 ? `${s.lines[0].name} ×${s.lines[0].qty}` : `${s.lines[0].name} + ${s.lines.length - 1} more`;
                      return (
                        <div key={s.at}>
                          <button onClick={() => toggle(s.at)} className="flex w-full items-center gap-4 rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-muted/40">
                            <span className="tnum w-20 shrink-0 text-sm text-muted-foreground">{shortTime(s.at)}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{summary}</span>
                            {s.flagged ? <AlertTriangle className="h-4 w-4 shrink-0 text-warn-foreground" /> : null}
                            <span className="tnum shrink-0 text-base font-semibold">{formatPHP(s.total)}</span>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </button>
                          {expanded ? (
                            <div className="mb-2 space-y-1.5 rounded-lg bg-muted/30 px-3 py-3 sm:pl-[104px]">
                              {s.lines.map((l, j) => (
                                <div key={j} className="flex items-baseline justify-between gap-3 text-sm">
                                  <span className="min-w-0 truncate text-muted-foreground"><span className="font-medium text-foreground">{l.name}</span> · {l.qty} × {formatPHP(l.unit_price)}</span>
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
