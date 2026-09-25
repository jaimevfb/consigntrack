import { cn } from "@/lib/utils";

/**
 * ConsignTrack mark — a ledger card (rounded square) holding two entry rows and
 * a settlement "coin", with a subtle upward notch: records in, value out.
 * Uses currentColor so it inherits the ledger-green accent and themes cleanly.
 */
export function Mark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const card = inverted ? "var(--primary-foreground)" : "currentColor";
  const glyph = inverted ? "var(--primary)" : "var(--primary-foreground)";
  const notch = inverted ? "var(--primary-foreground)" : "currentColor";
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden role="img">
      <rect x="2" y="2" width="28" height="28" rx="7" fill={card} />
      {/* ledger rows */}
      <rect x="8" y="11" width="13" height="2.6" rx="1.3" fill={glyph} opacity="0.95" />
      <rect x="8" y="16.7" width="9" height="2.6" rx="1.3" fill={glyph} opacity="0.75" />
      {/* settlement coin */}
      <circle cx="22.5" cy="20.5" r="3.2" fill={glyph} />
      <path d="M22.5 18.9v3.2M21.2 20.5h2.6" stroke={notch} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
  showMark = true,
  inverted = false,
}: {
  className?: string;
  markClassName?: string;
  showMark?: boolean;
  inverted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showMark ? <Mark inverted={inverted} className={cn("h-6 w-6 text-primary", markClassName)} /> : null}
      <span className="font-serif text-lg font-semibold tracking-tight">
        Consign<span className={inverted ? undefined : "text-primary"}>Track</span>
      </span>
    </span>
  );
}
