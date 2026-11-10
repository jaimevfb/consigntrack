"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { PackagePlus, Plus, Trash2, Printer, Truck } from "lucide-react";
import { createOutboundPackage } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { formatPHP, formatDate } from "@/lib/utils";

export interface StoreOption { id: string; name: string }
export interface BuilderSku { sku_id: string; sku: string; name: string; unit_price: number; available: number }
export interface ShipmentRow { id: string; pkg_code: string; qr_token: string; store_name: string; units: number; value: number; status: string; updated_at: string }

const TONE: Record<string, "ok" | "warn" | "info" | "neutral"> = { DELIVERED: "ok", PARTIAL_DISPUTED: "warn", IN_TRANSIT: "info", PACKED: "neutral" };
function label(s: string) { return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export function ShipmentBuilder({ consignorId, stores, skus, history }: { consignorId: string; stores: StoreOption[]; skus: BuilderSku[]; history: ShipmentRow[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = React.useState(stores[0]?.id ?? "");
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const lines = skus.filter((s) => (qty[s.sku_id] ?? 0) > 0);
  const totalUnits = lines.reduce((a, s) => a + qty[s.sku_id], 0);
  const totalValue = lines.reduce((a, s) => a + qty[s.sku_id] * s.unit_price, 0);

  async function generate() {
    setErr(null);
    if (!storeId || lines.length === 0) { setErr("Pick a store and add at least one SKU."); return; }
    setBusy(true);
    const res = await createOutboundPackage(consignorId, storeId, lines.map((s) => ({ sku_id: s.sku_id, qty: qty[s.sku_id] })), false);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setQty({}); router.refresh();
  }

  function printLabel(code: string, store: string, token: string) {
    const svg = document.getElementById(`pkgqr-${code}`)?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=560"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${code}</title><style>*{font-family:"Helvetica Neue",Arial,sans-serif}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}.l{border:2px solid #111;border-radius:12px;padding:24px;text-align:center;width:280px}.c{font-family:ui-monospace,monospace;font-size:24px;font-weight:700;margin-top:10px}.t{font-family:ui-monospace,monospace;font-size:15px;letter-spacing:2px;margin-top:4px}</style></head><body onload="window.print()"><div class="l">${svg}<div class="c">${code}</div><div class="t">${token}</div><div>→ ${store}</div><div style="font-size:11px;color:#555;margin-top:8px">ConsignTrack · outbound package</div></div></body></html>`);
    w.document.close();
  }

  const packed = history.filter((h) => h.status === "PACKED");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="h-4 w-4 text-primary" /> Shipment builder</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Destination store</label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="max-h-[42vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {skus.map((s) => (
                <div key={s.sku_id} className={`flex items-center justify-between gap-3 p-3 ${s.available <= 0 ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="tnum text-xs text-muted-foreground">{s.sku} · {formatPHP(s.unit_price)} · <span className={s.available <= 0 ? "text-destructive" : ""}>{s.available} available</span></div>
                  </div>
                  <Input type="number" min={0} max={s.available} disabled={s.available <= 0} value={qty[s.sku_id] ?? 0}
                    onChange={(e) => setQty({ ...qty, [s.sku_id]: Math.max(0, Math.min(Number(e.target.value), s.available)) })}
                    className="h-8 w-20 text-right tnum" />
                </div>
              ))}
              {skus.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No products in your catalog yet.</p> : null}
            </div>
            {err ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Manifest</CardTitle></CardHeader>
          <CardContent>
            {lines.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Add quantities to build a package.</p> : (
              <div className="space-y-2">
                {lines.map((s) => (
                  <div key={s.sku_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="tnum text-muted-foreground">×{qty[s.sku_id]}</span>
                    <button aria-label="Remove" onClick={() => setQty({ ...qty, [s.sku_id]: 0 })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">{totalUnits} units</span>
                  <span className="tnum font-bold">{formatPHP(totalValue)}</span>
                </div>
              </div>
            )}
            <Button className="mt-4 w-full" disabled={busy || lines.length === 0} onClick={generate}><Plus className="h-4 w-4" /> {busy ? "Generating…" : "Generate package QR"}</Button>
          </CardContent>
        </Card>
      </div>

      {packed.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ready to dispatch</CardTitle>
            <p className="text-xs text-muted-foreground">Dispatch happens only when this package&apos;s QR is scanned at pickup — never a stray tap. Camera down? Type the code under the QR.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {packed.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border border-border bg-white p-1.5"><QRCodeSVG id={`pkgqr-${p.pkg_code}`} value={`CT1:${p.qr_token}`} size={44} level="M" marginSize={0} /></span>
                  <div><div className="tnum text-sm font-semibold">{p.pkg_code}</div><div className="text-xs text-muted-foreground">→ {p.store_name} · {p.units} units · {formatPHP(p.value)}</div><div className="tnum text-[11px] tracking-[0.18em] text-muted-foreground">{p.qr_token}</div></div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" aria-label="Print label" onClick={() => printLabel(p.pkg_code, p.store_name, p.qr_token)}><Printer className="h-4 w-4" /></Button>
                  <Button asChild size="sm" variant="outline"><Link href="/scan"><Truck className="h-4 w-4" /> Scan to dispatch</Link></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Shipment history</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Package</TableHead><TableHead>Store</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="tnum font-medium"><Link href={`/packages/${h.id}`} className="text-primary hover:underline">{h.pkg_code}</Link></TableCell>
                    <TableCell>{h.store_name}</TableCell>
                    <TableCell className="tnum text-right">{h.units}</TableCell>
                    <TableCell className="tnum text-right">{formatPHP(h.value)}</TableCell>
                    <TableCell><StatusPill tone={TONE[h.status] ?? "neutral"}>{label(h.status)}</StatusPill></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(h.updated_at)}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No shipments yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
