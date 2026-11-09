"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { runPeriodMaintenance } from "@/app/_actions/agreements";
import { Button } from "@/components/ui/button";

interface Summary {
  expiry?: { extended?: number; discounted?: number; flagged_for_return?: number };
  stale_deliveries?: { deliveries_closed?: number; items_flagged_lost?: number };
}

export function PeriodMaintenanceButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function run() {
    setBusy(true); setMsg(null); setErr(null);
    const res = await runPeriodMaintenance();
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    const s = (res.summary ?? {}) as Summary;
    const e = s.expiry ?? {};
    const d = s.stale_deliveries ?? {};
    setMsg(
      `${e.extended ?? 0} extended · ${e.discounted ?? 0} discounted · ${e.flagged_for_return ?? 0} flagged for return · ` +
      `${d.deliveries_closed ?? 0} stale deliveries closed (${d.items_flagged_lost ?? 0} items lost)`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={run} disabled={busy} variant="outline" size="sm">
        <CalendarClock className="h-4 w-4" />
        {busy ? "Running…" : "Run period maintenance"}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      {err ? <span className="text-xs text-destructive">{err}</span> : null}
    </div>
  );
}
