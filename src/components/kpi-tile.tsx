import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small inline stat used in analytics card headers (Income/Expenses/Balance style). */
export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  tone = "default",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  /** signed percentage, e.g. 11 or -4; renders a coloured chip */
  delta?: number | null;
  tone?: "default" | "warn" | "ok";
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
          {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</div> : null}
        </div>
        {Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div
          className={cn(
            "tnum text-2xl font-semibold leading-none",
            tone === "warn" && "text-warn-foreground",
            tone === "ok" && "text-ok-foreground",
          )}
        >
          {value}
        </div>
        {typeof delta === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
              up ? "bg-ok text-ok-foreground" : "bg-warn text-warn-foreground",
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
