"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, X, Check, AlertTriangle, Truck, QrCode, ScanLine } from "lucide-react";
import { receivePackage, type ReceiveLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/utils";

export interface AwaitingLine { line_id: string; sku: string; name: string; qty_expected: number }
export interface AwaitingPackage { id: string; pkg_code: string; consignor_name: string; units: number; lines: AwaitingLine[] }
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
          <p className="mt-2 text-xs text-muted-foreground">A barcode scanner types the code for you — just scan and it opens the manifest. Typing works too.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4 text-primary" /> Awaiting receipt</CardTitle>
          <p className="text-xs text-muted-foreground">Packages in transit to your store. Scan above, or tap one to open the manifest.</p>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing in transit right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {awaiting.map((p) => (
                <button key={p.id} onClick={() => setActive(p)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent/40">
                  <div>
                    <div className="tnum font-semibold">{p.pkg_code}</div>
                    <div className="text-xs text-muted-foreground">{p.consignor_name} · {p.units} units</div>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground"><QrCode className="h-4 w-4" /></span>
                </button>
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

      {active ? <ManifestModal pkg={active} onClose={() => setActive(null)} /> : null}
    </div>
  );
}

function ManifestModal({ pkg, onClose }: { pkg: AwaitingPackage; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"all" | "discrepancy">("all");
  const [recv, setRecv] = React.useState<Record<string, number>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, l.qty_expected])));
  const [disp, setDisp] = React.useState<Record<string, number>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, 0])));
  const [photo, setPhoto] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(confirmAll: boolean) {
    setErr(null);
    if (!confirmAll && !photo.trim()) { setErr("A photo reference is required to report a discrepancy."); return; }
    setBusy(true);
    const lines: ReceiveLine[] = pkg.lines.map((l) => confirmAll
      ? { line_id: l.line_id, qty_received: l.qty_expected, qty_disputed: 0 }
      : { line_id: l.line_id, qty_received: recv[l.line_id] ?? 0, qty_disputed: disp[l.line_id] ?? 0, photo: photo.trim() || null });
    const res = await receivePackage(pkg.id, lines);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-pop sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Package manifest · {pkg.pkg_code}</h3>
            <p className="text-xs text-muted-foreground">{pkg.consignor_name}</p>
          </div>
          <button aria-label="Close" onClick={() => !busy && onClose()} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="my-4 max-h-[46vh] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr><th className="p-2 text-left">SKU</th><th className="p-2 text-right">Expected</th>
                {mode === "discrepancy" ? <><th className="p-2 text-right">Received</th><th className="p-2 text-right">Disputed</th></> : null}</tr>
            </thead>
            <tbody>
              {pkg.lines.map((l) => (
                <tr key={l.line_id} className="border-t border-border">
                  <td className="p-2"><div className="font-medium">{l.name}</div><div className="tnum text-xs text-muted-foreground">{l.sku}</div></td>
                  <td className="tnum p-2 text-right">{l.qty_expected}</td>
                  {mode === "discrepancy" ? (
                    <>
                      <td className="p-2 text-right"><Input type="number" min={0} max={l.qty_expected} value={recv[l.line_id] ?? 0} onChange={(e) => setRecv({ ...recv, [l.line_id]: Number(e.target.value) })} className="h-8 w-16 text-right tnum" /></td>
                      <td className="p-2 text-right"><Input type="number" min={0} value={disp[l.line_id] ?? 0} onChange={(e) => setDisp({ ...disp, [l.line_id]: Number(e.target.value) })} className="h-8 w-16 text-right tnum" /></td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mode === "discrepancy" ? (
          <div className="mb-3 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Photo reference (required)</label>
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="photo URL or reference" />
          </div>
        ) : null}

        {err ? <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}

        {mode === "all" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={busy} onClick={() => submit(true)}>
              <Check className="h-4 w-4" /> {busy ? "Receiving…" : "Confirm all received"}
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setMode("discrepancy")}>
              <AlertTriangle className="h-4 w-4" /> Report discrepancy
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={busy} onClick={() => submit(false)}>
              <PackageCheck className="h-4 w-4" /> {busy ? "Saving…" : "Submit with discrepancy"}
            </Button>
            <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => setMode("all")}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}
