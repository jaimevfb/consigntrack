"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Printer, PackagePlus, Check, Undo2, Truck, Minus, Plus, ChevronDown } from "lucide-react";
import { buildReturnPackage } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/utils";

export interface ReturnSku { sku_id: string; sku: string; name: string; on_hand: number }
export interface ReturnConsignor { consignor_id: string; consignor_name: string; skus: ReturnSku[] }
export interface ReturnPkg { id: string; pkg_code: string; qr_token: string; consignor_name: string; units: number; status: string; updated_at: string }

export function ReturnBuilder({ storeId, consignors, existing }: { storeId: string; consignors: ReturnConsignor[]; existing: ReturnPkg[] }) {
  const router = useRouter();
  const [consignorId, setConsignorId] = React.useState(consignors[0]?.consignor_id ?? "");
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [showReturns, setShowReturns] = React.useState(false);

  const active = consignors.find((c) => c.consignor_id === consignorId);
  const lines = active ? active.skus.filter((s) => (qty[s.sku_id] ?? 0) > 0).map((s) => ({ sku_id: s.sku_id, qty: qty[s.sku_id] })) : [];

  async function generate() {
    setErr(null); setDone(null);
    if (!consignorId || lines.length === 0) { setErr("Add at least one SKU and quantity."); return; }
    setBusy(true);
    const res = await buildReturnPackage(consignorId, storeId, lines);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setQty({}); setDone(res.packageId ?? null); router.refresh();
  }

  function printLabel(code: string, consignor: string, token: string) {
    const w = window.open("", "_blank", "width=420,height=560"); if (!w) return;
    const svg = document.getElementById(`qr-${code}`)?.outerHTML ?? "";
    w.document.write(`<!doctype html><html><head><title>${code}</title><style>*{font-family:"Helvetica Neue",Arial,sans-serif}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}.l{border:2px solid #111;border-radius:12px;padding:24px;text-align:center;width:280px}.c{font-family:ui-monospace,monospace;font-size:24px;font-weight:700;margin-top:10px}.t{font-family:ui-monospace,monospace;font-size:15px;letter-spacing:2px;margin-top:4px}</style></head><body onload="window.print()"><div class="l">${svg}<div class="c">${code}</div><div class="t">${token}</div><div>${consignor}</div><div style="font-size:11px;color:#555;margin-top:8px">ConsignTrack · return package</div></div></body></html>`);
    w.document.close();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="h-4 w-4 text-primary" /> Build a return</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Consignor</label>
            <Select value={consignorId} onValueChange={(v) => { setConsignorId(v); setQty({}); }}>
              <SelectTrigger><SelectValue placeholder="Select consignor" /></SelectTrigger>
              <SelectContent>{consignors.map((c) => <SelectItem key={c.consignor_id} value={c.consignor_id}>{c.consignor_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border">
            {active && active.skus.length > 0 ? active.skus.map((s) => {
              const v = qty[s.sku_id] ?? 0;
              const clamp = (n: number) => setQty({ ...qty, [s.sku_id]: Math.max(0, Math.min(n, s.on_hand)) });
              return (
                <div key={s.sku_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="tnum text-xs text-muted-foreground">{s.sku} · {s.on_hand} on hand</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label="Decrease" disabled={v <= 0} onClick={() => clamp(v - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                    <Input type="number" min={0} max={s.on_hand} value={v} onChange={(e) => clamp(Number(e.target.value))} className="h-8 w-14 px-1 text-center tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                    <button type="button" aria-label="Increase" disabled={v >= s.on_hand} onClick={() => clamp(v + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            }) : <p className="p-4 text-center text-sm text-muted-foreground">No on-hand stock for this consignor.</p>}
          </div>
          {err ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
          {done ? <p className="flex items-center gap-1.5 rounded-md bg-ok/40 px-3 py-2 text-sm text-ok-foreground"><Check className="h-4 w-4" /> Return packed — scan its QR on the right to dispatch it.</p> : null}
          <Button className="w-full" disabled={busy || lines.length === 0} onClick={generate}>{busy ? "Generating…" : "Generate return package QR"}</Button>
        </CardContent>
      </Card>

      <Card>
        <button type="button" onClick={() => setShowReturns((v) => !v)} className="flex w-full items-center justify-between gap-2 p-4 text-left transition-colors hover:bg-muted/30">
          <div className="flex items-center gap-2 text-base font-semibold"><Undo2 className="h-4 w-4 text-primary" /> Return packages <span className="tnum rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{existing.length}</span></div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${showReturns ? "rotate-180" : ""}`} />
        </button>
        {showReturns ? (
        <CardContent className="pt-0">
          {existing.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No returns yet.</p> : (
            <div className="space-y-3">
              {existing.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg border border-border bg-white p-1.5"><QRCodeSVG id={`qr-${p.pkg_code}`} value={`CT1:${p.qr_token}`} size={44} level="M" marginSize={0} /></span>
                    <div className="min-w-0">
                      <div className="tnum text-sm font-semibold">{p.pkg_code}</div>
                      <div className="text-xs text-muted-foreground">{p.consignor_name} · {p.units} units · {formatDate(p.updated_at)}</div>
                      <div className="tnum truncate text-[11px] tracking-[0.18em] text-muted-foreground">{p.qr_token}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={p.status === "RECEIVED_BY_CONSIGNOR" ? "ok" : p.status === "RETURN_IN_TRANSIT" ? "info" : "neutral"}>{p.status === "RETURN_IN_TRANSIT" ? "In transit" : p.status === "RECEIVED_BY_CONSIGNOR" ? "Received" : "Packed"}</StatusPill>
                    {p.status === "RETURN_PACKED" ? (
                      <Button asChild size="sm" variant="outline"><Link href="/scan"><Truck className="h-4 w-4" /> Scan to dispatch</Link></Button>
                    ) : null}
                    <Button size="icon" variant="ghost" aria-label="Print" onClick={() => printLabel(p.pkg_code, p.consignor_name, p.qr_token)}><Printer className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
