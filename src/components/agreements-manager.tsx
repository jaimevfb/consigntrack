"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Pencil, X } from "lucide-react";
import { createAgreement, updateAgreement } from "@/app/_actions/agreements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";

export interface AgreementRow {
  id: string;
  consignorName: string;
  storeName: string;
  commission_pct: number;
  settlement_cadence: string;
  is_active: boolean;
}
interface NamedOption { id: string; name: string }
const CADENCES = ["weekly", "monthly", "quarterly"];

export function AgreementsManager({
  agreements,
  consignors,
  stores,
}: {
  agreements: AgreementRow[];
  consignors: NamedOption[];
  stores: NamedOption[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [cid, setCid] = React.useState(consignors[0]?.id ?? "");
  const [sid, setSid] = React.useState(stores[0]?.id ?? "");
  const [pct, setPct] = React.useState("15");
  const [cad, setCad] = React.useState("monthly");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createAgreement({ consignor_id: cid, store_id: sid, commission_pct: Number(pct), settlement_cadence: cad });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardHeader><CardTitle className="text-base">New agreement</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Consignor</Label>
                <Select value={cid} onValueChange={setCid}>
                  <SelectTrigger><SelectValue placeholder="Consignor" /></SelectTrigger>
                  <SelectContent>{consignors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Store</Label>
                <Select value={sid} onValueChange={setSid}>
                  <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
                  <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pct">Commission %</Label>
                <Input id="pct" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cadence</Label>
                <Select value={cad} onValueChange={setCad}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {error ? <p className="sm:col-span-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              <div className="sm:col-span-4 flex gap-2">
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create agreement"}</Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New agreement</Button>
      )}

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consignor</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((a) =>
                editId === a.id ? (
                  <EditRow key={a.id} row={a} onDone={() => { setEditId(null); router.refresh(); }} onCancel={() => setEditId(null)} />
                ) : (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.consignorName}</TableCell>
                    <TableCell>{a.storeName}</TableCell>
                    <TableCell className="tnum text-right">{a.commission_pct}%</TableCell>
                    <TableCell className="capitalize">{a.settlement_cadence}</TableCell>
                    <TableCell><StatusPill tone={a.is_active ? "ok" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</StatusPill></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditId(a.id)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {agreements.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No agreements yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditRow({ row, onDone, onCancel }: { row: AgreementRow; onDone: () => void; onCancel: () => void }) {
  const [pct, setPct] = React.useState(String(row.commission_pct));
  const [cad, setCad] = React.useState(row.settlement_cadence);
  const [active, setActive] = React.useState(row.is_active);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateAgreement({ id: row.id, commission_pct: Number(pct), settlement_cadence: cad, is_active: active });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{row.consignorName}</TableCell>
      <TableCell>{row.storeName}</TableCell>
      <TableCell className="text-right">
        <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} className="h-8 w-20 text-right tnum" />
        {err ? <div className="text-xs text-destructive">{err}</div> : null}
      </TableCell>
      <TableCell>
        <Select value={cad} onValueChange={setCad}>
          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <button type="button" onClick={() => setActive((v) => !v)}>
          <StatusPill tone={active ? "ok" : "neutral"}>{active ? "Active" : "Inactive"}</StatusPill>
        </button>
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Save" disabled={busy} onClick={save}><Check className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Cancel" onClick={onCancel}><X className="h-4 w-4" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
