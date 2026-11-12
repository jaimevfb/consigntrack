import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as Philippine pesos, e.g. ₱4,590.00 */
export function formatPHP(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return peso.format(Number.isFinite(n as number) ? (n as number) : 0);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("en-PH").format(Number.isFinite(n as number) ? (n as number) : 0);
}

/** The app runs on Philippine Standard Time regardless of server/browser locale. */
export const PH_TZ = "Asia/Manila";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: PH_TZ });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PH_TZ,
  });
}

/** Manila calendar date as YYYY-MM-DD — use this to bucket timestamps by PH day. */
export function phDateKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: PH_TZ }).format(d);
}

/** Manila month/day label like "11/12". */
export function phMonthDay(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: PH_TZ, month: "numeric", day: "numeric" }).formatToParts(d);
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${m}/${day}`;
}

/** Short, monospace-friendly id, e.g. "a1b2c3" from a uuid. */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}
