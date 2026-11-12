"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, Trash2, Check, Search, ShoppingCart, Camera, X, Zap } from "lucide-react";
import { posSale, type SaleLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { formatPHP } from "@/lib/utils";

export interface SellableSku { sku_id: string; sku: string; name: string; unit_price: number; on_hand: number; consignor_name: string }
interface CartLine extends SellableSku { qty: number }

// Accept a plain SKU, or a product-label QR payload like "CTSKU:MAR-0016".
function normalizeCode(raw: string) {
  return raw.trim().replace(/^ctsku:/i, "").trim().toLowerCase();
}

export function SalesTerminal({ storeId, skus }: { storeId: string; skus: SellableSku[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [scan, setScan] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [camOpen, setCamOpen] = React.useState(false);
  const [quickSell, setQuickSell] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  // refs so the (stable) camera callback always sees the latest state
  const skusRef = React.useRef(skus); skusRef.current = skus;
  const quickRef = React.useRef(quickSell); quickRef.current = quickSell;
  const toastTimer = React.useRef<number | undefined>(undefined);

  const filtered = skus.filter((s) => `${s.name} ${s.sku}`.toLowerCase().includes(query.toLowerCase()));

  const flash = React.useCallback((kind: "ok" | "warn", text: string) => {
    setToast({ kind, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  function add(s: SellableSku) {
    setOk(false);
    setCart((c) => {
      const existing = c.find((l) => l.sku_id === s.sku_id);
      if (existing) {
        if (existing.qty >= s.on_hand) return c;
        return c.map((l) => (l.sku_id === s.sku_id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { ...s, qty: 1 }];
    });
  }

  // Record a single unit immediately (quick-sell mode).
  const quickRecord = React.useCallback(async (s: SellableSku) => {
    const res = await posSale(storeId, [{ sku_id: s.sku_id, qty: 1, unit_price: s.unit_price }], "POS_SCAN");
    if (res.ok) { flash("ok", `Sold ${s.name} · ${formatPHP(s.unit_price)}`); router.refresh(); }
    else flash("warn", res.error);
  }, [storeId, flash, router]);

  // One place every scan path (camera or typed) flows through.
  const resolveCode = React.useCallback((raw: string) => {
    const code = normalizeCode(raw);
    const hit = skusRef.current.find((s) => s.sku.toLowerCase() === code);
    if (!hit) { flash("warn", `No sellable product for "${raw.trim()}"`); return; }
    if (quickRef.current) { void quickRecord(hit); }
    else { add(hit); flash("ok", `Added ${hit.name}`); }
  }, [flash, quickRecord]);

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    if (scan.trim()) resolveCode(scan);
    setScan("");
  }

  function setQty(id: string, qty: number) {
    setCart((c) => c.map((l) => (l.sku_id === id ? { ...l, qty: Math.max(1, Math.min(qty, l.on_hand)) } : l)));
  }
  function remove(id: string) { setCart((c) => c.filter((l) => l.sku_id !== id)); }

  const total = cart.reduce((a, l) => a + l.qty * l.unit_price, 0);

  async function record() {
    setErr(null); setOk(false);
    if (cart.length === 0) return;
    setBusy(true);
    const lines: SaleLine[] = cart.map((l) => ({ sku_id: l.sku_id, qty: l.qty, unit_price: l.unit_price }));
    const res = await posSale(storeId, lines, "POS_SCAN");
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setCart([]); setOk(true); router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Products</CardTitle>
              <Button size="sm" variant={quickSell ? "default" : "outline"} className="h-8 gap-1.5 text-xs" onClick={() => setQuickSell((v) => !v)} aria-pressed={quickSell}>
                <Zap className="h-3.5 w-3.5" /> Quick sell {quickSell ? "on" : "off"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{quickSell ? "Each scan is recorded as a sale instantly." : "Scans build a cart — review, then Record sale."}</p>
            <div className="mt-2 flex gap-2">
              <form onSubmit={onScan} className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan or type a SKU, press Enter" className="pl-8" />
                </div>
                <Button type="submit" variant="outline">Add</Button>
              </form>
              <Button type="button" variant={camOpen ? "default" : "outline"} className="gap-1.5" onClick={() => setCamOpen((v) => !v)}>
                {camOpen ? <><X className="h-4 w-4" /> Close</> : <><Camera className="h-4 w-4" /> Scan</>}
              </Button>
            </div>
            {camOpen ? <div className="mt-3"><BarcodeScanner onDecode={resolveCode} /></div> : null}
            {toast ? (
              <div className={`mt-2 flex items-center gap-1.5 rounded-md px-3 py-2 text-sm ${toast.kind === "ok" ? "bg-ok/40 text-ok-foreground" : "bg-destructive/10 text-destructive"}`}>
                {toast.kind === "ok" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {toast.text}
              </div>
            ) : null}
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[52vh] divide-y divide-border overflow-y-auto">
              {filtered.map((s) => (
                <button key={s.sku_id} onClick={() => add(s)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="tnum text-xs text-muted-foreground">{s.sku} · {s.on_hand} on hand</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-sm">{formatPHP(s.unit_price)}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground"><Plus className="h-4 w-4" /></span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No sellable products match.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="sticky top-20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4 text-primary" /> Cart</CardTitle></CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Scan or tap a product to start a sale.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((l) => (
                  <div key={l.sku_id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.name}</div>
                      <div className="tnum text-xs text-muted-foreground">{formatPHP(l.unit_price)} · max {l.on_hand}</div>
                    </div>
                    <Input type="number" min={1} max={l.on_hand} value={l.qty} onChange={(e) => setQty(l.sku_id, Number(e.target.value))} className="h-8 w-16 text-right tnum" />
                    <span className="tnum w-20 text-right text-sm font-medium">{formatPHP(l.qty * l.unit_price)}</span>
                    <button aria-label="Remove" onClick={() => remove(l.sku_id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="tnum text-xl font-bold">{formatPHP(total)}</span>
                </div>
              </div>
            )}
            {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
            {ok ? <p className="mt-3 flex items-center gap-1.5 rounded-md bg-ok/40 px-3 py-2 text-sm text-ok-foreground"><Check className="h-4 w-4" /> Sale recorded.</p> : null}
            <Button className="mt-4 w-full" disabled={busy || cart.length === 0} onClick={record}>{busy ? "Recording…" : "Record sale"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
