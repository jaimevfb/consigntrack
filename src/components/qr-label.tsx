"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unitLabel } from "@/lib/units";

export function QrLabel({
  token,
  code,
  description,
  sku,
  unit,
}: {
  token: string;
  code: string;
  description: string;
  sku?: string | null;
  unit?: string | null;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const esc = (s: string) => s.replace(/</g, "&lt;");

  function print() {
    const svg = wrap.current?.querySelector("svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${esc(code)}</title>
      <style>
        *{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
        body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}
        .label{border:2px solid #111;border-radius:12px;padding:20px;text-align:center;width:280px}
        .desc{font-size:14px;margin:10px 0 2px}
        .code{font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:1px}
        .meta{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#333;margin-top:4px}
        .brand{font-size:11px;color:#555;margin-top:8px}
      </style></head>
      <body onload="window.print()">
        <div class="label">${svg}
          <div class="desc">${esc(description)}</div>
          <div class="code">${esc(code)}</div>
          <div class="meta">${sku ? "SKU " + esc(sku) : ""}${sku && unit ? " · " : ""}${unit ? esc(unitLabel(unit)) : ""}</div>
          <div class="brand">ConsignTrack · signed QR</div>
        </div>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={wrap} className="rounded-lg border border-border bg-white p-4">
        <QRCodeSVG value={token} size={148} level="M" marginSize={1} />
      </div>
      <div className="text-center">
        <div className="tnum text-lg font-semibold tracking-wide">{code}</div>
        {sku || unit ? (
          <div className="tnum mt-0.5 text-xs text-muted-foreground">
            {sku ? `SKU ${sku}` : ""}
            {sku && unit ? " · " : ""}
            {unit ? unitLabel(unit) : ""}
          </div>
        ) : null}
        <div className="mt-0.5 text-xs text-muted-foreground">Signed · tamper-evident</div>
      </div>
      <Button variant="outline" size="sm" onClick={print}>
        <Printer className="h-4 w-4" /> Print label
      </Button>
    </div>
  );
}
