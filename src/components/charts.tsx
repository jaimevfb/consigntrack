import { cn } from "@/lib/utils";

// Shared token-based series colours (light + dark safe).
export const SERIES = [
  "var(--primary)",
  "var(--warn-foreground)",
  "var(--ok-foreground)",
  "var(--muted-foreground)",
];

/** Tiny inline sparkline for KPI tiles. */
export function Sparkline({
  data,
  className,
  stroke = "var(--primary)",
  fill = true,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: boolean;
}) {
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const span = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => [i * step, h - ((d - min) / span) * (h - 4) - 2] as const);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-full", className)} preserveAspectRatio="none" aria-hidden>
      {fill ? <path d={area} fill={stroke} opacity={0.12} /> : null}
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface TrendPoint {
  label: string;
  value: number;
}

/** Smooth a polyline into a bezier path (Catmull-Rom → cubic). */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.16;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Compact, smoothed area+line trend with a real y-axis and light grid. */
export function AreaTrend({
  points,
  height = 150,
  valueLabel = (n) => String(n),
  stroke = "var(--primary)",
}: {
  points: TrendPoint[];
  height?: number;
  valueLabel?: (n: number) => string;
  stroke?: string;
}) {
  const w = 640;
  const h = height;
  const padL = 44;
  const padR = 10;
  const padTop = 10;
  const padBottom = 22;
  const innerW = w - padL - padR;
  const innerH = h - padTop - padBottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xy = points.map((p, i) => [padL + i * step, padTop + innerH - (p.value / max) * innerH] as const);
  const line = smoothPath(xy);
  const area = xy.length ? `${line} L${xy[xy.length - 1][0].toFixed(1)},${padTop + innerH} L${xy[0][0].toFixed(1)},${padTop + innerH} Z` : "";
  const ticks = [1, 0.5, 0];
  const labelEvery = Math.ceil(points.length / 7);
  const gid = `grad-${stroke.replace(/[^a-z]/gi, "")}`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Trend">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((f, i) => {
          const y = padTop + innerH - f * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
              <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-[var(--muted-foreground)]" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}>
                {valueLabel(Math.round(max * f))}
              </text>
            </g>
          );
        })}
        {area ? <path d={area} fill={`url(#${gid})`} /> : null}
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={padL + i * step} y={h - 6} textAnchor="middle" className="fill-[var(--muted-foreground)]" style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}>
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

/** Donut chart with a centered total and a legend. */
export function Donut({
  segments,
  centerLabel,
  centerValue,
  size = 160,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = size / 2;
  const stroke = size * 0.16;
  const radius = r - stroke / 2 - 1;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        <circle cx={r} cy={r} r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * circ;
            const el = (
              <circle
                key={i}
                cx={r}
                cy={r}
                r={radius}
                fill="none"
                stroke={s.color ?? SERIES[i % SERIES.length]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${r} ${r})`}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        {centerValue ? (
          <text x={r} y={r - 2} textAnchor="middle" className="fill-[var(--foreground)]" style={{ fontSize: size * 0.16, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text x={r} y={r + size * 0.12} textAnchor="middle" className="fill-[var(--muted-foreground)]" style={{ fontSize: size * 0.08 }}>
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color ?? SERIES[i % SERIES.length] }} />
            <span className="text-muted-foreground">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal ranked bars (labelled), for top products / consignors / stores. */
export function RankedBars({
  rows,
  valueFormat,
  max,
}: {
  rows: { label: string; value: number; sub?: string }[];
  valueFormat: (n: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{r.label}</span>
              <span className="tnum shrink-0 text-sm">{valueFormat(r.value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
              <div className="h-full rounded-sm bg-primary" style={{ width: `${Math.min(100, (r.value / top) * 100)}%` }} />
            </div>
          </div>
          {r.sub ? <span className="tnum text-xs text-muted-foreground">{r.sub}</span> : <span />}
        </div>
      ))}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : null}
    </div>
  );
}
