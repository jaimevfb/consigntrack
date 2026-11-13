"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X, Camera } from "lucide-react";
import { resolveDispute } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DisputeLine { sku_id: string; sku: string; name: string; qty_disputed: number; photo: string | null }
export interface DisputedPackage { id: string; pkg_code: string; consignor_name: string; lines: DisputeLine[] }

export function DisputeResolver({ packages }: { packages: DisputedPackage[] }) {
  if (packages.length === 0) return null;
  return (
    <Card className="border-warn/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warn-foreground" /> Disputed items — need resolution
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Held aside at receiving and kept out of sellable stock. <strong>Release to shelf</strong> if they turned up or were accepted, or <strong>write off</strong> if confirmed lost/damaged.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {packages.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-3">
            <div className="text-sm font-medium">{p.pkg_code} <span className="font-normal text-muted-foreground">· {p.consignor_name}</span></div>
            <div className="mt-1 divide-y divide-border">
              {p.lines.map((l) => <DisputeRow key={l.sku_id} packageId={p.id} line={l} />)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DisputeRow({ packageId, line }: { packageId: string; line: DisputeLine }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "release" | "writeoff">(null);
  const [confirmOff, setConfirmOff] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function act(received: boolean) {
    setBusy(received ? "release" : "writeoff");
    setErr(null);
    const res = await resolveDispute(packageId, line.sku_id, line.qty_disputed, received);
    setBusy(null);
    if (!res.ok) { setErr(res.error); setConfirmOff(false); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{line.name}</div>
        <div className="tnum flex items-center gap-1.5 text-xs text-muted-foreground">
          {line.sku} · <span className="font-semibold text-warn-foreground">{line.qty_disputed} disputed</span>
          {line.photo ? <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> photo on file</span> : null}
        </div>
        {err ? <div className="mt-1 text-xs text-destructive">{err}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {confirmOff ? (
          <>
            <span className="text-xs text-muted-foreground">Write off {line.qty_disputed}?</span>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setConfirmOff(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => act(false)}>{busy === "writeoff" ? "Writing off…" : "Confirm"}</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(true)}><Check className="h-4 w-4" /> {busy === "release" ? "Releasing…" : "Release to shelf"}</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!!busy} onClick={() => setConfirmOff(true)}><X className="h-4 w-4" /> Write off</Button>
          </>
        )}
      </div>
    </div>
  );
}
