"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle } from "lucide-react";
import { itemScan, raiseDispute } from "@/app/_actions/items";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LABELS: Record<string, string> = {
  dispatch: "Mark dispatched",
  deliver: "Mark delivered",
  receive: "Confirm receipt",
  list: "List for sale",
  sell: "Record sale",
  return: "Return to consignor",
  flag_damaged: "Flag damaged",
  flag_lost: "Flag lost",
};

const VARIANT: Record<string, ButtonProps["variant"]> = {
  dispatch: "default", receive: "default", list: "default", sell: "default",
  return: "outline", deliver: "outline", flag_damaged: "outline", flag_lost: "outline",
};

export function ItemActions({
  token,
  itemId,
  actions,
  canDispute,
}: {
  token: string;
  itemId: string;
  actions: string[];
  canDispute: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [sellOpen, setSellOpen] = React.useState(false);
  const [price, setPrice] = React.useState("");
  const [buyer, setBuyer] = React.useState("");
  const [disputeOpen, setDisputeOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");

  async function run(event: string, extra: { sale_price?: number; buyer_ref?: string } = {}) {
    setPending(event);
    setMsg(null);
    const res = await itemScan({ token, event_type: event, ...extra });
    setPending(null);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: !res.exception, text: res.message });
    setSellOpen(false);
    router.refresh();
  }

  async function submitDispute() {
    if (!subject.trim()) return;
    setPending("dispute");
    const res = await raiseDispute(itemId, subject.trim());
    setPending(null);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: true, text: "Dispute raised." });
    setDisputeOpen(false);
    setSubject("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) =>
          a === "sell" ? (
            <Button key={a} variant={VARIANT[a]} size="sm" onClick={() => setSellOpen((v) => !v)}>
              {LABELS[a]}
            </Button>
          ) : (
            <Button key={a} variant={VARIANT[a] ?? "outline"} size="sm" disabled={pending === a} onClick={() => run(a)}>
              {pending === a ? "Working…" : LABELS[a] ?? a}
            </Button>
          ),
        )}
        {canDispute ? (
          <Button variant="ghost" size="sm" onClick={() => setDisputeOpen((v) => !v)}>
            Raise dispute
          </Button>
        ) : null}
      </div>

      {sellOpen ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sp">Sale price (₱)</Label>
              <Input id="sp" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br">Buyer reference</Label>
              <Input id="br" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="walk-in, receipt #…" />
            </div>
          </div>
          <Button
            size="sm"
            className="mt-3"
            disabled={pending === "sell"}
            onClick={() => run("sell", { sale_price: Number(price) || undefined, buyer_ref: buyer || undefined })}
          >
            {pending === "sell" ? "Recording…" : "Confirm sale"}
          </Button>
        </div>
      ) : null}

      {disputeOpen ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <Label htmlFor="dsub">Describe the issue</Label>
          <Input id="dsub" className="mt-1.5" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Describe the discrepancy" />
          <Button size="sm" className="mt-3" disabled={pending === "dispute"} onClick={submitDispute}>
            {pending === "dispute" ? "Submitting…" : "Submit dispute"}
          </Button>
        </div>
      ) : null}

      {msg ? (
        <p
          className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-ok-foreground" : "text-destructive"}`}
        >
          {msg.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
