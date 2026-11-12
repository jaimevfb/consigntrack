"use client";

import * as React from "react";
import JsBarcode from "jsbarcode";

/** Renders a scannable Code 128 barcode of `value` into an SVG. */
export function Barcode({ value, id, height = 60, className }: { value: string; id?: string; height?: number; className?: string }) {
  const ref = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 2,
        height,
        displayValue: true,
        fontSize: 14,
        font: "ui-monospace, monospace",
        textMargin: 4,
        margin: 8,
        background: "#ffffff",
        lineColor: "#0f172a",
      });
    } catch {
      /* invalid value — leave empty */
    }
  }, [value, height]);
  return <svg ref={ref} id={id} className={className} />;
}
