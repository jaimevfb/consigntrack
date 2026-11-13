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

/** Receive a package: count how many of each product arrived (catches shortages)
 *  and scan any damaged item (catches disputes). Anything missing or damaged is
 *  held aside for resolution; the rest is received as sellable stock. */
export function PackageManifestModal({ pkg, onClose, onDone }: { pkg: AwaitingPackage; onClose: () => void; onDone?: () => void }) {
  const router = useRouter();
  const [received, setReceived] = React.useState<Record<string, number>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, l.qty_expected])));
  const [codes, setCodes] = React.useState<Record<string, string[]>>(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, []])));
  const [note, setNote] = React.useState("");
  const [scanOpen, setScanOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [flash, setFlash] = React.useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const codesRef = React.useRef(codes);
  codesRef.current = codes;
  const flashTimer = React.useRef<number | undefined>(undefined);

  const byId = React.useMemo(() => Object.fromEntries(pkg.lines.map((l) => [l.line_id, l])), [pkg.lines]);
  // per line: missing (short) = expected - received ; damaged = scanned ; held = missing + damaged
  const missingOf = (l: AwaitingLine) => Math.max(0, l.qty_expected - (received[l.line_id] ?? l.qty_expected));
  const damagedOf = (l: AwaitingLine) => (codes[l.line_id] ?? []).length;
  const heldOf = (l: AwaitingLine) => missingOf(l) + damagedOf(l);
  const totalHeld = pkg.lines.reduce((a, l) => a + heldOf(l), 0);

  const say = React.useCallback((kind: "ok" | "warn", text: string) => {
    setFlash({ kind, text });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  }, []);

  const matchLine = React.useCallback((code: string) => {
    const c = code.toUpperCase();
    return pkg.lines.find((l) => c === l.sku.toUpperCase() || c.startsWith(l.sku.toUpperCase() + "-")) ?? null;
  }, [pkg.lines]);

  const addCode = React.useCallback((raw: string) => {
    const code = clean(raw);
    if (!code) return;
    const line = matchLine(code);
    if (!line) { say("warn", `Not on this manifest: ${code}`); return; }
    if ((codesRef.current[line.line_id] ?? []).some((x) => x.toUpperCase() === code.toUpperCase())) { say("warn", `${code} already flagged`); return; }
    setErr(null);
    setCodes((d) => ({ ...d, [line.line_id]: [...(d[line.line_id] ?? []), code] }));
    // damaged items are physically present, so received must cover them
    setReceived((r) => ({ ...r, [line.line_id]: Math.max(r[line.line_id] ?? line.qty_expected, (codesRef.current[line.line_id]?.length ?? 0) + 1) }));
    say("ok", `Flagged damaged: ${line.name} · ${code}`);
  }, [matchLine, say]);

  function setRecv(l: AwaitingLine, v: number) {
    const lo = damagedOf(l); // can't receive fewer than the damaged ones you scanned
    setReceived((r) => ({ ...r, [l.line_id]: Math.max(lo, Math.min(l.qty_expected, Number.isFinite(v) ? v : l.qty_expected)) }));
  }
  function removeCode(lineId: string, code: string) {
    setCodes((d) => ({ ...d, [lineId]: (d[lineId] ?? []).filter((x) => x !== code) }));
  }

  async function confirm() {
    setErr(null);
    setBusy(true);
    const lines: ReceiveLine[] = pkg.lines.map((l) => {
      const held = heldOf(l);
      return held > 0
        ? { line_id: l.line_id, qty_received: l.qty_expected, qty_disputed: held, codes: codes[l.line_id] ?? [], photo: note.trim() || null }
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
          <p className="mb-2 text-xs text-muted-foreground"><strong>Count how many of each product arrived</strong> and <strong>scan any damaged item</strong>. Anything missing or damaged is held for resolution; the rest is received.</p>
          <div className="flex gap-2">
            <Button type="button" className="flex-1 gap-2" onClick={() => setScanOpen(true)}><Camera className="h-4 w-4" /> Scan damaged item</Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) addCode(typed); setTyped(""); }} className="relative mt-2">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…or type a damaged item's barcode and press Enter" className="h-10 pl-9" autoCapitalize="none" />
          </form>
          {flash ? (
            <div className={`mt-2 flex items-center gap-1.5 rounded-md px-3 py-2 text-sm ${flash.kind === "ok" ? "bg-warn/20 text-warn-foreground" : "bg-destructive/10 text-destructive"}`}>
              {flash.kind === "ok" ? <AlertTriangle className="h-4 w-4" /> : <X className="h-4 w-4" />} {flash.text}
            </div>
          ) : null}

          <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {pkg.lines.map((l) => {
              const miss = missingOf(l);
              const dmg = damagedOf(l);
              const good = Math.max(0, (received[l.line_id] ?? l.qty_expected) - dmg);
              const flagged = miss > 0 || dmg > 0;
              return (
                <div key={l.line_id} className={flagged ? "bg-warn/5 p-3" : "p-3"}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{l.name}</div>
                      <div className="tnum text-xs text-muted-foreground">{l.sku} · expected {l.qty_expected}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <label className="text-xs text-muted-foreground">Received</label>
                      <Input type="number" min={dmg} max={l.qty_expected} value={received[l.line_id] ?? l.qty_expected}
                        onChange={(e) => setRecv(l, Number(e.target.value))}
                        className="h-8 w-16 text-right tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    {flagged ? (
                      <>
                        {miss > 0 ? <span className="tnum rounded-full bg-warn/15 px-1.5 py-0.5 font-semibold text-warn-foreground">{miss} short</span> : null}
                        {dmg > 0 ? <span className="tnum rounded-full bg-warn/15 px-1.5 py-0.5 font-semibold text-warn-foreground">{dmg} damaged</span> : null}
                        <span className="tnum text-muted-foreground">{good} sellable</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-ok-foreground"><Check className="h-3.5 w-3.5" /> all {l.qty_expected} received</span>
                    )}
                  </div>
                  {dmg > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(codes[l.line_id] ?? []).map((c) => (
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

          {totalHeld > 0 ? (
            <div className="mt-3 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Note for the discrepancy (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 never arrived, 1 crushed in transit" />
            </div>
          ) : null}
          {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
        </div>

        <div className="border-t border-border p-4">
          <Button className="w-full" disabled={busy} onClick={confirm}>
            {totalHeld === 0 ? <Check className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
            {busy ? "Receiving…" : totalHeld === 0 ? "Confirm all received" : `Confirm — ${totalHeld} held (missing/damaged)`}
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
            <div className="text-sm text-muted-foreground">Held so far: <span className="font-medium text-foreground">{totalHeld}</span></div>
            <Button className="ml-auto" variant="outline" onClick={() => setScanOpen(false)}>Done</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
