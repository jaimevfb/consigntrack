"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageX, AlertTriangle } from "lucide-react";
import { writeOffPackageAction } from "@/app/_actions/ledger-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LIABILITY: Record<string, string> = {
  consignor: "the consignor bears the loss",
  store: "the store bears the loss",
  shared: "the loss is shared per your agreement",
};

export function ReportLostButton({ packageId, pkgCode, liability }: { packageId: string; pkgCode: string; liability: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function doWriteOff() {
    setBusy(true); setErr(null);
    const res = await writeOffPackageAction(packageId, reason.trim() || undefined);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setConfirming(false); router.refresh();
  }

  if (!confirming) {
    return <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setErr(null); setConfirming(true); }}><PackageX className="h-4 w-4" /> Report lost</Button>;
  }
  return (
    <div className="w-64 rounded-xl border border-warn-foreground/40 bg-warn/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-foreground" />
        <div>
          <p className="font-medium">Write off {pkgCode} as lost?</p>
          <p className="text-xs text-muted-foreground">Closes the package — {LIABILITY[liability] ?? "liability per your agreement"}.</p>
        </div>
      </div>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. courier lost the box)" className="mt-2 h-8 text-xs" />
      {err ? <p className="mt-2 text-xs text-destructive">{err}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button variant="destructive" size="sm" disabled={busy} onClick={doWriteOff}>{busy ? "Writing off…" : "Write off"}</Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    </div>
  );
}
