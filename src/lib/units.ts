// Units of measure for products. Per the per-QR-item model, each issued item is
// one labeled package; the unit describes that package (e.g. a "dozen" = one
// 12-pack under one QR). Kept framework-free so both server and client can use it.

export type UnitKey =
  | "piece"
  | "dozen"
  | "pack"
  | "set"
  | "kilogram"
  | "gram"
  | "liter"
  | "milliliter"
  | "ounce"
  | "meter";

export const UNITS: { key: UnitKey; label: string; short: string }[] = [
  { key: "piece", label: "Piece", short: "pc" },
  { key: "dozen", label: "Dozen", short: "dz" },
  { key: "pack", label: "Pack", short: "pack" },
  { key: "set", label: "Set", short: "set" },
  { key: "kilogram", label: "Kilogram", short: "kg" },
  { key: "gram", label: "Gram", short: "g" },
  { key: "liter", label: "Liter", short: "L" },
  { key: "milliliter", label: "Milliliter", short: "mL" },
  { key: "ounce", label: "Ounce", short: "oz" },
  { key: "meter", label: "Meter", short: "m" },
];

const BY_KEY = Object.fromEntries(UNITS.map((u) => [u.key, u]));

export const UNIT_KEYS = UNITS.map((u) => u.key) as [UnitKey, ...UnitKey[]];

/** Full label, e.g. "Kilogram". Falls back to the raw value. */
export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "Piece";
  return BY_KEY[unit]?.label ?? unit;
}

/** Short unit, e.g. "kg". */
export function unitShort(unit: string | null | undefined): string {
  if (!unit) return "pc";
  return BY_KEY[unit]?.short ?? unit;
}

/** Quantity with its short unit, e.g. "3 dz", "12 kg". */
export function formatQty(qty: number | string | null | undefined, unit: string | null | undefined): string {
  const n = typeof qty === "string" ? Number(qty) : (qty ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  return `${value.toLocaleString("en-PH")} ${unitShort(unit)}`;
}
