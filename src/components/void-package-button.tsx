"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, AlertTriangle } from "lucide-react";
import { voidPackageAction } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";

export function VoidPackageButton({ packageId, pkgCode, dispatched }: { packageId: string; pkgCode: string; dispatched: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function doVoid() {
    setBusy(true); setErr(null);
    const res = await voidPackageAction(packageId);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setConfirming(false); router.refresh();
  }

  if (!confirming) {
    return <Button variant="outline" size="sm" onClick={() => { setErr(null); setConfirming(true); }}><Ban className="h-4 w-4" /> Void package</Button>;
  }
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Void {pkgCode}?</p>
          <p className="text-xs text-muted-foreground">{dispatched ? "Stock returns to where it came from and the package is cancelled." : "The package is cancelled."} This can&apos;t be undone.</p>
        </div>
      </div>
      {err ? <p className="mt-2 text-xs text-destructive">{err}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button variant="destructive" size="sm" disabled={busy} onClick={doVoid}>{busy ? "Voiding…" : "Yes, void it"}</Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    </div>
  );
}
