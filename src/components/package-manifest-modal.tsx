"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, X, Check, AlertTriangle } from "lucide-react";
import { receivePackage, type ReceiveLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AwaitingLine { line_id: string; sku: string; name: string; qty_expected: number }
export interface AwaitingPackage { id: string; pkg_code: string; consignor_name: string; units: number; lines: AwaitingLine[] }

/** The package manifest: Confirm-All (one tap) or Report-Discrepancy. Opened only from a scan. */
export function PackageManifestModal({ pkg, onClose, onDone }: { pkg: AwaitingPackage; onClose: () => void; onDone?: () => void }) {
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
    onDone?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-pop sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Package manifest · {pkg.pkg_code}</h3>
            <p className="text-xs text-muted-foreground">{pkg.consignor_name} · {pkg.units} units</p>
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
            <Button className="flex-1" disabled={busy} onClick={() => submit(true)}><Check className="h-4 w-4" /> {busy ? "Receiving…" : "Confirm all received"}</Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setMode("discrepancy")}><AlertTriangle className="h-4 w-4" /> Report discrepancy</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" disabled={busy} onClick={() => submit(false)}><PackageCheck className="h-4 w-4" /> {busy ? "Saving…" : "Submit with discrepancy"}</Button>
            <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => setMode("all")}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}
