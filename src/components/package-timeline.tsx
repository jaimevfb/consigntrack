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
    <ol>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className="flex gap-3.5">
            {/* marker + connector column, centered */}
            <div className="flex flex-col items-center">
              <span className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                s.warn ? "border-warn-foreground text-warn-foreground" : s.done ? "border-primary text-primary" : "border-border text-muted-foreground",
              ].join(" ")}>
                {s.warn ? <AlertTriangle className="h-4 w-4" /> : s.done ? <Check className="h-4 w-4" /> : <span className="tnum text-xs">{i + 1}</span>}
              </span>
              {!last ? <span className={`my-1 w-0.5 flex-1 rounded-full ${s.done ? "bg-primary/40" : "bg-border"}`} /> : null}
            </div>
            {/* content */}
            <div className={`min-w-0 flex-1 pt-1 ${last ? "pb-0" : "pb-6"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className={`text-sm font-medium ${s.done ? "" : "text-muted-foreground"}`}>{s.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.at ? formatDateTime(s.at) : "pending"}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
