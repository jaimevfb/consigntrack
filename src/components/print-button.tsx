"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print / Save as PDF via the browser's native print dialog (no deps). */
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
