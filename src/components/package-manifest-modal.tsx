"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, X, Check, AlertTriangle } from "lucide-react";
import { receivePackage, type ReceiveLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AwaitingLine { line_id: string; sku: string; name: string; qty_expected: number }
export interface AwaitingPackage { id: string; pkg_code: string; consignor_name: string; units: number; lines: AwaitingLine[] }

/** Manifest: tick each SKU that's correct, untick to flag how many are short/damaged, then confirm. */
export function PackageManifestModal({ pkg, onClose, onDone }: { pkg: AwaitingPackage; onClose: () => void; onDone?: () => void }) {
  const router = useRouter();
  const [ok, setOk] = React.useState<Record<string, boolean>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, true])));
  const [short, setShort] = React.useState<Record<string, number>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, 0])));
  const [photo, setPhoto] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const allCorrect = pkg.lines.every((l) => ok[l.line_id]);
  const flaggedCount = pkg.lines.filter((l) => !ok[l.line_id]).length;

  function toggle(id: string) {
    setOk((o) => ({ ...o, [id]: !o[id] }));
    setShort((s) => ({ ...s, [id]: 1 }));
  }

  async function confirm() {
    setErr(null);
    if (!allCorrect && !photo.trim()) { setErr("Add a photo reference for the flagged item(s)."); return; }
    setBusy(true);
    const lines: ReceiveLine[] = pkg.lines.map((l) => {
      if (ok[l.line_id]) return { line_id: l.line_id, qty_received: l.qty_expected, qty_disputed: 0 };
      const miss = Math.max(0, Math.min(short[l.line_id] ?? 0, l.qty_expected));
      return { line_id: l.line_id, qty_received: l.qty_expected - miss, qty_disputed: miss, photo: photo.trim() || null };
    });
    const res = await receivePackage(pkg.id, lines);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
    onDone?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 text-left sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-pop sm:rounded-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-base font-semibold">Receive {pkg.pkg_code}</h3>
            <p className="text-xs text-muted-foreground">{pkg.consignor_name} · {pkg.units} units</p>
          </div>
          <button aria-label="Close" onClick={() => !busy && onClose()} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* lines */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-xs text-muted-foreground">Tick every item that&apos;s correct. Untick to flag a shortage.</p>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {pkg.lines.map((l) => {
              const correct = ok[l.line_id];
              const miss = Math.max(0, Math.min(short[l.line_id] ?? 0, l.qty_expected));
              return (
                <div key={l.line_id} className={correct ? "p-3" : "bg-warn/5 p-3"}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={correct} onChange={() => toggle(l.line_id)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{l.name}</span>
                        <span className="tnum shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">×{l.qty_expected}</span>
                      </div>
                      <div className="tnum text-xs text-muted-foreground">{l.sku}</div>
                    </div>
                    {correct
                      ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ok-foreground"><Check className="h-3.5 w-3.5" /> correct</span>
                      : <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warn-foreground"><AlertTriangle className="h-3.5 w-3.5" /> flagged</span>}
                  </label>
                  {!correct ? (
                    <div className="ml-8 mt-2.5 rounded-lg bg-background/60 p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm text-muted-foreground">Short / damaged</label>
                        <Input type="number" min={0} max={l.qty_expected} value={short[l.line_id] ?? 0} onChange={(e) => setShort({ ...short, [l.line_id]: Number(e.target.value) })} className="h-8 w-20 text-right tnum" />
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground">Receiving <span className="tnum font-medium text-foreground">{l.qty_expected - miss}</span> of {l.qty_expected} good{miss > 0 ? ` · ${miss} disputed` : ""}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!allCorrect ? (
            <div className="mt-3 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Photo for the {flaggedCount} flagged item{flaggedCount === 1 ? "" : "s"} (required)</label>
              <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="Photo URL or reference" />
            </div>
          ) : null}
          {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
        </div>

        {/* footer */}
        <div className="border-t border-border p-4">
          <Button className="w-full" disabled={busy} onClick={confirm}>
            {allCorrect ? <Check className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
            {busy ? "Receiving…" : allCorrect ? "Confirm all received" : `Confirm — ${flaggedCount} flagged`}
          </Button>
        </div>
      </div>
    </div>
  );
}
