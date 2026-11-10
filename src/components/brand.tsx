import { cn } from "@/lib/utils";

/**
 * ConsignTrack mark — a scan viewfinder locked onto a package: the app's core
 * act (scan to track stock). Gradient tile, white glyph; inverts to a white
 * tile with a primary glyph on coloured backgrounds.
 */
export function Mark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? "var(--primary-foreground)" : "url(#ctmark)";
  const glyph = inverted ? "var(--primary)" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden role="img">
      <defs>
        <linearGradient id="ctmark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8.5" fill={tile} />
      <g stroke={glyph} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M8.5 12V10.2A1.7 1.7 0 0 1 10.2 8.5H12" />
        <path d="M20 8.5h1.8A1.7 1.7 0 0 1 23.5 10.2V12" />
        <path d="M8.5 20v1.8A1.7 1.7 0 0 0 10.2 23.5H12" />
        <path d="M20 23.5h1.8A1.7 1.7 0 0 0 23.5 21.8V20" />
      </g>
      <rect x="13" y="13" width="6" height="6" rx="1.7" fill={glyph} />
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
