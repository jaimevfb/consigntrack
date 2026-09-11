"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { generateSettlement } from "@/app/_actions/ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AgreementOption {
  id: string;
  consignorName: string;
  commissionPct: number;
  cadence: string;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function GenerateSettlementForm({ agreements }: { agreements: AgreementOption[] }) {
  const router = useRouter();
  const range = monthRange();
  const [agreementId, setAgreementId] = React.useState(agreements[0]?.id ?? "");
  const [start, setStart] = React.useState(range.start);
  const [end, setEnd] = React.useState(range.end);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!agreementId) {
      setError("Select an agreement.");
      return;
    }
    setSaving(true);
    const res = await generateSettlement({
      agreement_id: agreementId,
      period_start: start,
      period_end: end,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate a statement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Agreement</Label>
            <Select value={agreementId} onValueChange={setAgreementId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agreement" />
              </SelectTrigger>
              <SelectContent>
                {agreements.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.consignorName} · {a.commissionPct}% · {a.cadence}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ps">Period start</Label>
              <Input id="ps" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe">Period end</Label>
              <Input id="pe" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}
          {ok ? <p className="text-sm text-ok-foreground">Statement generated below.</p> : null}
          <Button type="submit" disabled={saving || agreements.length === 0}>
            <FileText className="h-4 w-4" />
            {saving ? "Generating…" : "Generate statement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
