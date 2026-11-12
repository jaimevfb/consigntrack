"use client";

import * as React from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Barcode } from "@/components/barcode";

/** A printable grid of per-piece barcode labels for a product. */
export function LabelSheet({ name, serials, onClose }: { name: string; serials: string[]; onClose: () => void }) {
  function print() {
    const sheet = document.getElementById("label-sheet-grid");
    if (!sheet) return;
    const w = window.open("", "_blank", "width=820,height=920");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Labels — ${name}</title><style>*{font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact}body{margin:0;padding:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cell{border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center;page-break-inside:avoid}.cell .nm{font-size:10px;font-weight:600;color:#0f172a;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style></head><body onload="window.print()"><div class="grid">${sheet.innerHTML}</div></body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">Piece labels — {name}</div>
            <div className="text-xs text-muted-foreground">{serials.length} barcode{serials.length === 1 ? "" : "s"} · print, cut, and stick one on each piece</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={print}><Printer className="h-4 w-4" /> Print sheet</Button>
            <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        </div>
        <div id="label-sheet-grid" className="grid grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {serials.map((s) => (
            <div key={s} className="cell flex flex-col items-center rounded-lg border border-border bg-white p-2">
              <div className="nm mb-1 max-w-full truncate text-[10px] font-semibold text-[#0f172a]">{name}</div>
              <Barcode value={s} height={44} />
            </div>
          ))}
          {serials.length === 0 ? <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No pieces to label yet — add stock first.</p> : null}
        </div>
      </div>
    </div>
  );
}
