"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shows a printable QR for a product that encodes its SKU ("CTSKU:<sku>").
 * Print it, stick it on the product/shelf, and scan it at the store's Sales
 * terminal to record a sale. The terminal's scanner strips the CTSKU: prefix.
 */
export function ProductQrButton({ sku, name, variant = "icon" }: { sku: string; name: string; variant?: "icon" | "button" }) {
  const [open, setOpen] = React.useState(false);
  const value = `CTSKU:${sku}`;
  const domId = `pqr-${sku.replace(/[^a-z0-9]/gi, "")}`;

  function print() {
    const svg = document.getElementById(domId)?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=380,height=480");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${sku}</title><style>*{font-family:"Helvetica Neue",Arial,sans-serif}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}.l{border:2px solid #111;border-radius:14px;padding:22px;text-align:center;width:250px}.n{font-size:15px;font-weight:600;margin-top:12px}.c{font-family:ui-monospace,monospace;font-size:20px;font-weight:700;letter-spacing:1px;margin-top:4px}</style></head><body onload="window.print()"><div class="l">${svg}<div class="n">${name}</div><div class="c">${sku}</div><div style="font-size:11px;color:#555;margin-top:8px">ConsignTrack · scan to sell</div></div></body></html>`);
    w.document.close();
  }

  return (
    <>
      {variant === "icon" ? (
        <Button variant="ghost" size="icon" aria-label="Product QR label" onClick={(e) => { e.stopPropagation(); setOpen(true); }}><QrCode className="h-4 w-4" /></Button>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); setOpen(true); }}><QrCode className="h-4 w-4" /> QR label</Button>
      )}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-card p-5 text-center shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Product QR</span>
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="mt-4 flex justify-center">
              <span className="rounded-xl border border-border bg-white p-3"><QRCodeSVG id={domId} value={value} size={168} level="M" marginSize={0} /></span>
            </div>
            <div className="mt-3 text-sm font-medium">{name}</div>
            <div className="tnum text-xs text-muted-foreground">{sku}</div>
            <p className="mt-2 text-xs text-muted-foreground">Print &amp; stick this on the product. Scan it at the store&apos;s Sales terminal to record a sale.</p>
            <Button className="mt-4 w-full gap-1.5" onClick={print}><Printer className="h-4 w-4" /> Print label</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
