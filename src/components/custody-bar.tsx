import * as React from "react";

export interface CustodySeg { key: string; label: string; value: number }

// Fixed meanings → fixed fills (survive grayscale; transit is hatched).
const FILL: Record<string, string> = {
  warehouse: "var(--muted-foreground)",
  transit: "var(--primary)",
  onhand: "var(--ok-foreground)",
  disputed: "var(--warn-foreground)",
  sold: "var(--border)",
};

/** Proportional custody bar with printed counts. Zero segments are dropped. */
export function CustodyBar({ segments, compact = false }: { segments: CustodySeg[]; compact?: boolean }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">No units tracked.</p>;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Custody distribution">
        {shown.map((s) => (
          <div key={s.key} className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: FILL[s.key] ?? "var(--muted-foreground)",
              backgroundImage: s.key === "transit" ? "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,.45) 3px, rgba(255,255,255,.45) 6px)" : undefined,
            }} />
        ))}
      </div>
      {!compact ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {shown.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: FILL[s.key] ?? "var(--muted-foreground)" }} />
              {s.label} <span className="tnum font-medium text-foreground">{s.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
