"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Pencil, X, Trash2 } from "lucide-react";
import {
  createAgreement,
  updateAgreement,
  terminateAgreement,
  setCommissionOverride,
  removeCommissionOverride,
} from "@/app/_actions/agreements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";

export interface AgreementRow {
  id: string;
  consignorId: string;
  consignorName: string;
  storeName: string;
  commission_pct: number;
  settlement_cadence: string;
  is_active: boolean;
  damage_liability: "consignor" | "store" | "shared";
  damage_store_share_pct: number;
  consignment_period_days: number;
  end_of_period_action: "return" | "extend" | "discount";
  grace_extend_days: number;
  markdown_pct: number;
  receipt_grace_days: number;
}
interface NamedOption { id: string; name: string }
interface ProductOption { id: string; name: string; consignor_id: string }
export interface OverrideRow { agreement_id: string; product_id: string; commission_pct: number }

const CADENCES = ["weekly", "monthly", "quarterly"];
const LIABILITIES = [
  { v: "consignor", label: "Consignor absorbs loss" },
  { v: "store", label: "Store absorbs loss" },
  { v: "shared", label: "Shared loss" },
];
const EOP = [
  { v: "return", label: "Return to consignor" },
  { v: "extend", label: "Auto-extend window" },
  { v: "discount", label: "Auto-discount & extend" },
];

interface Terms {
  pct: string; cad: string; liability: string; share: string;
  period: string; eop: string; graceExtend: string; markdown: string; receiptGrace: string;
}
const DEFAULT_TERMS: Terms = {
  pct: "15", cad: "monthly", liability: "consignor", share: "50",
  period: "60", eop: "return", graceExtend: "30", markdown: "20", receiptGrace: "14",
};

function TermsFields({ t, set, idPrefix }: { t: Terms; set: (patch: Partial<Terms>) => void; idPrefix: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-pct`}>Commission %</Label>
        <Input id={`${idPrefix}-pct`} type="number" value={t.pct} onChange={(e) => set({ pct: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Settlement cadence</Label>
        <Select value={t.cad} onValueChange={(v) => set({ cad: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CADENCES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Damage liability</Label>
        <Select value={t.liability} onValueChange={(v) => set({ liability: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{LIABILITIES.map((l) => <SelectItem key={l.v} value={l.v}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {t.liability === "shared" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-share`}>Store&rsquo;s share of loss %</Label>
          <Input id={`${idPrefix}-share`} type="number" value={t.share} onChange={(e) => set({ share: e.target.value })} />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-period`}>Consignment period (days)</Label>
        <Input id={`${idPrefix}-period`} type="number" value={t.period} onChange={(e) => set({ period: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>End-of-period action</Label>
        <Select value={t.eop} onValueChange={(v) => set({ eop: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{EOP.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {t.eop !== "return" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-grace`}>Extend by (days)</Label>
          <Input id={`${idPrefix}-grace`} type="number" value={t.graceExtend} onChange={(e) => set({ graceExtend: e.target.value })} />
        </div>
      ) : null}
      {t.eop === "discount" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-markdown`}>Markdown %</Label>
          <Input id={`${idPrefix}-markdown`} type="number" value={t.markdown} onChange={(e) => set({ markdown: e.target.value })} />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-receipt`}>Receipt grace (days)</Label>
        <Input id={`${idPrefix}-receipt`} type="number" value={t.receiptGrace} onChange={(e) => set({ receiptGrace: e.target.value })} />
      </div>
    </div>
  );
}

function termsToPayload(t: Terms) {
  return {
    commission_pct: Number(t.pct),
    settlement_cadence: t.cad,
    damage_liability: t.liability,
    damage_store_share_pct: Number(t.share),
    consignment_period_days: Number(t.period),
    end_of_period_action: t.eop,
    grace_extend_days: Number(t.graceExtend),
    markdown_pct: Number(t.markdown),
    receipt_grace_days: Number(t.receiptGrace),
  };
}

export function AgreementsManager({
  agreements,
  consignors,
  stores,
  products,
  overrides,
}: {
  agreements: AgreementRow[];
  consignors: NamedOption[];
  stores: NamedOption[];
  products: ProductOption[];
  overrides: OverrideRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [cid, setCid] = React.useState(consignors[0]?.id ?? "");
  const [sid, setSid] = React.useState(stores[0]?.id ?? "");
  const [t, setT] = React.useState<Terms>(DEFAULT_TERMS);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);
  const patch = (p: Partial<Terms>) => setT((prev) => ({ ...prev, ...p }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createAgreement({ consignor_id: cid, store_id: sid, ...termsToPayload(t) });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setAdding(false);
    setT(DEFAULT_TERMS);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <Card>
          <CardHeader><CardTitle className="text-base">New agreement</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </div>
              <TermsFields t={t} set={patch} idPrefix="new" />
              {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
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
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consignor</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((a) =>
                editId === a.id ? (
                  <EditRow
                    key={a.id}
                    row={a}
                    products={products.filter((p) => p.consignor_id === a.consignorId)}
                    overrides={overrides.filter((o) => o.agreement_id === a.id)}
                    onDone={() => { setEditId(null); router.refresh(); }}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.consignorName}</TableCell>
                    <TableCell>{a.storeName}</TableCell>
                    <TableCell className="tnum text-right">{a.commission_pct}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.consignment_period_days}d · {liabilityShort(a)} · {eopShort(a.end_of_period_action)}
                    </TableCell>
                    <TableCell><StatusPill tone={a.is_active ? "ok" : "neutral"}>{a.is_active ? "Active" : "Inactive"}</StatusPill></TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditId(a.id)}><Pencil className="h-4 w-4" /></Button>
                        {a.is_active ? <AgreementTerminateButton id={a.id} label={`${a.consignorName} → ${a.storeName}`} /> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {agreements.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No agreements yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function liabilityShort(a: AgreementRow) {
  if (a.damage_liability === "consignor") return "consignor-liable";
  if (a.damage_liability === "store") return "store-liable";
  return `shared ${a.damage_store_share_pct}%`;
}
function eopShort(v: string) {
  return v === "return" ? "return" : v === "extend" ? "extend" : "discount";
}

function AgreementTerminateButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    const res = await terminateAgreement({ id });
    setBusy(false);
    if (!res.ok) { setConfirming(false); return; }
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" aria-label={`Terminate agreement ${label}`} className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirming(true)}>
        Terminate
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
      <Button variant="destructive" size="sm" disabled={busy} onClick={run}>{busy ? "…" : "Confirm"}</Button>
    </span>
  );
}

function EditRow({
  row, products, overrides, onDone, onCancel,
}: {
  row: AgreementRow;
  products: ProductOption[];
  overrides: OverrideRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [t, setT] = React.useState<Terms>({
    pct: String(row.commission_pct), cad: row.settlement_cadence, liability: row.damage_liability,
    share: String(row.damage_store_share_pct), period: String(row.consignment_period_days),
    eop: row.end_of_period_action, graceExtend: String(row.grace_extend_days),
    markdown: String(row.markdown_pct), receiptGrace: String(row.receipt_grace_days),
  });
  const [active, setActive] = React.useState(row.is_active);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const patch = (p: Partial<Terms>) => setT((prev) => ({ ...prev, ...p }));

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateAgreement({ id: row.id, is_active: active, ...termsToPayload(t) });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/30">
        <div className="space-y-4 p-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{row.consignorName} &rarr; {row.storeName}</span>
            <button type="button" onClick={() => setActive((v) => !v)}>
              <StatusPill tone={active ? "ok" : "neutral"}>{active ? "Active" : "Inactive"}</StatusPill>
            </button>
          </div>
          <TermsFields t={t} set={patch} idPrefix={`e-${row.id}`} />
          <CommissionOverrides agreementId={row.id} products={products} initial={overrides} fallbackPct={Number(t.pct)} />
          {err ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={save}><Check className="h-4 w-4" /> {busy ? "Saving…" : "Save terms"}</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /> Cancel</Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CommissionOverrides({
  agreementId, products, initial, fallbackPct,
}: {
  agreementId: string;
  products: ProductOption[];
  initial: OverrideRow[];
  fallbackPct: number;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<OverrideRow[]>(initial);
  const unset = products.filter((p) => !rows.some((r) => r.product_id === p.id));
  const [pid, setPid] = React.useState(unset[0]?.id ?? "");
  const [pct, setPct] = React.useState("10");
  const [busy, setBusy] = React.useState(false);
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  async function add() {
    if (!pid) return;
    setBusy(true);
    const res = await setCommissionOverride({ agreement_id: agreementId, product_id: pid, commission_pct: Number(pct) });
    setBusy(false);
    if (res.ok) {
      setRows((r) => [...r.filter((x) => x.product_id !== pid), { agreement_id: agreementId, product_id: pid, commission_pct: Number(pct) }]);
      router.refresh();
    }
  }
  async function remove(productId: string) {
    setBusy(true);
    const res = await removeCommissionOverride({ agreement_id: agreementId, product_id: productId });
    setBusy(false);
    if (res.ok) {
      setRows((r) => r.filter((x) => x.product_id !== productId));
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Per-product commission</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Products without an override settle at the agreement rate ({fallbackPct}%).
      </p>
      {products.length === 0 ? (
        <p className="text-xs text-muted-foreground">This consignor has no products yet.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.product_id} className="flex items-center justify-between gap-2 text-sm">
                <span>{name(r.product_id)}</span>
                <span className="flex items-center gap-2">
                  <span className="tnum font-medium">{r.commission_pct}%</span>
                  <Button variant="ghost" size="icon" aria-label="Remove override" disabled={busy} onClick={() => remove(r.product_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </div>
            ))}
            {rows.length === 0 ? <p className="text-xs text-muted-foreground">No per-product overrides.</p> : null}
          </div>
          {unset.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1 space-y-1.5">
                <Label className="text-xs">Product</Label>
                <Select value={pid} onValueChange={setPid}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>{unset.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="text-xs">Rate %</Label>
                <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} className="h-8 tnum" />
              </div>
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={add}><Plus className="h-4 w-4" /> Set</Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
