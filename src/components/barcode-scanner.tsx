"use client";

import * as React from "react";

/**
 * Lightweight camera QR/barcode scanner. Decodes continuously and calls
 * onDecode(code) for each read, with a short re-arm gap so the same label
 * isn't fired twice. Safe teardown (html5-qrcode's stop() throws when idle).
 */
export function BarcodeScanner({ onDecode, scannerId = "sku-scanner" }: { onDecode: (code: string) => void; scannerId?: string }) {
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
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const h = new Html5Qrcode(scannerId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });
        scannerRef.current = h as unknown as { stop: () => Promise<void>; clear: () => void };
        armedRef.current = false;
        await h.start(
          { facingMode: "environment" },
          {
            fps: 16,
            // Wide, landscape scan box — barcodes are wide, so a tall square hurts reads.
            qrbox: (vw: number, vh: number) => {
              const width = Math.max(180, Math.floor(vw * 0.82));
              const height = Math.max(120, Math.floor(Math.min(vh * 0.6, width * 0.46)));
              return { width, height };
            },
            aspectRatio: 1.3333,
            videoConstraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          (decoded: string) => {
            if (!armedRef.current) return;
            armedRef.current = false; // debounce the same code
            if (navigator.vibrate) { try { navigator.vibrate(40); } catch { /* unsupported */ } }
            cbRef.current(decoded);
            window.setTimeout(() => { armedRef.current = true; }, 800);
          },
          () => { armedRef.current = true; },
        );
        window.setTimeout(() => { armedRef.current = true; }, 1000);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Camera unavailable — type the code instead.");
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
      <div id={scannerId} className="mx-auto w-full overflow-hidden rounded-2xl border border-border bg-black [&_img]:hidden [&_video]:w-full [&_video]:rounded-2xl" />
      {err ? <p className="text-center text-xs text-destructive">{err}</p> : <p className="text-center text-xs text-muted-foreground">Center the barcode in the frame — it scans automatically.</p>}
    </div>
  );
}
