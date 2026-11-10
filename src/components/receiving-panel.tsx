"use client";

import * as React from "react";
import { Truck, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { PackageManifestModal, type AwaitingPackage } from "@/components/package-manifest-modal";
import { formatDate } from "@/lib/utils";

export type { AwaitingPackage, AwaitingLine } from "@/components/package-manifest-modal";
export interface HistoryRow { id: string; pkg_code: string; consignor_name: string; units: number; status: string; updated_at: string }

const STATUS_TONE: Record<string, "ok" | "warn" | "info" | "neutral"> = {
  DELIVERED: "ok", PARTIAL_DISPUTED: "warn", IN_TRANSIT: "info", PACKED: "neutral",
};
function statusLabel(s: string) { return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export function ReceivingPanel({ awaiting, history }: { awaiting: AwaitingPackage[]; history: HistoryRow[] }) {
  const [active, setActive] = React.useState<AwaitingPackage | null>(null);
  const [scan, setScan] = React.useState("");
  const [scanErr, setScanErr] = React.useState<string | null>(null);

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim().toUpperCase();
    setScanErr(null);
    const hit = awaiting.find((p) => p.pkg_code.toUpperCase() === code);
    setScan("");
    if (hit) setActive(hit);
    else setScanErr(`"${code}" isn't a package in transit to your store.`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={onScan} className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan package QR or type its code (PKG-…)" className="pl-8" autoFocus />
            </div>
            <Button type="submit"><QrCode className="h-4 w-4" /> Scan</Button>
          </form>
          {scanErr ? <p className="mt-2 text-sm text-destructive">{scanErr}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">Stock only moves on the scan — a barcode scanner types the code for you. For a live camera, use the <strong>Scan</strong> button in the header.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-primary" /> Awaiting receipt</CardTitle>
          <p className="text-xs text-muted-foreground">Packages in transit to your store. Scan above to open the manifest.</p>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing in transit right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {awaiting.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="tnum font-semibold">{p.pkg_code}</div>
                    <div className="text-xs text-muted-foreground">{p.consignor_name} · {p.units} units</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><ScanLine className="h-3 w-3" /> scan to receive</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Delivery history</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead><TableHead>Consignor</TableHead>
                  <TableHead className="text-right">Units</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="tnum font-medium">{h.pkg_code}</TableCell>
                    <TableCell>{h.consignor_name}</TableCell>
                    <TableCell className="tnum text-right">{h.units}</TableCell>
                    <TableCell><StatusPill tone={STATUS_TONE[h.status] ?? "neutral"}>{statusLabel(h.status)}</StatusPill></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(h.updated_at)}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No packages yet.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {active ? <PackageManifestModal pkg={active} onClose={() => setActive(null)} /> : null}
    </div>
  );
}
