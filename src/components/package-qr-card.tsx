"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PackageQrCard({ code, from, to, units }: { code: string; from: string; to: string; units: number }) {
  const [copied, setCopied] = React.useState(false);

  function print() {
    const svg = document.getElementById(`pkgqr-lg-${code}`)?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=600"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${code}</title><style>*{font-family:"Helvetica Neue",Arial,sans-serif}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}.l{border:2px solid #111;border-radius:14px;padding:28px;text-align:center;width:300px}.c{font-family:ui-monospace,monospace;font-size:26px;font-weight:700;margin-top:12px;letter-spacing:1px}.m{font-size:13px;color:#333;margin-top:6px}</style></head><body onload="window.print()"><div class="l">${svg}<div class="c">${code}</div><div class="m">${from} → ${to}</div><div class="m">${units} units</div><div style="font-size:11px;color:#666;margin-top:10px">ConsignTrack</div></div></body></html>`);
    w.document.close();
  }

  async function copyLink() {
    const url = `${window.location.origin}/scan?code=${encodeURIComponent(code)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-border bg-white p-4">
        <QRCodeSVG id={`pkgqr-lg-${code}`} value={code} size={180} level="M" marginSize={1} />
      </div>
      <div className="tnum text-xl font-bold tracking-wide">{code}</div>
      <p className="text-center text-xs text-muted-foreground">Show this on screen for the store to scan, or download the label.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={print}><Printer className="h-4 w-4" /> Download label</Button>
        <Button variant="outline" size="sm" onClick={copyLink}>{copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : "Copy receive link"}</Button>
      </div>
    </div>
  );
}
