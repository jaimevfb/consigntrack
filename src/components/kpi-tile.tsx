import { Sparkline } from "@/components/charts";
import { cn } from "@/lib/utils";

export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  spark,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "ok";
  spark?: number[];
}) {
  const hasSpark = spark && spark.some((n) => n > 0);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
      </div>
      <div
        className={cn(
          "tnum mt-1.5 text-2xl font-semibold",
          tone === "warn" && "text-warn-foreground",
          tone === "ok" && "text-ok-foreground",
        )}
      >
        {value}
      </div>
      {hasSpark ? <Sparkline data={spark!} className="mt-2" /> : null}
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
