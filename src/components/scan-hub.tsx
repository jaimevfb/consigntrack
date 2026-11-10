"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Camera, Undo2, ShoppingCart, Check, X, Trash2, CameraOff } from "lucide-react";
import { resolveScan, type ScanResult } from "@/app/_actions/scan";
import { dispatchPackageAction, receiveReturnPackage, posSale, type SaleLine } from "@/app/_actions/ledger-ops";
import { PackageManifestModal } from "@/components/package-manifest-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatPHP } from "@/lib/utils";

interface CartLine { sku_id: string; sku: string; name: string; unit_price: number; on_hand: number; qty: number }

export function ScanHub({ initialCode, storeId }: { initialCode?: string; storeId?: string | null }) {
  const router = useRouter();
  const [typed, setTyped] = React.useState("");
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [camState, setCamState] = React.useState<"off" | "on" | "error">("off");
  const [showTyped, setShowTyped] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const lock = React.useRef(false);
  const scannerRef = React.useRef<{ stop: () => Promise<void> } | null>(null);
  const failRef = React.useRef({ count: 0, last: 0 });
  const startedRef = React.useRef(false);

  // Confirm the scan, stop the camera, then bounce back to the list.
  const finishSuccess = React.useCallback((msg: string) => {
    setResult(null);
    setSuccess(msg);
    scannerRef.current?.stop?.().catch(() => {});
    setTimeout(() => router.push(storeId ? "/store/deliveries" : "/consignor/shipments"), 1800);
  }, [router, storeId]);

  const handle = React.useCallback(async (code: string) => {
    if (lock.current) return;
    lock.current = true;
    failRef.current.count = 0; // a QR was read — reset the fallback counter
    const r = await resolveScan(code);
    if (r.kind === "sku") {
      setCart((c) => {
        const ex = c.find((l) => l.sku_id === r.sku.sku_id);
        if (ex) return ex.qty >= r.sku.on_hand ? c : c.map((l) => (l.sku_id === r.sku.sku_id ? { ...l, qty: l.qty + 1 } : l));
        return [...c, { ...r.sku, qty: 1 }];
      });
      setFlash(`Added ${r.sku.sku}`);
      setTimeout(() => { setFlash(null); lock.current = false; }, 650);
      return;
    }
    if (r.kind === "error") {
      setResult(r);
      setTimeout(() => { setResult((cur) => (cur === r ? null : cur)); lock.current = false; }, 2200);
      return;
    }
    if (r.kind === "dispatch") {
      // The scan IS the dispatch — no confirm button. Flip it immediately.
      const res = await dispatchPackageAction(r.id);
      if (!res.ok) {
        const er: ScanResult = { kind: "error", message: res.error };
        setResult(er);
        setTimeout(() => { setResult((cur) => (cur === er ? null : cur)); lock.current = false; }, 2500);
      } else {
        router.refresh();
        finishSuccess(`Dispatched ${r.pkg_code} → ${r.store_name}`);
      }
      return;
    }
    setResult(r); // return / receive — stays until the user resolves
  }, [router, finishSuccess]);

  const startCamera = React.useCallback(async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const h = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = h;
      await h.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } },
        (decoded: string) => { failRef.current.count = 0; handle(decoded); },
        () => {
          // Reveal the typed fallback only after the scanner fails ~3 times.
          const now = Date.now();
          if (now - failRef.current.last > 2500) {
            failRef.current.last = now;
            failRef.current.count += 1;
            if (failRef.current.count >= 3) setShowTyped(true);
          }
        });
      setCamState("on");
    } catch {
      setCamState("error");
      setShowTyped(true); // camera unavailable → typing is the only way
    }
  }, [handle]);

  async function stopCamera() {
    try { await scannerRef.current?.stop(); } catch { /* ignore */ }
    scannerRef.current = null; setCamState("off");
  }

  // Deep link: resolve the ?code= on mount.
  React.useEffect(() => { if (initialCode) handle(initialCode); }, [initialCode, handle]);
  // Camera-first: start it automatically.
  React.useEffect(() => { if (!startedRef.current) { startedRef.current = true; startCamera(); } }, [startCamera]);
  React.useEffect(() => () => { scannerRef.current?.stop?.().catch(() => {}); }, []);

  function onTyped(e: React.FormEvent) { e.preventDefault(); const c = typed.trim(); setTyped(""); if (c) handle(c); }

  function closeResult() { setResult(null); lock.current = false; }

  const cartTotal = cart.reduce((a, l) => a + l.qty * l.unit_price, 0);
  async function recordSale() {
    if (cart.length === 0 || !storeId) return;
    setBusy(true);
    const lines: SaleLine[] = cart.map((l) => ({ sku_id: l.sku_id, qty: l.qty, unit_price: l.unit_price }));
    const res = await posSale(storeId, lines, "POS_SCAN");
    setBusy(false);
    if (!res.ok) { setResult({ kind: "error", message: res.error }); return; }
    setCart([]); setFlash("Sale recorded"); router.refresh();
    setTimeout(() => setFlash(null), 1200);
  }

  if (success) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 animate-in items-center justify-center rounded-full bg-ok text-ok-foreground"><Check className="h-8 w-8" /></span>
            <div className="text-lg font-semibold">{success}</div>
            <p className="text-sm text-muted-foreground">Scanned — taking you back…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Camera viewport */}
      <Card>
        <CardContent className="pt-5">
          <div className="relative overflow-hidden rounded-xl bg-foreground/5">
            <div id="qr-reader" className="mx-auto w-full [&_video]:rounded-xl" />
            {camState !== "on" ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                {camState === "error" ? <CameraOff className="h-8 w-8 text-muted-foreground" /> : <Camera className="h-8 w-8 text-muted-foreground" />}
                <p className="max-w-xs text-sm text-muted-foreground">
                  {camState === "error" ? "Camera unavailable or blocked." : "Point your camera at a package QR or a product barcode."}
                </p>
                {camState !== "error" ? <Button onClick={startCamera}><Camera className="h-4 w-4" /> Start camera</Button> : null}
              </div>
            ) : (
              <button onClick={stopCamera} className="absolute right-2 top-2 z-10 rounded-full bg-foreground/60 p-1.5 text-background"><X className="h-4 w-4" /></button>
            )}
          </div>

          {showTyped ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-muted-foreground">{camState === "error" ? "Camera unavailable — type the code instead." : "Having trouble scanning? Type the code."}</p>
              <form onSubmit={onTyped} className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="PKG- / RET- code or product SKU" className="pl-8" autoFocus />
                </div>
                <Button type="submit" variant="outline">Go</Button>
              </form>
            </div>
          ) : null}
          {flash ? <p className="mt-2 flex items-center gap-1.5 text-sm text-ok-foreground"><Check className="h-4 w-4" /> {flash}</p> : null}
        </CardContent>
      </Card>

      {/* Sale cart (SKU scans accumulate here) */}
      {cart.length > 0 ? (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><ShoppingCart className="h-4 w-4 text-primary" /> Sale cart</div>
            <div className="space-y-2">
              {cart.map((l) => (
                <div key={l.sku_id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <Input type="number" min={1} max={l.on_hand} value={l.qty} onChange={(e) => setCart((c) => c.map((x) => x.sku_id === l.sku_id ? { ...x, qty: Math.max(1, Math.min(Number(e.target.value), l.on_hand)) } : x))} className="h-8 w-16 text-right tnum" />
                  <span className="tnum w-20 text-right">{formatPHP(l.qty * l.unit_price)}</span>
                  <button aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.sku_id !== l.sku_id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2"><span className="text-sm text-muted-foreground">Total</span><span className="tnum text-lg font-bold">{formatPHP(cartTotal)}</span></div>
            </div>
            <Button className="mt-3 w-full" disabled={busy} onClick={recordSale}>{busy ? "Recording…" : "Record sale"}</Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Action results */}
      {result?.kind === "error" ? (
        <Card><CardContent className="flex items-center gap-2 py-4 text-sm text-destructive"><X className="h-4 w-4" /> {result.message}</CardContent></Card>
      ) : null}

      {result?.kind === "return" ? (
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-2 text-sm"><Undo2 className="h-4 w-4 text-primary" /> Receive <strong>{result.pkg_code}</strong> ← {result.store_name} ({result.units} units) into your warehouse?</div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={async () => {
              setBusy(true);
              const res = await receiveReturnPackage(result.id, result.lines.map((l) => ({ line_id: l.line_id, qty_received: l.qty_expected })));
              setBusy(false);
              if (!res.ok) { setResult({ kind: "error", message: res.error }); return; }
              router.refresh(); finishSuccess(`Return ${result.pkg_code} received`);
            }}>{busy ? "Receiving…" : "Confirm received"}</Button>
            <Button variant="ghost" onClick={closeResult}>Cancel</Button>
          </div>
        </CardContent></Card>
      ) : null}

      {result?.kind === "receive" ? (
        <PackageManifestModal
          pkg={{ id: result.package.id, pkg_code: result.package.pkg_code, consignor_name: result.package.consignor_name, units: result.package.units, lines: result.package.lines }}
          onClose={closeResult}
          onDone={() => finishSuccess(`${result.package.pkg_code} received`)}
        />
      ) : null}
    </div>
  );
}
