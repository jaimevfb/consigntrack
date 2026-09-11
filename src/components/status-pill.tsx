import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  ok: "bg-ok text-ok-foreground",
  warn: "bg-warn text-warn-foreground",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent text-accent-foreground",
};

/**
 * A labelled status pill. Colour is always paired with text — never colour
 * alone — per the design direction and WCAG.
 */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      {children}
    </span>
  );
}

const settlementTone: Record<string, Tone> = {
  pending: "warn",
  paid: "info",
  confirmed: "ok",
};

export function SettlementStatusPill({ status }: { status: string }) {
  const label =
    status === "confirmed" ? "Confirmed" : status === "paid" ? "Paid — awaiting" : "Pending";
  return <StatusPill tone={settlementTone[status] ?? "neutral"}>{label}</StatusPill>;
}

const deliveryTone: Record<string, Tone> = {
  draft: "neutral",
  sent: "info",
  confirmed: "ok",
};

export function DeliveryStatusPill({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <StatusPill tone={deliveryTone[status] ?? "neutral"}>{label}</StatusPill>;
}
