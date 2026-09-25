"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QrLabel({
  token,
  code,
  description,
}: {
  token: string;
  code: string;
  description: string;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);

  function print() {
    const svg = wrap.current?.querySelector("svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${code}</title>
      <style>
        *{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
        body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}
        .label{border:2px solid #111;border-radius:12px;padding:20px;text-align:center;width:280px}
        .desc{font-family:Georgia,serif;font-size:14px;margin:10px 0 2px}
        .code{font-size:22px;font-weight:700;letter-spacing:1px}
        .brand{font-size:11px;color:#555;margin-top:8px}
      </style></head>
      <body onload="window.print()">
        <div class="label">${svg}
          <div class="desc">${description.replace(/</g, "&lt;")}</div>
          <div class="code">${code}</div>
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
        <div className="text-xs text-muted-foreground">Signed · tamper-evident</div>
      </div>
      <Button variant="outline" size="sm" onClick={print}>
        <Printer className="h-4 w-4" /> Print label
      </Button>
    </div>
  );
}
