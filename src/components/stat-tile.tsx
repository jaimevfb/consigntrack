import { cn } from "@/lib/utils";

/** A dense dashboard tile: a mono figure over an uppercase label, no big icons. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "ok";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "tnum mt-1.5 text-2xl font-semibold tabular-nums",
          tone === "warn" && "text-warn-foreground",
          tone === "ok" && "text-ok-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** A thin proportional bar for per-store / per-product comparisons. */
export function PerfBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-sm bg-muted" role="img" aria-label={`${pct}%`}>
      <div className="h-full rounded-sm bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
