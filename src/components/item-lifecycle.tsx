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

const EVENT_TITLE: Record<string, string> = {
  label: "Labeled & QR issued",
  dispatch: "Dispatched to store",
  in_transit: "In transit",
  deliver: "Delivered",
  receive: "Received & confirmed",
  list: "Listed for sale",
  sell: "Sold",
  return: "Returned to consignor",
};

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Vertical proof-of-custody timeline from scan events — a standard activity feed. */
export function CustodyTimeline({ events }: { events: ScanEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No scans recorded yet.</p>;
  return (
    <ol className="relative ml-3 space-y-5 border-l border-border pl-6">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.event_type] ?? Circle;
        const title = e.is_exception
          ? `Rejected — ${EVENT_TITLE[e.event_type] ?? titleCase(e.event_type)}`
          : EVENT_TITLE[e.event_type] ?? titleCase(e.event_type);
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-card",
                e.is_exception ? "border-warn-foreground text-warn-foreground" : "border-primary text-primary",
              )}
            >
              {e.is_exception ? <AlertTriangle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-medium capitalize text-foreground/70">
                {e.actor_role ? e.actor_role.replace(/_/g, " ") : "system"}
              </span>
              {e.to_status ? <span>moved to {titleCase(e.to_status)}</span> : null}
              {e.reason ? <span>· {e.reason}</span> : e.note ? <span>· {e.note}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
