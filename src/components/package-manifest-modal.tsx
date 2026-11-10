"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, X, Check, AlertTriangle } from "lucide-react";
import { receivePackage, type ReceiveLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AwaitingLine { line_id: string; sku: string; name: string; qty_expected: number }
export interface AwaitingPackage { id: string; pkg_code: string; consignor_name: string; units: number; lines: AwaitingLine[] }

/** Manifest: tick each SKU that's correct, untick to flag a discrepancy, then Confirm all. */
export function PackageManifestModal({ pkg, onClose, onDone }: { pkg: AwaitingPackage; onClose: () => void; onDone?: () => void }) {
  const router = useRouter();
  const [ok, setOk] = React.useState<Record<string, boolean>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, true])));
  const [recv, setRecv] = React.useState<Record<string, number>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, l.qty_expected])));
  const [disp, setDisp] = React.useState<Record<string, number>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, 0])));
  const [photo, setPhoto] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const allCorrect = pkg.lines.every((l) => ok[l.line_id]);
  const flaggedCount = pkg.lines.filter((l) => !ok[l.line_id]).length;

  function toggle(id: string, expected: number) {
    setOk((o) => ({ ...o, [id]: !o[id] }));
    // When flagging, default received = expected − 0 so the receiver only edits what's short.
    setRecv((r) => ({ ...r, [id]: expected }));
    setDisp((d) => ({ ...d, [id]: 0 }));
  }

  async function confirm() {
    setErr(null);
    if (!allCorrect && !photo.trim()) { setErr("Add a photo reference for the flagged item(s)."); return; }
    setBusy(true);
    const lines: ReceiveLine[] = pkg.lines.map((l) => ok[l.line_id]
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
            <h3 className="text-base font-semibold">Receive {pkg.pkg_code}</h3>
            <p className="text-xs text-muted-foreground">{pkg.consignor_name} · {pkg.units} units · tick each item you confirm</p>
          </div>
          <button aria-label="Close" onClick={() => !busy && onClose()} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="my-4 max-h-[48vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {pkg.lines.map((l) => {
            const correct = ok[l.line_id];
            return (
              <div key={l.line_id} className="p-3">
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={correct} onChange={() => toggle(l.line_id, l.qty_expected)} className="h-5 w-5 shrink-0 accent-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{l.name}</div>
                    <div className="tnum text-xs text-muted-foreground">{l.sku} · expected {l.qty_expected}</div>
                  </div>
                  {correct
                    ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ok-foreground"><Check className="h-3.5 w-3.5" /> correct</span>
                    : <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warn-foreground"><AlertTriangle className="h-3.5 w-3.5" /> discrepancy</span>}
                </label>
                {!correct ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 pl-8 text-sm">
                    <label className="flex items-center gap-1.5 text-muted-foreground">Received
                      <Input type="number" min={0} max={l.qty_expected} value={recv[l.line_id] ?? 0} onChange={(e) => setRecv({ ...recv, [l.line_id]: Number(e.target.value) })} className="h-8 w-16 text-right tnum" />
                    </label>
                    <label className="flex items-center gap-1.5 text-muted-foreground">Damaged/short
                      <Input type="number" min={0} value={disp[l.line_id] ?? 0} onChange={(e) => setDisp({ ...disp, [l.line_id]: Number(e.target.value) })} className="h-8 w-16 text-right tnum" />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {!allCorrect ? (
          <div className="mb-3 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Photo reference for the {flaggedCount} flagged item{flaggedCount === 1 ? "" : "s"} (required)</label>
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="photo URL or reference" />
          </div>
        ) : null}

        {err ? <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}

        <Button className="w-full" disabled={busy} onClick={confirm}>
          {allCorrect ? <Check className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
          {busy ? "Receiving…" : allCorrect ? "Confirm all received" : `Confirm — ${flaggedCount} flagged`}
        </Button>
      </div>
    </div>
  );
}
