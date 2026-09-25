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

/** Area + line trend chart with a light baseline and sparse x labels. */
export function AreaTrend({
  points,
  height = 180,
  valueLabel,
  stroke = "var(--primary)",
}: {
  points: TrendPoint[];
  height?: number;
  valueLabel?: (n: number) => string;
  stroke?: string;
}) {
  const w = 640;
  const h = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const innerH = h - padTop - padBottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? (w - padX * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => {
    const x = padX + i * step;
    const y = padTop + innerH - (p.value / max) * innerH;
    return [x, y] as const;
  });
  const line = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${padTop + innerH} L${xy[0][0]},${padTop + innerH} Z` : "";
  const gridYs = [0, 0.5, 1].map((f) => padTop + innerH - f * innerH);
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Sales trend">
        {gridYs.map((y, i) => (
          <line key={i} x1={0} x2={w} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
        ))}
        {area ? <path d={area} fill={stroke} opacity={0.12} /> : null}
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {xy.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={2} fill={stroke} />
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={i}
              x={padX + i * step}
              y={h - 6}
              textAnchor="middle"
              className="fill-[var(--muted-foreground)]"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      {valueLabel ? (
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span className="tnum">0</span>
          <span className="tnum">peak {valueLabel(max)}</span>
        </div>
      ) : null}
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
