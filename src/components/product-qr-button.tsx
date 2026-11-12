"use client";

import * as React from "react";
import { Barcode as BarcodeIcon, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Barcode } from "@/components/barcode";

/**
 * Shows a printable Code 128 barcode for a product that encodes its SKU.
 * Print it, stick it on the product/shelf, and scan it at the store's Sales
 * terminal to record a sale. The SKU itself is the barcode value.
 */
export function ProductLabelButton({ sku, name, variant = "icon" }: { sku: string; name: string; variant?: "icon" | "button" }) {
  const [open, setOpen] = React.useState(false);
  const domId = `bc-${sku.replace(/[^a-z0-9]/gi, "")}`;

  function print() {
    const svg = document.getElementById(domId)?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=360");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${sku}</title><style>*{font-family:"Helvetica Neue",Arial,sans-serif}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}.l{border:2px solid #111;border-radius:14px;padding:18px 22px;text-align:center}.n{font-size:14px;font-weight:600;margin-bottom:10px}</style></head><body onload="window.print()"><div class="l"><div class="n">${name}</div>${svg}<div style="font-size:10px;color:#555;margin-top:6px">ConsignTrack · scan to sell</div></div></body></html>`);
    w.document.close();
  }

  return (
    <>
      {variant === "icon" ? (
        <Button variant="ghost" size="icon" aria-label="Product barcode label" onClick={(e) => { e.stopPropagation(); setOpen(true); }}><BarcodeIcon className="h-4 w-4" /></Button>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); setOpen(true); }}><BarcodeIcon className="h-4 w-4" /> Barcode label</Button>
      )}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 text-center shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Product barcode</span>
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="mt-2 text-sm font-medium">{name}</div>
            <div className="mt-3 flex justify-center">
              <span className="rounded-xl border border-border bg-white p-2"><Barcode id={domId} value={sku} /></span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Print &amp; stick this on the product. Scan it at the store&apos;s Sales terminal to record a sale — the SKU is the barcode.</p>
            <Button className="mt-4 w-full gap-1.5" onClick={print}><Printer className="h-4 w-4" /> Print label</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Back-compat alias (previous name).
export { ProductLabelButton as ProductQrButton };
