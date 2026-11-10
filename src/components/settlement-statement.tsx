"use client";

import * as React from "react";
import { FileText, X, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettlementStatusPill } from "@/components/status-pill";
import { methodLabel } from "@/components/payment-receipt";
import { formatPHP, formatDate, formatDateTime } from "@/lib/utils";

export interface StatementLine { name: string; sku: string; qty_sold: number; unit_price: number; commission_pct: number; gross: number; commission: number }
export interface SettlementStatement {
  id: string; period_start: string; period_end: string; status: string; created_at: string;
  consignor_name: string; store_name: string;
  commission_pct: number; cadence: string; consignment_period_days: number; damage_liability: string;
  gross_sales: number; commission: number; returns_total: number; damage_total: number; net_payable: number;
  lines: StatementLine[];
  payment: { method: string | null; reference: string | null; amount: number | null; paid_at: string | null; confirmed_at: string | null } | null;
}

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SettlementStatementButton({ statement: s, label = "Statement" }: { statement: SettlementStatement; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = s.id.slice(0, 8).toUpperCase();
  const lineGross = s.lines.reduce((a, l) => a + l.gross, 0);
  const reconciled = s.lines.length > 0 && Math.abs(lineGross - s.gross_sales) < 0.01;

  function print() {
    const rows = s.lines.length
      ? s.lines.map((l) => `<tr><td>${l.name}<div class="sub">${l.sku}</div></td><td class="r">${l.qty_sold}</td><td class="r">${peso(l.unit_price)}</td><td class="r">${peso(l.gross)}</td><td class="r">${l.commission_pct}%</td><td class="r">${peso(l.commission)}</td><td class="r">${peso(l.gross - l.commission)}</td></tr>`).join("")
      : `<tr><td colspan="7" class="muted">Line detail not recorded for this statement.</td></tr>`;
    const pay = s.payment?.method
      ? `<div class="box"><b>Payment</b><div>${methodLabel(s.payment.method)}${s.payment.reference ? ` · ${s.payment.reference}` : ""}</div><div class="sub">Paid ${s.payment.paid_at ? formatDateTime(s.payment.paid_at) : "—"}${s.payment.confirmed_at ? ` · Confirmed ${formatDateTime(s.payment.confirmed_at)}` : ""}</div></div>`
      : `<div class="box"><b>Payment</b><div class="muted">Not yet paid</div></div>`;
    const w = window.open("", "_blank", "width=800,height=1000"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Statement ${ref}</title><style>
      *{font-family:"Helvetica Neue",Arial,sans-serif;box-sizing:border-box}body{margin:0;padding:32px;color:#111}
      h1{font-size:20px;margin:0}.muted{color:#777}.sub{font-size:11px;color:#777}.r{text-align:right}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px}
      .grid{display:flex;gap:16px;margin:16px 0}.box{flex:1;border:1px solid #e5e5e5;border-radius:10px;padding:12px;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
      th.r,td.r{text-align:right}tfoot td{border:0;padding:4px 8px}tfoot .tot{border-top:2px solid #111;font-weight:700;font-size:15px}
      .foot{margin-top:20px;font-size:11px;color:#777}
    </style></head><body>
      <div class="head"><div><h1>Settlement Statement</h1><div class="sub">ConsignTrack · Ref ${ref}</div></div>
        <div class="r"><div><b>${s.consignor_name}</b></div><div class="sub">${s.store_name}</div><div class="sub">${s.status.toUpperCase()}</div></div></div>
      <div class="grid">
        <div class="box"><b>Period</b><div>${formatDate(s.period_start)} – ${formatDate(s.period_end)}</div><div class="sub">Generated ${formatDateTime(s.created_at)}</div></div>
        <div class="box"><b>Terms</b><div>${s.commission_pct}% commission · ${s.cadence}</div><div class="sub">${s.consignment_period_days}-day period · ${s.damage_liability}-liable</div></div>
        ${pay}
      </div>
      <table><thead><tr><th>Product</th><th class="r">Qty sold</th><th class="r">Unit</th><th class="r">Gross</th><th class="r">Comm%</th><th class="r">Commission</th><th class="r">Net</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="6" class="r">Gross sales</td><td class="r">${peso(s.gross_sales)}</td></tr>
          <tr><td colspan="6" class="r">Commission</td><td class="r">− ${peso(s.commission)}</td></tr>
          ${s.returns_total ? `<tr><td colspan="6" class="r">Returns</td><td class="r">− ${peso(s.returns_total)}</td></tr>` : ""}
          ${s.damage_total ? `<tr><td colspan="6" class="r">Damage</td><td class="r">− ${peso(s.damage_total)}</td></tr>` : ""}
          <tr class="tot"><td colspan="6" class="r">Net payable to consignor</td><td class="r">${peso(s.net_payable)}</td></tr>
        </tfoot></table>
      <div class="foot">${reconciled ? "✓ Reconciled — line items sum to the statement total." : "Totals shown as recorded."} · Generated by ConsignTrack on ${formatDateTime(s.created_at)} · Ref ${ref}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><FileText className="h-4 w-4" /> {label}</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-card shadow-pop sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2"><h3 className="text-base font-semibold">Settlement statement</h3><span className="tnum rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">#{ref}</span></div>
                <p className="text-xs text-muted-foreground">{s.consignor_name} · {s.store_name}</p>
              </div>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Period" value={`${formatDate(s.period_start)} – ${formatDate(s.period_end)}`} sub={`Generated ${formatDate(s.created_at)}`} />
                <Info label="Terms" value={`${s.commission_pct}% · ${s.cadence}`} sub={`${s.consignment_period_days}d · ${s.damage_liability}-liable`} />
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                  <div className="mt-1"><SettlementStatusPill status={s.status} /></div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr><th className="p-2 text-left font-medium">Product</th><th className="p-2 text-right font-medium">Qty</th><th className="p-2 text-right font-medium">Gross</th><th className="p-2 text-right font-medium">Comm</th><th className="p-2 text-right font-medium">Net</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {s.lines.length ? s.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="p-2"><div className="font-medium">{l.name}</div><div className="tnum text-xs text-muted-foreground">{l.sku} · {formatPHP(l.unit_price)} · {l.commission_pct}%</div></td>
                        <td className="tnum p-2 text-right">{l.qty_sold}</td>
                        <td className="tnum p-2 text-right">{formatPHP(l.gross)}</td>
                        <td className="tnum p-2 text-right text-muted-foreground">−{formatPHP(l.commission)}</td>
                        <td className="tnum p-2 text-right font-medium">{formatPHP(l.gross - l.commission)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="p-4 text-center text-sm text-muted-foreground">Line detail not recorded for this legacy statement — totals below.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-1.5 rounded-xl border border-border p-4 text-sm">
                <Row label="Gross sales" value={formatPHP(s.gross_sales)} />
                <Row label="Commission" value={`− ${formatPHP(s.commission)}`} muted />
                {s.returns_total ? <Row label="Returns" value={`− ${formatPHP(s.returns_total)}`} muted /> : null}
                {s.damage_total ? <Row label="Damage" value={`− ${formatPHP(s.damage_total)}`} muted /> : null}
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold"><span>Net payable</span><span className="tnum">{formatPHP(s.net_payable)}</span></div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4 text-sm">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Payment</div>
                  {s.payment?.method ? (
                    <>
                      <div className="mt-1 font-medium">{methodLabel(s.payment.method)}{s.payment.reference ? <span className="tnum text-xs text-muted-foreground"> · {s.payment.reference}</span> : null}</div>
                      <div className="text-xs text-muted-foreground">Paid {s.payment.paid_at ? formatDateTime(s.payment.paid_at) : "—"}</div>
                      {s.payment.confirmed_at ? <div className="text-xs text-ok-foreground">Confirmed {formatDateTime(s.payment.confirmed_at)}</div> : null}
                    </>
                  ) : <div className="mt-1 text-muted-foreground">Not yet paid</div>}
                </div>
                <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${reconciled ? "border-ok/40 bg-ok/10 text-ok-foreground" : "border-border text-muted-foreground"}`}>
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>{reconciled ? "Reconciled — line items sum exactly to the statement total." : "Audit trail recorded; line-level detail unavailable for this statement."}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <Button variant="outline" onClick={print}><Printer className="h-4 w-4" /> Print / Save PDF</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}><span>{label}</span><span className="tnum">{value}</span></div>;
}
