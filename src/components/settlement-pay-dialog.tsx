"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, ShieldCheck, X, Check } from "lucide-react";
import { markSettlementPaid } from "@/app/_actions/ledger";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPHP } from "@/lib/utils";

const METHODS: { value: string; label: string }[] = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "instapay", label: "InstaPay" },
  { value: "bank_transfer", label: "Bank transfer" },
];

export function SettlementPayDialog({
  settlementId,
  amount,
  consignorName,
}: {
  settlementId: string;
  amount: number;
  consignorName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState("gcash");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function send() {
    setError(null);
    setBusy(true);
    const res = await markSettlementPaid(settlementId, method);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
    router.refresh();
    setTimeout(() => setOpen(false), 1100);
  }

  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); setDone(false); setError(null); }}>
        <Wallet className="h-4 w-4" /> Send payment
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">Cashless settlement</h3>
                <p className="text-xs text-muted-foreground">Paying {consignorName}</p>
              </div>
              <button aria-label="Close" onClick={() => !busy && setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 rounded-lg bg-accent/60 p-4 text-center">
              <div className="text-xs text-accent-foreground/80">Amount to settle</div>
              <div className="tnum text-3xl font-semibold text-accent-foreground">{formatPHP(amount)}</div>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok text-ok-foreground">
                  <Check className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium">Payment sent</p>
                <p className="text-xs text-muted-foreground">The consignor can now confirm receipt.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-method">Pay with</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="pay-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {error ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

                <Button className="mt-4 w-full" onClick={send} disabled={busy}>
                  {busy ? "Sending…" : `Send ${formatPHP(amount)}`}
                </Button>
                <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> Demo rail — a transaction reference is recorded, no funds move.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
