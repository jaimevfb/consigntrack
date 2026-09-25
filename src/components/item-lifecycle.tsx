import { Check, Circle, AlertTriangle, Tag, Truck, PackageCheck, ShoppingBag, Banknote, Undo2 } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/utils";
import type { ItemStatus, ScanEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const HAPPY: { key: ItemStatus; label: string }[] = [
  { key: "labeled", label: "Labeled" },
  { key: "dispatched", label: "Dispatched" },
  { key: "received_confirmed", label: "Received" },
  { key: "listed", label: "Listed" },
  { key: "sold", label: "Sold" },
  { key: "settled", label: "Settled" },
];

const ORDER: Record<string, number> = {
  created: 0, labeled: 1, dispatched: 2, in_transit: 2, delivered: 2,
  received_confirmed: 3, listed: 4, sold: 5, settled: 6,
};

const BRANCH: Record<string, { tone: "warn" | "neutral"; label: string }> = {
  returned_to_consignor: { tone: "neutral", label: "Returned to consignor" },
  lost: { tone: "warn", label: "Lost" },
  damaged: { tone: "warn", label: "Damaged" },
  disputed: { tone: "warn", label: "Disputed" },
};

export function ItemStatusPill({ status }: { status: string }) {
  if (BRANCH[status]) return <StatusPill tone={BRANCH[status].tone}>{BRANCH[status].label}</StatusPill>;
  const tone = status === "sold" || status === "settled" ? "ok" : status === "labeled" || status === "created" ? "neutral" : "info";
  const label = HAPPY.find((h) => h.key === status)?.label ?? status.replace(/_/g, " ");
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

/** Horizontal custody chain / lifecycle stepper. */
export function LifecycleStepper({ status }: { status: string }) {
  const branch = BRANCH[status];
  const current = ORDER[status] ?? 1;
  return (
    <div>
      <ol className="flex items-center">
        {HAPPY.map((step, i) => {
          const idx = i + 1;
          const done = !branch && current > idx;
          const active = !branch && current === idx;
          return (
            <li key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary",
                    !done && !active && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <span className="tnum">{idx}</span>}
                </span>
                <span className={cn("text-[11px]", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
              {i < HAPPY.length - 1 ? (
                <div className={cn("mx-1 h-0.5 flex-1 rounded", done ? "bg-primary" : "bg-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
      {branch ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-warn/60 px-3 py-2 text-sm text-warn-foreground">
          <AlertTriangle className="h-4 w-4" /> This item is <strong>{branch.label.toLowerCase()}</strong> — outside the normal flow.
        </div>
      ) : null}
    </div>
  );
}

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  label: Tag, dispatch: Truck, in_transit: Truck, deliver: Truck,
  receive: PackageCheck, list: ShoppingBag, sell: Banknote, return: Undo2,
};

/** Vertical proof-of-custody timeline from scan events. */
export function CustodyTimeline({ events }: { events: ScanEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No scans recorded yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.event_type] ?? Circle;
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full border",
                e.is_exception ? "border-warn-foreground bg-warn text-warn-foreground" : "border-primary bg-card text-primary",
              )}
            >
              {e.is_exception ? <AlertTriangle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium capitalize">
                {e.is_exception ? "Rejected: " : ""}
                {e.event_type.replace(/_/g, " ")}
                {e.to_status ? <span className="font-normal text-muted-foreground"> → {e.to_status.replace(/_/g, " ")}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {e.actor_role ? <span className="capitalize">{e.actor_role.replace(/_/g, " ")}</span> : "system"}
              {e.reason ? ` · ${e.reason}` : e.note ? ` · ${e.note}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
