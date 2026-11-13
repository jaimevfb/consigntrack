"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, X, Check, AlertTriangle, ScanLine, Camera, Trash2 } from "lucide-react";
import { receivePackage, type ReceiveLine } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/barcode-scanner";

export interface AwaitingLine { line_id: string; sku: string; name: string; qty_expected: number }
export interface AwaitingPackage { id: string; pkg_code: string; consignor_name: string; units: number; lines: AwaitingLine[] }

const clean = (raw: string) => raw.trim().replace(/^ctsku:/i, "").trim();

/** Receive a package: scan any damaged/disputed item to flag the exact piece;
 *  everything not flagged is received as correct. */
export function PackageManifestModal({ pkg, onClose, onDone }: { pkg: AwaitingPackage; onClose: () => void; onDone?: () => void }) {
  const router = useRouter();
  const [disputed, setDisputed] = React.useState<Record<string, string[]>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, []])));
  const [note, setNote] = React.useState("");
  const [scanOpen, setScanOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [flash, setFlash] = React.useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const disputedRef = React.useRef(disputed);
  disputedRef.current = disputed;
  const flashTimer = React.useRef<number | undefined>(undefined);

  const totalFlagged = Object.values(disputed).reduce((a, c) => a + c.length, 0);

  const say = React.useCallback((kind: "ok" | "warn", text: string) => {
    setFlash({ kind, text });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  }, []);

  // Route a scanned code to the manifest line whose product it belongs to
  // (exact SKU, or a <SKU>-NNNN piece serial of that product).
  const matchLine = React.useCallback((code: string) => {
    const c = code.toUpperCase();
    return pkg.lines.find((l) => c === l.sku.toUpperCase() || c.startsWith(l.sku.toUpperCase() + "-")) ?? null;
  }, [pkg.lines]);

  const addCode = React.useCallback((raw: string) => {
    const code = clean(raw);
    if (!code) return;
    const line = matchLine(code);
    if (!line) { say("warn", `Not on this manifest: ${code}`); return; }
    if ((disputedRef.current[line.line_id] ?? []).some((x) => x.toUpperCase() === code.toUpperCase())) { say("warn", `${code} already flagged`); return; }
    setErr(null);
    setDisputed((d) => ({ ...d, [line.line_id]: [...(d[line.line_id] ?? []), code] }));
    say("ok", `Flagged ${line.name} · ${code}`);
  }, [matchLine, say]);

  function removeCode(lineId: string, code: string) {
    setDisputed((d) => ({ ...d, [lineId]: (d[lineId] ?? []).filter((x) => x !== code) }));
  }

  async function confirm() {
    setErr(null);
    setBusy(true);
    const lines: ReceiveLine[] = pkg.lines.map((l) => {
      const codes = disputed[l.line_id] ?? [];
      return codes.length > 0
        ? { line_id: l.line_id, qty_received: l.qty_expected, qty_disputed: codes.length, codes, photo: note.trim() || null }
        : { line_id: l.line_id, qty_received: l.qty_expected, qty_disputed: 0 };
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
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-base font-semibold">Receive {pkg.pkg_code}</h3>
            <p className="text-xs text-muted-foreground">{pkg.consignor_name} · {pkg.units} units</p>
          </div>
          <button aria-label="Close" onClick={() => !busy && onClose()} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-xs text-muted-foreground">Check the goods. <strong>Scan any damaged or disputed item</strong> to flag the exact piece — everything you don&apos;t flag is received as correct.</p>
          <div className="flex gap-2">
            <Button type="button" className="flex-1 gap-2" onClick={() => setScanOpen(true)}><Camera className="h-4 w-4" /> Scan damaged item</Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) addCode(typed); setTyped(""); }} className="relative mt-2">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…or type the item's barcode and press Enter" className="h-10 pl-9" autoCapitalize="none" />
          </form>
          {flash ? (
            <div className={`mt-2 flex items-center gap-1.5 rounded-md px-3 py-2 text-sm ${flash.kind === "ok" ? "bg-warn/20 text-warn-foreground" : "bg-destructive/10 text-destructive"}`}>
              {flash.kind === "ok" ? <AlertTriangle className="h-4 w-4" /> : <X className="h-4 w-4" />} {flash.text}
            </div>
          ) : null}

          <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {pkg.lines.map((l) => {
              const codes = disputed[l.line_id] ?? [];
              const flagged = codes.length > 0;
              return (
                <div key={l.line_id} className={flagged ? "bg-warn/5 p-3" : "p-3"}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{l.name}</span>
                        <span className="tnum shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">×{l.qty_expected}</span>
                      </div>
                      <div className="tnum text-xs text-muted-foreground">{l.sku}</div>
                    </div>
                    {flagged
                      ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-warn-foreground"><AlertTriangle className="h-3.5 w-3.5" /> {codes.length} flagged</span>
                      : <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ok-foreground"><Check className="h-3.5 w-3.5" /> OK</span>}
                  </div>
                  {flagged ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {codes.map((c) => (
                        <span key={c} className="tnum inline-flex items-center gap-1 rounded-full bg-warn/15 py-0.5 pl-2 pr-1 text-[11px] text-warn-foreground">
                          {c}
                          <button type="button" aria-label={`Remove ${c}`} onClick={() => removeCode(l.line_id, c)} className="rounded-full p-0.5 hover:bg-warn/25"><Trash2 className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {totalFlagged > 0 ? (
            <div className="mt-3 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Note for the flagged item{totalFlagged === 1 ? "" : "s"} (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. crushed in transit, photo in group chat" />
            </div>
          ) : null}
          {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
        </div>

        <div className="border-t border-border p-4">
          <Button className="w-full" disabled={busy} onClick={confirm}>
            {totalFlagged === 0 ? <Check className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
            {busy ? "Receiving…" : totalFlagged === 0 ? "Confirm all received" : `Confirm — ${totalFlagged} flagged`}
          </Button>
        </div>
      </div>

      {scanOpen ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base font-semibold"><Camera className="h-4 w-4 text-warn-foreground" /> Scan damaged items</div>
              <div className="text-xs text-muted-foreground">Each scan flags that exact item on the manifest.</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close scanner" onClick={() => setScanOpen(false)}><X className="h-5 w-5" /></Button>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-y-auto p-4">
            <div className="w-full max-w-xl">
              <div className="mb-3 min-h-[3.25rem]">
                {flash ? (
                  <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold ring-1 ${flash.kind === "ok" ? "bg-warn/20 text-warn-foreground ring-warn/40" : "bg-destructive/10 text-destructive ring-destructive/30"}`}>
                    {flash.kind === "ok" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}
                    <span className="min-w-0 truncate">{flash.text}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Point the camera at a damaged item&apos;s barcode…</div>
                )}
              </div>
              <BarcodeScanner scannerId="dispute-scanner" onDecode={addCode} />
              <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) addCode(typed); setTyped(""); }} className="relative mt-4">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…or type a code and press Enter" className="h-11 pl-9" autoCapitalize="none" />
              </form>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-border p-4">
            <div className="text-sm text-muted-foreground">Flagged so far: <span className="font-medium text-foreground">{totalFlagged}</span></div>
            <Button className="ml-auto" variant="outline" onClick={() => setScanOpen(false)}>Done</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
