"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { PackagePlus, Plus, Minus, Trash2, Printer, Truck, Search, Store, ArrowRight } from "lucide-react";
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
  const [storeId, setStoreId] = React.useState("");
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const lines = skus.filter((s) => (qty[s.sku_id] ?? 0) > 0);
  const totalUnits = lines.reduce((a, s) => a + qty[s.sku_id], 0);
  const totalValue = lines.reduce((a, s) => a + qty[s.sku_id] * s.unit_price, 0);
  const storeName = stores.find((s) => s.id === storeId)?.name ?? "";
  const q = search.trim().toLowerCase();
  const filtered = q ? skus.filter((s) => s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q)) : skus;

  function setLine(s: BuilderSku, v: number) {
    const clamped = Math.max(0, Math.min(v, s.available));
    setQty((cur) => ({ ...cur, [s.sku_id]: clamped }));
  }

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
      {/* Step 1 — destination store (deliberate choice, no default) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Destination store</div>
            <div className="text-xs text-muted-foreground">Choose where this shipment is headed before adding products.</div>
          </div>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select a store…" /></SelectTrigger>
            <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 2 — pick products + manifest */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="gap-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="h-4 w-4 text-primary" /> Add products</CardTitle>
              {lines.length > 0 ? <span className="tnum rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{lines.length} selected</span> : null}
            </div>
            {storeId ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU…" className="h-9 pl-9" />
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {!storeId ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><Store className="h-5 w-5 text-muted-foreground" /></span>
                <p className="text-sm font-medium">Pick a destination store first</p>
                <p className="max-w-xs text-xs text-muted-foreground">Once you choose a store above, your catalog loads here and you can start building the package.</p>
              </div>
            ) : (
              <div className="max-h-[46vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {filtered.map((s) => {
                  const v = qty[s.sku_id] ?? 0;
                  const out = s.available <= 0;
                  return (
                    <div key={s.sku_id} className={`flex items-center justify-between gap-3 p-3 transition-colors ${v > 0 ? "bg-primary/5" : ""} ${out ? "opacity-60" : ""}`}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="tnum text-xs text-muted-foreground">{s.sku} · {formatPHP(s.unit_price)} · <span className={out ? "text-destructive" : ""}>{s.available} available</span></div>
                      </div>
                      {out ? (
                        <StatusPill tone="neutral">Out of stock</StatusPill>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" aria-label="Decrease" disabled={v <= 0} onClick={() => setLine(s, v - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                          <Input type="number" min={0} max={s.available} value={v} onChange={(e) => setLine(s, Number(e.target.value))} className="h-8 w-14 px-1 text-center tnum" />
                          <button type="button" aria-label="Increase" disabled={v >= s.available} onClick={() => setLine(s, v + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{skus.length === 0 ? "No products in your catalog yet." : "No products match your search."}</p> : null}
              </div>
            )}
            {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manifest</CardTitle>
            {storeName ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowRight className="h-3.5 w-3.5" /> {storeName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">No destination selected yet.</p>
            )}
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10 text-center">
                <PackagePlus className="h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">{storeId ? "Add quantities to build the package." : "Pick a store, then add products."}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {lines.map((s) => (
                  <div key={s.sku_id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="tnum text-xs text-muted-foreground">{qty[s.sku_id]} × {formatPHP(s.unit_price)}</div>
                    </div>
                    <span className="tnum font-medium">{formatPHP(qty[s.sku_id] * s.unit_price)}</span>
                    <button aria-label="Remove" onClick={() => setLine(s, 0)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5 text-sm">
                  <span className="text-muted-foreground">{totalUnits} units</span>
                  <span className="tnum text-base font-bold">{formatPHP(totalValue)}</span>
                </div>
              </div>
            )}
            <Button className="mt-4 w-full" disabled={busy || !storeId || lines.length === 0} onClick={generate}><Plus className="h-4 w-4" /> {busy ? "Generating…" : "Generate package QR"}</Button>
            {!storeId && lines.length > 0 ? <p className="mt-2 text-center text-xs text-muted-foreground">Select a destination store to continue.</p> : null}
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
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 rounded-lg border border-border bg-white p-1.5"><QRCodeSVG id={`pkgqr-${p.pkg_code}`} value={`CT1:${p.qr_token}`} size={44} level="M" marginSize={0} /></span>
                  <div className="min-w-0"><div className="tnum text-sm font-semibold">{p.pkg_code}</div><div className="text-xs text-muted-foreground">→ {p.store_name} · {p.units} units · {formatPHP(p.value)}</div><div className="tnum truncate text-[11px] tracking-[0.18em] text-muted-foreground">{p.qr_token}</div></div>
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
