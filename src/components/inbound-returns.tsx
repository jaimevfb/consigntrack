import Link from "next/link";
import { Undo2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface InboundReturn { id: string; pkg_code: string; store_name: string; units: number; lines: { line_id: string; sku: string; name: string; qty_expected: number }[] }

export function InboundReturns({ returns }: { returns: InboundReturn[] }) {
  if (returns.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Undo2 className="h-4 w-4 text-primary" /> Inbound returns</CardTitle>
        <p className="text-xs text-muted-foreground">Returns in transit to your warehouse. Scan the RET package&apos;s QR — custody closes only on a scan and your confirmation.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {returns.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div><div className="tnum text-sm font-semibold">{r.pkg_code}</div><div className="text-xs text-muted-foreground">← {r.store_name} · {r.units} units</div></div>
            <Button asChild size="sm" variant="outline"><Link href="/scan"><QrCode className="h-4 w-4" /> Scan to receive</Link></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
