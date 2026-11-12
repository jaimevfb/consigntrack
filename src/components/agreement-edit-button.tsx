"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateAgreementTerms } from "@/app/_actions/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AgreementTerms {
  id: string;
  storeName: string;
  commission_pct: number;
  cadence: string;
  damage_liability: "consignor" | "store" | "shared";
  damage_store_share_pct: number;
  consignment_period_days: number;
  end_of_period_action: "return" | "extend" | "discount";
  is_active: boolean;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}

export function AgreementEditButton({ agreement: a }: { agreement: AgreementTerms }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [commission, setCommission] = React.useState(String(a.commission_pct));
  const [cadence, setCadence] = React.useState(a.cadence);
  const [liability, setLiability] = React.useState(a.damage_liability);
  const [share, setShare] = React.useState(String(a.damage_store_share_pct));
  const [period, setPeriod] = React.useState(String(a.consignment_period_days));
  const [eop, setEop] = React.useState(a.end_of_period_action);
  const [active, setActive] = React.useState(a.is_active);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateAgreementTerms({
      id: a.id,
      commission_pct: Number(commission) || 0,
      cadence,
      damage_liability: liability,
      damage_store_share_pct: Number(share) || 0,
      consignment_period_days: Number(period) || 60,
      end_of_period_action: eop,
      is_active: active,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setOpen(false); router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Edit agreement" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 text-left shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">Edit agreement</h3>
                <div className="text-xs text-muted-foreground">{a.storeName}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Commission (%)"><Input type="number" inputMode="decimal" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} /></Field>
              <Field label="Settlement cadence">
                <Select value={cadence} onValueChange={setCadence}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent></Select>
              </Field>
              <Field label="Damage liability">
                <Select value={liability} onValueChange={(v) => setLiability(v as AgreementTerms["damage_liability"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="consignor">Consignor</SelectItem><SelectItem value="store">Store</SelectItem><SelectItem value="shared">Shared</SelectItem>
                </SelectContent></Select>
              </Field>
              <Field label="Store damage share (%)"><Input type="number" inputMode="decimal" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} disabled={liability !== "shared"} /></Field>
              <Field label="Consignment period (days)"><Input type="number" inputMode="numeric" min={1} value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
              <Field label="End of period">
                <Select value={eop} onValueChange={(v) => setEop(v as AgreementTerms["end_of_period_action"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="return">Return</SelectItem><SelectItem value="extend">Extend</SelectItem><SelectItem value="discount">Discount</SelectItem>
                </SelectContent></Select>
              </Field>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Agreement active
            </label>

            {err ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
