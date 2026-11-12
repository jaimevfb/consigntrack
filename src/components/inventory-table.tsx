"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Package, Search } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { CustodyBar } from "@/components/custody-bar";
import { Input } from "@/components/ui/input";
import { ProductQrButton } from "@/components/product-qr-button";
import { formatPHP, formatNumber } from "@/lib/utils";
import { unitLabel } from "@/lib/units";

export interface InvRow {
  sku_id: string; sku: string; name: string; unit_of_measure: string; unit_price: number;
  consignor_name: string; commission_pct: number; on_hand: number; in_dispute: number; sold: number;
  category: string; photo_url: string | null;
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

type Filter = "all" | "in" | "low" | "disputed";

export function InventoryTable({ rows }: { rows: InvRow[] }) {
  const [showOOS, setShowOOS] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  const query = q.trim().toLowerCase();
  const matchesQ = (r: InvRow) => !query || `${r.name} ${r.sku} ${r.consignor_name} ${r.category}`.toLowerCase().includes(query);

  const counts = React.useMemo(() => {
    const base = rows.filter(matchesQ);
    return {
      all: base.filter((r) => bucket(r) !== 3).length,
      in: base.filter((r) => bucket(r) === 2).length,
      low: base.filter((r) => bucket(r) === 1).length,
      disputed: base.filter((r) => bucket(r) === 0).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query]);

  const base = rows.filter(matchesQ);
  // Attention sort: disputed → low → in-stock (value desc) → out-of-stock
  const sorted = [...base].sort((a, b) => bucket(a) - bucket(b) || (b.on_hand * b.unit_price) - (a.on_hand * a.unit_price));
  const oos = sorted.filter((r) => bucket(r) === 3);

  let list: InvRow[];
  if (filter === "all") list = showOOS ? sorted : sorted.filter((r) => bucket(r) !== 3);
  else if (filter === "in") list = sorted.filter((r) => bucket(r) === 2);
  else if (filter === "low") list = sorted.filter((r) => bucket(r) === 1);
  else list = sorted.filter((r) => bucket(r) === 0);

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "in", label: "In stock", n: counts.in },
    { key: "low", label: "Low", n: counts.low },
    { key: "disputed", label: "Disputed", n: counts.disputed },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, SKU, consignor…" className="h-9 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === c.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.label}<span className="tnum rounded-full bg-muted px-1.5 text-[10px]">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

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
                      <div className="flex items-center gap-3">
                        {r.photo_url
                          ? <img src={r.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
                          : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Package className="h-4 w-4" /></span>}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="tnum truncate text-xs text-muted-foreground">{r.sku} · {r.consignor_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="tnum p-3 text-right font-medium">{r.on_hand}{r.in_dispute > 0 ? <span className="ml-1 text-xs text-warn-foreground">+{r.in_dispute} disp.</span> : null}</td>
                    <td className="tnum p-3 text-right">{formatPHP(r.on_hand * r.unit_price)}</td>
                    <td className="p-3"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-t border-border bg-muted/20">
                      <td />
                      <td colSpan={4} className="p-3">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Where the goods are</div>
                            <CustodyBar segments={[
                              { key: "onhand", label: "On hand", value: r.on_hand },
                              { key: "disputed", label: "Disputed", value: r.in_dispute },
                              { key: "sold", label: "Sold (30d)", value: r.sold },
                            ]} />
                          </div>
                          <div>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                              <dt className="text-muted-foreground">Category</dt><dd className="text-right">{r.category}</dd>
                              <dt className="text-muted-foreground">Unit</dt><dd className="text-right">{unitLabel(r.unit_of_measure)}</dd>
                              <dt className="text-muted-foreground">Agreed price</dt><dd className="tnum text-right">{formatPHP(r.unit_price)}</dd>
                              <dt className="text-muted-foreground">Store commission</dt><dd className="tnum text-right">{r.commission_pct}%</dd>
                              <dt className="text-muted-foreground">Sold last 30 days</dt><dd className="tnum text-right">{formatNumber(r.sold)}</dd>
                            </dl>
                            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                              <ProductQrButton sku={r.sku} name={r.name} variant="button" />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
            {list.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{query || filter !== "all" ? "Nothing matches." : "No stock yet."}</td></tr> : null}
          </tbody>
        </table>
        {filter === "all" && oos.length > 0 ? (
          <button onClick={() => setShowOOS((v) => !v)} className="w-full border-t border-border bg-muted/30 p-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60">
            {showOOS ? "Hide" : "Show"} {oos.length} out-of-stock item{oos.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
