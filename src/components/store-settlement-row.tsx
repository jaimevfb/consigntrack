"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { SettlementStatusPill, StatusPill } from "@/components/status-pill";
import { PaymentReceipt } from "@/components/payment-receipt";
import { SettlementPayDialog } from "@/components/settlement-pay-dialog";
import { SettlementStatementButton, type SettlementStatement } from "@/components/settlement-statement";
import { formatPHP, formatDate } from "@/lib/utils";

export interface StoreSettlementRowData {
  id: string;
  consignorName: string;
  periodStart: string;
  periodEnd: string;
  net: number;
  gross: number;
  commission: number;
  commissionPct: number;
  returnsTotal: number;
  damageTotal: number;
  paid: number;
  remaining: number;
  status: string;
  payment: { method: string | null; reference: string | null; confirmed_at: string | null };
  statement: SettlementStatement;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t border-border pt-2 font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

export function StoreSettlementRow({ data: s }: { data: StoreSettlementRowData }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <TableRow className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setOpen((o) => !o)}>
        <TableCell className="whitespace-nowrap">
          <div className="flex items-center gap-2">
            <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
            <div>
              <div className="text-sm font-medium">{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</div>
              <div className="text-xs text-muted-foreground">{s.consignorName}</div>
            </div>
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap text-right">
          <div className="tnum font-semibold">{formatPHP(s.net)}</div>
          {s.status === "partial" ? <div className="tnum text-xs text-warn-foreground">{formatPHP(s.paid)} paid · {formatPHP(s.remaining)} due</div> : null}
        </TableCell>
        <TableCell><SettlementStatusPill status={s.status} /></TableCell>
        <TableCell><PaymentReceipt method={s.payment.method} reference={s.payment.reference} /></TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center justify-end gap-1">
            <SettlementStatementButton statement={s.statement} />
            {s.status === "pending" || s.status === "partial" ? (
              <SettlementPayDialog settlementId={s.id} amount={s.net} remaining={s.remaining} consignorName={s.consignorName} />
            ) : s.status === "paid" && !s.payment.confirmed_at ? (
              <span className="whitespace-nowrap text-xs text-muted-foreground">Awaiting consignor</span>
            ) : <StatusPill tone="ok">Settled</StatusPill>}
          </div>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="py-3">
            <div className="mx-auto max-w-xs space-y-1.5 text-sm">
              <Line label="Gross sales" value={formatPHP(s.gross)} />
              <Line label={`Commission (${s.commissionPct}%)`} value={`−${formatPHP(s.commission)}`} />
              {s.returnsTotal ? <Line label="Returns" value={`−${formatPHP(s.returnsTotal)}`} /> : null}
              {s.damageTotal ? <Line label="Damage" value={`−${formatPHP(s.damageTotal)}`} /> : null}
              <Line label="Net payable" value={formatPHP(s.net)} strong />
              {s.paid ? <Line label="Paid so far" value={formatPHP(s.paid)} /> : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
