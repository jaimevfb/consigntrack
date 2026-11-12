"use client";

import * as React from "react";

/**
 * Lightweight camera QR/barcode scanner. Decodes continuously and calls
 * onDecode(code) for each read, with a short re-arm gap so the same label
 * isn't fired twice. Safe teardown (html5-qrcode's stop() throws when idle).
 */
export function BarcodeScanner({ onDecode }: { onDecode: (code: string) => void }) {
  // keep the latest callback without re-initialising the camera
  const cbRef = React.useRef(onDecode);
  cbRef.current = onDecode;

  const scannerRef = React.useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const armedRef = React.useRef(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const h = new Html5Qrcode("sku-scanner", { verbose: false });
        scannerRef.current = h as unknown as { stop: () => Promise<void>; clear: () => void };
        armedRef.current = false;
        await h.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded: string) => {
            if (!armedRef.current) return;
            armedRef.current = false; // debounce the same code
            cbRef.current(decoded);
            window.setTimeout(() => { armedRef.current = true; }, 900);
          },
          () => { armedRef.current = true; },
        );
        window.setTimeout(() => { armedRef.current = true; }, 1200);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Camera unavailable — type the SKU instead.");
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) { s.stop().catch(() => {}); try { s.clear(); } catch { /* idle */ } }
    };
  }, []);

  return (
    <div className="space-y-2">
      <div id="sku-scanner" className="mx-auto w-full overflow-hidden rounded-xl border border-border [&_video]:rounded-xl" />
      {err ? <p className="text-xs text-destructive">{err}</p> : <p className="text-center text-xs text-muted-foreground">Point the camera at a product QR.</p>}
    </div>
  );
}
