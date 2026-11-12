"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, Minus, Trash2, Check, Search, ShoppingCart, Camera, X, Zap } from "lucide-react";
import { posSale, sellUnit, type SaleLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { formatPHP } from "@/lib/utils";

export interface SellableSku { sku_id: string; sku: string; name: string; unit_price: number; on_hand: number; consignor_name: string }
interface CartLine extends SellableSku { qty: number }

// Strip an optional "CTSKU:" prefix; keep original case (serials are case-sensitive).
function cleanCode(raw: string) {
  return raw.trim().replace(/^ctsku:/i, "").trim();
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
  const [scanLog, setScanLog] = React.useState<{ id: number; kind: "ok" | "warn"; text: string }[]>([]);

  // refs so the (stable) camera callback always sees the latest state
  const skusRef = React.useRef(skus); skusRef.current = skus;
  const quickRef = React.useRef(quickSell); quickRef.current = quickSell;
  const toastTimer = React.useRef<number | undefined>(undefined);
  const logId = React.useRef(0);

  const filtered = skus.filter((s) => `${s.name} ${s.sku}`.toLowerCase().includes(query.toLowerCase()));

  const flash = React.useCallback((kind: "ok" | "warn", text: string) => {
    setToast({ kind, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
    setScanLog((log) => [{ id: logId.current++, kind, text }, ...log].slice(0, 30));
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

  // Sell one serialized piece immediately (its barcode encodes a unique serial).
  const sellPiece = React.useCallback(async (serial: string) => {
    const res = await sellUnit(serial);
    if (res.ok) { flash("ok", `Sold ${res.name ?? "piece"} · ${serial}`); router.refresh(); }
    else flash("warn", res.error);
  }, [flash, router]);

  // One place every scan path (camera or typed) flows through. Validates the
  // barcode before acting so only real SKUs / piece serials are accepted.
  const resolveCode = React.useCallback((raw: string) => {
    const code = cleanCode(raw);
    if (!code) return;
    const hit = skusRef.current.find((s) => s.sku.toLowerCase() === code.toLowerCase());
    if (hit) {
      // plain SKU barcode → cart (or quick-sell)
      if (quickRef.current) { void quickRecord(hit); } else { add(hit); flash("ok", `Added ${hit.name}`); }
      return;
    }
    // a serialized piece label looks like <SKU>-<4 digits>; anything else is rejected
    if (/-\d{3,}$/.test(code)) { void sellPiece(code); return; }
    flash("warn", `Unrecognized barcode: ${code}`);
  }, [flash, quickRecord, sellPiece]);

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
              <form onSubmit={onScan} className="relative flex-1">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan or type a SKU, press Enter" className="h-11 pl-9" />
              </form>
              <Button type="button" size="lg" variant="default" className="h-11 gap-2 px-7 text-base" onClick={() => { setScanLog([]); setCamOpen(true); }}>
                <Camera className="h-5 w-5" /> Scan
              </Button>
            </div>
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
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4 text-primary" /> Cart</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ShoppingCart className="h-7 w-7 text-muted-foreground/50" />
                Scan or tap a product to start a sale.
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto">
                {cart.map((l) => (
                  <div key={l.sku_id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.name}</div>
                      <div className="tnum text-xs text-muted-foreground">{formatPHP(l.unit_price)} · max {l.on_hand}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" aria-label="Decrease" disabled={l.qty <= 1} onClick={() => setQty(l.sku_id, l.qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                      <Input type="number" min={1} max={l.on_hand} value={l.qty} onChange={(e) => setQty(l.sku_id, Number(e.target.value))} className="h-7 w-10 px-1 text-center tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <button type="button" aria-label="Increase" disabled={l.qty >= l.on_hand} onClick={() => setQty(l.sku_id, l.qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <span className="tnum w-20 text-right text-sm font-medium">{formatPHP(l.qty * l.unit_price)}</span>
                    <button aria-label="Remove" onClick={() => remove(l.sku_id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            {cart.length > 0 ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="tnum text-xl font-bold">{formatPHP(total)}</span>
              </div>
            ) : null}
            {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
            {ok ? <p className="mt-3 flex items-center gap-1.5 rounded-md bg-ok/40 px-3 py-2 text-sm text-ok-foreground"><Check className="h-4 w-4" /> Sale recorded.</p> : null}
            <Button className="mt-4 w-full" disabled={busy || cart.length === 0} onClick={record}>{busy ? "Recording…" : "Record sale"}</Button>
          </CardContent>
        </Card>
      </div>

      {camOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base font-semibold"><Camera className="h-4 w-4 text-primary" /> Scan to sell</div>
              <div className="text-xs text-muted-foreground">{quickSell ? "Each valid scan records a sale instantly." : "Each valid scan is added to the cart."}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={quickSell ? "default" : "outline"} className="h-9 gap-1.5 text-xs" onClick={() => setQuickSell((v) => !v)} aria-pressed={quickSell}>
                <Zap className="h-3.5 w-3.5" /> Quick sell {quickSell ? "on" : "off"}
              </Button>
              <Button variant="ghost" size="icon" aria-label="Close scanner" onClick={() => setCamOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto p-4 lg:flex-row lg:items-start lg:p-8">
            <div className="mx-auto w-full max-w-2xl lg:flex-1">
              <BarcodeScanner onDecode={resolveCode} />
              <form onSubmit={onScan} className="relative mt-4">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="…or type a code and press Enter" className="h-11 pl-9" />
              </form>
            </div>

            <div className="w-full lg:w-80 lg:shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Scanned this session</span>
                {scanLog.length > 0 ? <button onClick={() => setScanLog([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button> : null}
              </div>
              <div className="space-y-1.5">
                {scanLog.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Point the camera at a product barcode — valid scans appear here.</p>
                ) : scanLog.map((l) => (
                  <div key={l.id} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${l.kind === "ok" ? "bg-ok/30 text-ok-foreground" : "bg-destructive/10 text-destructive"}`}>
                    {l.kind === "ok" ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />} <span className="min-w-0">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border p-4">
            <Button className="w-full" variant="outline" onClick={() => setCamOpen(false)}>Done</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
