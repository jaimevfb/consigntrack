"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, Minus, Trash2, Check, Search, ShoppingCart, Camera, X, Barcode } from "lucide-react";
import { recordSale, lookupUnit, type SaleLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { formatPHP } from "@/lib/utils";

export interface SellableSku { sku_id: string; sku: string; name: string; unit_price: number; on_hand: number; consignor_name: string }
type SkuLine = { kind: "sku"; sku_id: string; sku: string; name: string; unit_price: number; on_hand: number; qty: number };
type PieceLine = { kind: "piece"; serial: string; sku_id: string; name: string; unit_price: number };
type CartLine = SkuLine | PieceLine;

// Strip an optional "CTSKU:" prefix; keep original case (serials are case-sensitive).
function cleanCode(raw: string) {
  return raw.trim().replace(/^ctsku:/i, "").trim();
}
const lineTotal = (l: CartLine) => (l.kind === "sku" ? l.qty * l.unit_price : l.unit_price);

export function SalesTerminal({ storeId, skus }: { storeId: string; skus: SellableSku[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [scan, setScan] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [camOpen, setCamOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [scanLog, setScanLog] = React.useState<{ id: number; kind: "ok" | "warn"; text: string }[]>([]);
  const [lastScan, setLastScan] = React.useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [fails, setFails] = React.useState(0); // consecutive failed scans → reveal typed fallback after 3

  // refs so the (stable) scan callback always sees the latest state
  const skusRef = React.useRef(skus); skusRef.current = skus;
  const cartRef = React.useRef(cart); cartRef.current = cart;
  const toastTimer = React.useRef<number | undefined>(undefined);
  const flashTimer = React.useRef<number | undefined>(undefined);
  const logId = React.useRef(0);

  const filtered = skus.filter((s) => `${s.name} ${s.sku}`.toLowerCase().includes(query.toLowerCase()));
  const total = cart.reduce((a, l) => a + lineTotal(l), 0);

  const flash = React.useCallback((kind: "ok" | "warn", text: string) => {
    setToast({ kind, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
    setScanLog((log) => [{ id: logId.current++, kind, text }, ...log].slice(0, 30));
    setFails((n) => (kind === "ok" ? 0 : n + 1)); // reset on a good read, count up on misses
    // prominent momentary indicator (the "it's been scanned" pulse)
    setLastScan({ kind, text });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setLastScan(null), 1400);
  }, []);

  function addSku(s: SellableSku) {
    setOk(false);
    setCart((c) => {
      const ex = c.find((l) => l.kind === "sku" && l.sku_id === s.sku_id) as SkuLine | undefined;
      if (ex) {
        if (ex.qty >= s.on_hand) return c;
        return c.map((l) => (l.kind === "sku" && l.sku_id === s.sku_id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { kind: "sku", sku_id: s.sku_id, sku: s.sku, name: s.name, unit_price: s.unit_price, on_hand: s.on_hand, qty: 1 }];
    });
  }

  // Every scan path (camera or typed) flows through here. Validates first, then
  // adds to the cart — nothing is sold until checkout.
  const resolveCode = React.useCallback(async (raw: string) => {
    const code = cleanCode(raw);
    if (!code) return;
    const hit = skusRef.current.find((s) => s.sku.toLowerCase() === code.toLowerCase());
    if (hit) { addSku(hit); flash("ok", `Added ${hit.name}`); return; }
    // a serialized piece label looks like <SKU>-<digits>
    if (/-\d{3,}$/.test(code)) {
      if (cartRef.current.some((l) => l.kind === "piece" && l.serial === code)) { flash("warn", `${code} is already in the cart`); return; }
      const res = await lookupUnit(code);
      if (!res.ok) { flash("warn", res.error); return; }
      if (!res.sku_id) { flash("warn", `Could not add ${code}`); return; }
      const sku_id = res.sku_id, name = res.name ?? "Piece", price = res.price ?? 0;
      setOk(false);
      setCart((c) => (c.some((l) => l.kind === "piece" && l.serial === code) ? c : [...c, { kind: "piece", serial: code, sku_id, name, unit_price: price }]));
      flash("ok", `Added ${name} · ${code}`);
      return;
    }
    flash("warn", `Unrecognized barcode: ${code}`);
  }, [flash]);

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    if (scan.trim()) void resolveCode(scan);
    setScan("");
  }

  function setQty(id: string, qty: number) {
    setCart((c) => c.map((l) => (l.kind === "sku" && l.sku_id === id ? { ...l, qty: Math.max(1, Math.min(qty, l.on_hand)) } : l)));
  }
  function removeSku(id: string) { setCart((c) => c.filter((l) => !(l.kind === "sku" && l.sku_id === id))); }
  function removePiece(serial: string) { setCart((c) => c.filter((l) => !(l.kind === "piece" && l.serial === serial))); }

  async function record() {
    setErr(null); setOk(false);
    if (cart.length === 0) return;
    setBusy(true);
    const skuLines: SaleLine[] = cart.filter((l): l is SkuLine => l.kind === "sku").map((l) => ({ sku_id: l.sku_id, qty: l.qty, unit_price: l.unit_price }));
    const serials = cart.filter((l): l is PieceLine => l.kind === "piece").map((l) => l.serial);
    const res = await recordSale(storeId, skuLines, serials);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setCart([]); setOk(true); router.refresh();
  }

  const cartCount = cart.reduce((a, l) => a + (l.kind === "sku" ? l.qty : 1), 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Products</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Scan a barcode to add to the cart, then <strong>Record sale</strong> to check out.</p>
            <Button type="button" size="lg" variant="default" className="mt-2 h-12 w-full gap-2 text-base" onClick={() => { setFails(0); setCamOpen(true); }}>
              <Camera className="h-5 w-5" /> Scan to cart
            </Button>
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
            <div className="max-h-[52vh] divide-y divide-border overflow-y-auto pr-2">
              {filtered.map((s) => (
                <div key={s.sku_id} className="flex w-full items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="tnum text-xs text-muted-foreground">{s.sku} · {s.on_hand} on hand</div>
                  </div>
                  <span className="tnum text-sm text-muted-foreground">{formatPHP(s.unit_price)}</span>
                </div>
              ))}
              {filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No sellable products match.</p> : null}
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground"><Barcode className="h-3.5 w-3.5" /> Items are added to the cart only by scanning their barcode.</p>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="h-4 w-4 text-primary" /> Cart {cartCount > 0 ? <span className="tnum rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{cartCount}</span> : null}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ShoppingCart className="h-7 w-7 text-muted-foreground/50" />
                Scan a product barcode to start a sale.
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                {cart.map((l) => l.kind === "sku" ? (
                  <div key={`sku:${l.sku_id}`} className="flex items-center gap-2">
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
                    <button aria-label="Remove" onClick={() => removeSku(l.sku_id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div key={`piece:${l.serial}`} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.name}</div>
                      <div className="tnum flex items-center gap-1 text-xs text-muted-foreground"><Barcode className="h-3 w-3" /> {l.serial}</div>
                    </div>
                    <span className="tnum w-20 text-right text-sm font-medium">{formatPHP(l.unit_price)}</span>
                    <button aria-label="Remove" onClick={() => removePiece(l.serial)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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
              <div className="flex items-center gap-2 text-base font-semibold"><Camera className="h-4 w-4 text-primary" /> Scan to cart</div>
              <div className="text-xs text-muted-foreground">Each valid scan is added to the cart — nothing is sold until you Record sale.</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close scanner" onClick={() => setCamOpen(false)}><X className="h-5 w-5" /></Button>
          </div>

          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto p-4 lg:flex-row lg:items-start lg:p-8">
            <div className="mx-auto w-full max-w-2xl lg:flex-1">
              {/* prominent scan indicator / pause */}
              <div className="mb-3 min-h-[3.25rem]">
                {lastScan ? (
                  <div className={`flex animate-[ct-float_0s] items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold ring-1 ${lastScan.kind === "ok" ? "bg-ok/40 text-ok-foreground ring-ok/40" : "bg-destructive/10 text-destructive ring-destructive/30"}`}>
                    {lastScan.kind === "ok" ? <Check className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}
                    <span className="min-w-0 truncate">{lastScan.text}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Waiting for a scan…</div>
                )}
              </div>
              <BarcodeScanner onDecode={resolveCode} />
              {fails >= 3 ? (
                <form onSubmit={onScan} className="mt-4">
                  <p className="mb-1.5 text-xs text-muted-foreground">Trouble scanning? Type the SKU or piece code instead.</p>
                  <div className="relative">
                    <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Type a code and press Enter" className="h-11 pl-9" autoFocus />
                  </div>
                </form>
              ) : null}
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

          <div className="flex items-center gap-3 border-t border-border p-4">
            <div className="text-sm text-muted-foreground">Cart: <span className="font-medium text-foreground">{cartCount} item{cartCount === 1 ? "" : "s"}</span> · <span className="tnum font-semibold text-foreground">{formatPHP(total)}</span></div>
            <Button className="ml-auto" variant="outline" onClick={() => setCamOpen(false)}>Done — review cart</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
