"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { CustodyBar } from "@/components/custody-bar";
import { formatPHP, formatNumber } from "@/lib/utils";
import { unitLabel } from "@/lib/units";

export interface InvRow {
  sku_id: string; sku: string; name: string; unit_of_measure: string; unit_price: number;
  consignor_name: string; commission_pct: number; on_hand: number; in_dispute: number; sold: number;
}

type Bucket = 0 | 1 | 2 | 3; // disputed, low, in-stock, out
function bucket(r: InvRow): Bucket {
  if (r.in_dispute > 0) return 0;
  if (r.on_hand <= 0) return 3;
  if (r.on_hand <= 3) return 1;
  return 2;
}
function stockStatus(r: InvRow): { label: string; tone: "ok" | "warn" | "neutral" | "info" } {
  if (r.in_dispute > 0) return { label: "Disputed", tone: "warn" };
  if (r.on_hand <= 0) return { label: "Out of stock", tone: "neutral" };
  if (r.on_hand <= 3) return { label: "Low stock", tone: "info" };
  return { label: "In stock", tone: "ok" };
}

export function InventoryTable({ rows }: { rows: InvRow[] }) {
  const [showOOS, setShowOOS] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  // Attention sort: disputed → low → in-stock (value desc) → out-of-stock (collapsed)
  const sorted = [...rows].sort((a, b) => bucket(a) - bucket(b) || (b.on_hand * b.unit_price) - (a.on_hand * a.unit_price));
  const inView = sorted.filter((r) => bucket(r) !== 3);
  const oos = sorted.filter((r) => bucket(r) === 3);
  const list = showOOS ? [...inView, ...oos] : inView;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-6" />
            <th className="p-3 text-left font-medium">Product</th>
            <th className="p-3 text-right font-medium">On hand</th>
            <th className="p-3 text-right font-medium">Value</th>
            <th className="p-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const st = stockStatus(r);
            const isOpen = open[r.sku_id];
            return (
              <React.Fragment key={r.sku_id}>
                <tr className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => setOpen((o) => ({ ...o, [r.sku_id]: !o[r.sku_id] }))}>
                  <td className="pl-3 text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="tnum text-xs text-muted-foreground">{r.sku} · {r.consignor_name}</div>
                  </td>
                  <td className="tnum p-3 text-right font-medium">{r.on_hand}{r.in_dispute > 0 ? <span className="ml-1 text-xs text-warn-foreground">+{r.in_dispute} disp.</span> : null}</td>
                  <td className="tnum p-3 text-right">{formatPHP(r.on_hand * r.unit_price)}</td>
                  <td className="p-3"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                </tr>
                {isOpen ? (
                  <tr className="border-t border-border bg-muted/20">
                    <td />
                    <td colSpan={4} className="p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-medium text-muted-foreground">Where the goods are</div>
                          <CustodyBar segments={[
                            { key: "onhand", label: "On hand", value: r.on_hand },
                            { key: "disputed", label: "Disputed", value: r.in_dispute },
                            { key: "sold", label: "Sold (30d)", value: r.sold },
                          ]} />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>Unit: <span className="text-foreground">{unitLabel(r.unit_of_measure)}</span></div>
                          <div>Agreed price: <span className="tnum text-foreground">{formatPHP(r.unit_price)}</span></div>
                          <div>Store commission: <span className="tnum text-foreground">{r.commission_pct}%</span></div>
                          <div>Sold last 30 days: <span className="tnum text-foreground">{formatNumber(r.sold)}</span></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
          {list.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No stock yet.</td></tr> : null}
        </tbody>
      </table>
      {oos.length > 0 ? (
        <button onClick={() => setShowOOS((v) => !v)} className="w-full border-t border-border bg-muted/30 p-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60">
          {showOOS ? "Hide" : "Show"} {oos.length} out-of-stock item{oos.length === 1 ? "" : "s"}
        </button>
      ) : null}
    </div>
  );
}
