const METHOD_LABELS: Record<string, string> = {
  gcash: "GCash",
  maya: "Maya",
  instapay: "InstaPay",
  bank_transfer: "Bank transfer",
};

export function methodLabel(method: string | null): string {
  if (!method) return "—";
  return METHOD_LABELS[method] ?? method;
}

/** Compact method + transaction reference shown once a payment has been sent. */
export function PaymentReceipt({
  method,
  reference,
}: {
  method: string | null;
  reference: string | null;
}) {
  if (!method && !reference) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-col gap-0.5 leading-tight">
      <span className="text-sm font-medium">{methodLabel(method)}</span>
      {reference ? <span className="tnum text-[11px] text-muted-foreground">{reference}</span> : null}
    </span>
  );
}
