import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
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
  href,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  /** signed percentage, e.g. 11 or -4; renders a coloured chip */
  delta?: number | null;
  tone?: "default" | "warn" | "ok";
  /** when set, the whole tile links here and shows a hover affordance */
  href?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div
          className={cn(
            "tnum text-[28px] font-bold leading-none tracking-tight",
            tone === "warn" && "text-warn-foreground",
            tone === "ok" && "text-ok-foreground",
          )}
        >
          {value}
        </div>
        {typeof delta === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              up ? "bg-ok text-ok-foreground" : "bg-destructive/10 text-destructive",
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : <span />}
        {href ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /> : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group block rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40 hover:bg-muted/30">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-card">{inner}</div>;
}
