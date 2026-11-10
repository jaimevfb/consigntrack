"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2, Check, QrCode } from "lucide-react";
import { receiveReturnPackage } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface InboundReturn { id: string; pkg_code: string; store_name: string; units: number; lines: { line_id: string; sku: string; name: string; qty_expected: number }[] }

export function InboundReturns({ returns }: { returns: InboundReturn[] }) {
  const router = useRouter();
  const [scan, setScan] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function receive(r: InboundReturn) {
    setErr(null); setBusy(r.id);
    const res = await receiveReturnPackage(r.id, r.lines.map((l) => ({ line_id: l.line_id, qty_received: l.qty_expected })));
    setBusy(null);
    if (!res.ok) setErr(res.error); else router.refresh();
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim().toUpperCase(); setScan(""); setErr(null);
    const hit = returns.find((r) => r.pkg_code.toUpperCase() === code);
    if (hit) receive(hit); else setErr(`"${code}" isn't a return in transit to your warehouse.`);
  }

  if (returns.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Undo2 className="h-4 w-4 text-primary" /> Inbound returns</CardTitle><p className="text-xs text-muted-foreground">Scan a RET package to receive it back into your warehouse — custody closes on your scan.</p></CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={onScan} className="flex gap-2">
          <div className="relative flex-1"><QrCode className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan RET code" className="pl-8" /></div>
          <Button type="submit">Scan</Button>
        </form>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        {returns.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div><div className="tnum text-sm font-semibold">{r.pkg_code}</div><div className="text-xs text-muted-foreground">← {r.store_name} · {r.units} units</div></div>
            <Button size="sm" disabled={busy === r.id} onClick={() => receive(r)}><Check className="h-4 w-4" /> {busy === r.id ? "Receiving…" : "Confirm received"}</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
