"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Check } from "lucide-react";
import { recordSale } from "@/app/_actions/ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatPHP, cn } from "@/lib/utils";

export interface SellableItem {
  productId: string;
  consignorId: string;
  name: string;
  sku: string | null;
  price: number;
  consignorName: string;
  onHand: number;
}

export function SaleEntry({ storeId, items }: { storeId: string; items: SellableItem[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const byId = React.useMemo(() => Object.fromEntries(items.map((i) => [i.productId, i])), [items]);

  const filtered = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      (i.sku ?? "").toLowerCase().includes(q) ||
      i.consignorName.toLowerCase().includes(q)
    );
  });

  function add(item: SellableItem) {
    setDone(false);
    setError(null);
    setCart((prev) => {
      const cur = prev[item.productId] ?? 0;
      if (cur >= item.onHand) return prev; // never exceed on-hand (BR1, client guard)
      return { ...prev, [item.productId]: cur + 1 };
    });
  }
  function dec(productId: string) {
    setCart((prev) => {
      const cur = (prev[productId] ?? 0) - 1;
      const next = { ...prev };
      if (cur <= 0) delete next[productId];
      else next[productId] = cur;
      return next;
    });
  }

  const cartLines = Object.entries(cart).map(([productId, qty]) => ({ item: byId[productId], qty }));
  const total = cartLines.reduce((a, l) => a + (l.item?.price ?? 0) * l.qty, 0);
  const count = cartLines.reduce((a, l) => a + l.qty, 0);

  async function submit() {
    setError(null);
    setSaving(true);
    const res = await recordSale({
      store_id: storeId,
      lines: cartLines.map((l) => ({ product_id: l.item.productId, qty: l.qty })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCart({});
    setQuery("");
    setDone(true);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Item picker */}
      <div className="lg:col-span-3">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 text-base"
            placeholder="Search item, SKU, or consignor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sellable items"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((i) => {
            const inCart = cart[i.productId] ?? 0;
            const soldOut = inCart >= i.onHand;
            return (
              <button
                key={i.productId}
                type="button"
                onClick={() => add(i)}
                disabled={soldOut}
                className={cn(
                  "flex min-h-20 flex-col justify-between rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  inCart > 0 && "border-primary ring-1 ring-primary",
                )}
              >
                <div>
                  <div className="text-sm font-medium leading-tight">{i.name}</div>
                  <div className="text-xs text-muted-foreground">{i.consignorName}</div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="tnum text-sm font-medium">{formatPHP(i.price)}</span>
                  <span className="tnum text-xs text-muted-foreground">
                    {inCart > 0 ? `${inCart} in cart · ` : ""}
                    {i.onHand} left
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No sellable stock matches. Confirm a delivery first.
            </p>
          ) : null}
        </div>
      </div>

      {/* Cart — sticky on desktop, prominent on mobile */}
      <div className="lg:col-span-2">
        <Card className="lg:sticky lg:top-20">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">Current sale</h2>
              {count > 0 ? (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setCart({})}
                >
                  Clear
                </button>
              ) : null}
            </div>

            {cartLines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {done ? "Sale recorded. Ready for the next one." : "Tap items to add them."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {cartLines.map((l) => (
                  <li key={l.item.productId} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{l.item.name}</div>
                      <div className="tnum text-xs text-muted-foreground">
                        {formatPHP(l.item.price)} · {l.item.onHand} on hand
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => dec(l.item.productId)} aria-label="Decrease">
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="tnum w-6 text-center text-sm">{l.qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => add(l.item)}
                        disabled={l.qty >= l.item.onHand}
                        aria-label="Increase"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="tnum text-xl font-semibold">{formatPHP(total)}</span>
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : null}
            {done && !error ? (
              <p className="flex items-center gap-1.5 text-sm text-ok-foreground">
                <Check className="h-4 w-4" /> Sale recorded.
              </p>
            ) : null}

            <Button className="h-12 w-full text-base" disabled={count === 0 || saving} onClick={submit}>
              {saving ? "Recording…" : `Record sale · ${count} item${count === 1 ? "" : "s"}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
