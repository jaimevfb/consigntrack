"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { CustodyBar } from "@/components/custody-bar";
import { Input } from "@/components/ui/input";
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, SKU, consignor…" className="h-9 pl-8" autoCapitalize="none" />
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
        {/* Column header — desktop only; the mobile layout stacks its own labels */}
        <div className="hidden items-center gap-3 bg-muted/50 px-3 py-2.5 text-xs font-medium text-muted-foreground sm:flex">
          <span className="h-4 w-4 shrink-0" />
          <span className="flex-1">Product</span>
          <span className="w-32 shrink-0 text-right">On hand</span>
          <span className="w-24 shrink-0 text-right">Value</span>
          <span className="w-24 shrink-0">Status</span>
        </div>

        <div className="divide-y divide-border">
          {list.map((r) => {
            const st = stockStatus(r);
            const isOpen = open[r.sku_id];
            const disputed = r.in_dispute > 0 ? (
              <span className="tnum rounded-full bg-warn/20 px-1.5 py-0.5 text-[10px] font-semibold text-warn-foreground">+{r.in_dispute} disputed</span>
            ) : null;
            return (
              <div key={r.sku_id}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [r.sku_id]: !o[r.sku_id] }))}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="shrink-0 text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>

                  {/* Product + (mobile) inline meta */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {r.photo_url ? <img src={r.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" /> : null}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="tnum truncate text-xs text-muted-foreground">{r.sku} · {r.consignor_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:hidden">
                        <span className="tnum font-medium text-foreground">{r.on_hand} on hand</span>
                        <span className="tnum text-muted-foreground">· {formatPHP(r.on_hand * r.unit_price)}</span>
                        {disputed}
                      </div>
                    </div>
                  </div>

                  {/* Desktop columns */}
                  <div className="hidden w-32 shrink-0 items-center justify-end gap-1.5 text-right sm:flex">
                    <span className="tnum font-medium">{r.on_hand}</span>{disputed}
                  </div>
                  <div className="tnum hidden w-24 shrink-0 text-right sm:block">{formatPHP(r.on_hand * r.unit_price)}</div>

                  {/* Status — both layouts (right-aligned on mobile) */}
                  <div className="shrink-0 sm:w-24"><StatusPill tone={st.tone}>{st.label}</StatusPill></div>
                </button>

                {isOpen ? (
                  <div className="border-t border-border bg-muted/20 p-3">
                    <div className="grid gap-4 sm:grid-cols-2 sm:items-stretch">
                      <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">Category</dt><dd className="text-right">{r.category}</dd>
                        <dt className="text-muted-foreground">Unit</dt><dd className="text-right">{unitLabel(r.unit_of_measure)}</dd>
                        <dt className="text-muted-foreground">Agreed price</dt><dd className="tnum text-right">{formatPHP(r.unit_price)}</dd>
                        <dt className="text-muted-foreground">Store commission</dt><dd className="tnum text-right">{r.commission_pct}%</dd>
                        <dt className="text-muted-foreground">Sold last 30 days</dt><dd className="tnum text-right">{formatNumber(r.sold)}</dd>
                      </dl>
                      <div className="flex flex-col justify-center rounded-lg border border-border bg-background/50 p-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">Where the goods are</div>
                        <CustodyBar segments={[
                          { key: "onhand", label: "On hand", value: r.on_hand },
                          { key: "disputed", label: "Disputed", value: r.in_dispute },
                          { key: "sold", label: "Sold (30d)", value: r.sold },
                        ]} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {list.length === 0 ? <div className="p-6 text-center text-muted-foreground">{query || filter !== "all" ? "Nothing matches." : "No stock yet."}</div> : null}
        </div>
        {filter === "all" && oos.length > 0 ? (
          <button onClick={() => setShowOOS((v) => !v)} className="w-full border-t border-border bg-muted/30 p-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60">
            {showOOS ? "Hide" : "Show"} {oos.length} out-of-stock item{oos.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
