"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Link2 } from "lucide-react";
import { connectPartner } from "@/app/_actions/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";

interface Partner { id: string; name: string }
export interface ExistingAgreement {
  partnerName: string;
  commission_pct: number;
  cadence: string;
  active: boolean;
  periodDays?: number;
  liability?: "consignor" | "store" | "shared";
  endOfPeriod?: "return" | "extend" | "discount";
}

export function ConnectPartner({
  perspective,
  selfId,
  directory,
  existing,
  connectedIds,
}: {
  perspective: "consignor" | "consignee";
  selfId: string;
  directory: Partner[];
  existing: ExistingAgreement[];
  connectedIds: string[];
}) {
  const router = useRouter();
  const available = directory.filter((d) => !connectedIds.includes(d.id));
  const [adding, setAdding] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState(available[0]?.id ?? "");
  const [pct, setPct] = React.useState("15");
  const [cad, setCad] = React.useState("monthly");
  const [liability, setLiability] = React.useState("consignor");
  const [share, setShare] = React.useState("50");
  const [period, setPeriod] = React.useState("60");
  const [eop, setEop] = React.useState("return");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  const partnerNoun = perspective === "consignor" ? "store" : "consignor";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!partnerId) return setError(`Select a ${partnerNoun}.`);
    setBusy(true);
    const res = await connectPartner({
      consignor_id: perspective === "consignor" ? selfId : partnerId,
      store_id: perspective === "consignee" ? selfId : partnerId,
      commission_pct: Number(pct),
      cadence: cad,
      damage_liability: liability,
      damage_store_share_pct: Number(share),
      consignment_period_days: Number(period),
      end_of_period_action: eop,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOk(true);
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect a {partnerNoun}</CardTitle>
            <p className="text-xs text-muted-foreground">Create an active agreement to begin transacting with this partner.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="capitalize">{partnerNoun}</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder={`Select ${partnerNoun}`} /></SelectTrigger>
                  <SelectContent>
                    {available.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpct">Commission %</Label>
                <Input id="cpct" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cadence</Label>
                <Select value={cad} onValueChange={setCad}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["weekly", "monthly", "quarterly"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Damage liability</Label>
                <Select value={liability} onValueChange={setLiability}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consignor">Consignor absorbs loss</SelectItem>
                    <SelectItem value="store">Store absorbs loss</SelectItem>
                    <SelectItem value="shared">Shared loss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {liability === "shared" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cshare">Store&rsquo;s share of loss %</Label>
                  <Input id="cshare" type="number" value={share} onChange={(e) => setShare(e.target.value)} />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="cperiod">Consignment period (days)</Label>
                <Input id="cperiod" type="number" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>When the period ends</Label>
                <Select value={eop} onValueChange={setEop}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="return">Return to consignor</SelectItem>
                    <SelectItem value="extend">Auto-extend window</SelectItem>
                    <SelectItem value="discount">Auto-discount &amp; extend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error ? <p className="sm:col-span-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              <div className="sm:col-span-3 flex gap-2">
                <Button type="submit" disabled={busy || available.length === 0}>{busy ? "Connecting…" : "Connect"}</Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)} disabled={available.length === 0}>
          <Plus className="h-4 w-4" /> Connect a {partnerNoun}
        </Button>
      )}

      {ok ? <p className="flex items-center gap-1.5 text-sm text-ok-foreground"><Check className="h-4 w-4" /> Partner connected.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" /> Your partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="capitalize">{partnerNoun}</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existing.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{a.partnerName}</TableCell>
                  <TableCell className="tnum text-right">{a.commission_pct}%</TableCell>
                  <TableCell className="capitalize">{a.cadence}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.periodDays ? `${a.periodDays}d` : "—"}
                    {a.liability ? ` · ${a.liability === "shared" ? "shared" : a.liability + "-liable"}` : ""}
                    {a.endOfPeriod ? ` · ${a.endOfPeriod}` : ""}
                  </TableCell>
                  <TableCell><StatusPill tone={a.active ? "ok" : "neutral"}>{a.active ? "Active" : "Inactive"}</StatusPill></TableCell>
                </TableRow>
              ))}
              {existing.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No partners yet. Connect one to begin.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
