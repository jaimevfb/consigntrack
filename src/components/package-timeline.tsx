import { Check, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { PackageDetail } from "@/lib/ledger-data";

interface Step { label: string; at: string | null; done: boolean; warn?: boolean }

export function PackageTimeline({ pkg }: { pkg: PackageDetail }) {
  const disputed = pkg.status === "PARTIAL_DISPUTED";
  let steps: Step[];
  if (pkg.direction === "RETURN") {
    const received = pkg.status === "RECEIVED_BY_CONSIGNOR";
    steps = [
      { label: "Return built", at: pkg.created_at, done: true },
      { label: "In transit", at: pkg.in_transit_at ?? pkg.created_at, done: true },
      { label: "Received by consignor", at: received ? pkg.settled_at : null, done: received },
    ];
  } else {
    const dispatched = !!pkg.in_transit_at || ["IN_TRANSIT", "DELIVERED", "PARTIAL_DISPUTED"].includes(pkg.status);
    const delivered = ["DELIVERED", "PARTIAL_DISPUTED"].includes(pkg.status);
    steps = [
      { label: "Packed", at: pkg.created_at, done: true },
      { label: "Dispatched", at: pkg.in_transit_at, done: dispatched },
      { label: disputed ? "Delivered — partial/disputed" : "Delivered", at: delivered ? pkg.updated_at : null, done: delivered, warn: disputed },
    ];
  }

  return (
    <ol className="relative ml-3 space-y-5 border-l border-border pl-6">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className={[
            "absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-card",
            s.warn ? "border-warn-foreground text-warn-foreground" : s.done ? "border-primary text-primary" : "border-border text-muted-foreground",
          ].join(" ")}>
            {s.warn ? <AlertTriangle className="h-3.5 w-3.5" /> : s.done ? <Check className="h-3.5 w-3.5" /> : <span className="tnum text-xs">{i + 1}</span>}
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-sm font-medium ${s.done ? "" : "text-muted-foreground"}`}>{s.label}</span>
            {s.at ? <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(s.at)}</span> : <span className="shrink-0 text-xs text-muted-foreground">pending</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
