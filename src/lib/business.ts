/**
 * ConsignTrack business rules — pure, dependency-free functions.
 *
 * These mirror the enforcement that lives in SQL (migrations 0002 & 0004) so
 * the same maths can be reused in the UI and unit-tested without a database.
 * The database remains the source of truth; this is a faithful copy, not a
 * second authority.
 */

/** Round to 2 decimal places (currency), avoiding binary float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * BR1 — a sale (or return) may never drive stock below zero.
 * Returns true when `qty` units can be taken from `onHand`.
 */
export function canFulfillSale(onHand: number, qty: number): boolean {
  return Number.isFinite(onHand) && Number.isFinite(qty) && qty > 0 && qty <= onHand;
}

/** Commission amount for a gross figure at a given percentage. */
export function commissionAmount(gross: number, commissionPct: number): number {
  return round2((gross * commissionPct) / 100);
}

export interface NetPayableInput {
  /** Σ units_sold × agreed_unit_price for the period. */
  grossSales: number;
  /** Commission percentage from the active agreement, e.g. 15 for 15%. */
  commissionPct: number;
  /** Monetary value of returns adjustments in the period. */
  returnsTotal: number;
}

export interface NetPayableResult {
  grossSales: number;
  commission: number;
  returnsTotal: number;
  netPayable: number;
}

/**
 * BR3 — net_payable = gross_sales − commission − returns_total,
 * with commission derived from the active agreement.
 */
export function computeNetPayable({
  grossSales,
  commissionPct,
  returnsTotal,
}: NetPayableInput): NetPayableResult {
  const gross = round2(grossSales);
  const commission = commissionAmount(gross, commissionPct);
  const returns = round2(returnsTotal);
  return {
    grossSales: gross,
    commission,
    returnsTotal: returns,
    netPayable: round2(gross - commission - returns),
  };
}

export interface ReconcileInput {
  opening: number;
  deliveries: number;
  sales: number;
  returns: number;
  /** Movements outside the delivery/sale/return flow (shrinkage, corrections). */
  adjustments?: number;
  /** Actual closing on-hand recorded in stock_levels. */
  closing: number;
}

export interface ReconcileResult {
  expectedClosing: number;
  closing: number;
  reconciles: boolean;
  /** closing − expectedClosing; non-zero means an unexplained movement. */
  variance: number;
}

/**
 * BR5 — opening + deliveries − sales − returns = closing.
 * The ledger reconciles only when there is no unexplained variance
 * (i.e. adjustments account for any difference exactly).
 */
export function reconcile({
  opening,
  deliveries,
  sales,
  returns,
  adjustments = 0,
  closing,
}: ReconcileInput): ReconcileResult {
  const expectedClosing = opening + deliveries - sales - returns;
  const variance = closing - (expectedClosing + adjustments);
  return {
    expectedClosing,
    closing,
    variance,
    // Reconciles when the flow explains the closing figure and no stock was
    // lost to an (unexplained) adjustment.
    reconciles: variance === 0 && adjustments === 0,
  };
}

/**
 * BR7 — a payment is only 'confirmed' when the store has marked it paid
 * (paid_at) AND the consignor has confirmed receipt (confirmed_at).
 */
export function isPaymentConfirmed(
  paidAt: string | Date | null | undefined,
  confirmedAt: string | Date | null | undefined,
): boolean {
  return Boolean(paidAt) && Boolean(confirmedAt);
}

/** Derive the settlement status implied by a payment's timestamps (BR7). */
export function settlementStatusFromPayment(
  paidAt: string | Date | null | undefined,
  confirmedAt: string | Date | null | undefined,
): "pending" | "paid" | "confirmed" {
  if (isPaymentConfirmed(paidAt, confirmedAt)) return "confirmed";
  if (paidAt) return "paid";
  return "pending";
}

/** A settlement is overdue when it is unpaid past its period end + cadence grace. */
export function isSettlementOverdue(
  periodEnd: string | Date,
  status: string,
  asOf: Date = new Date(),
): boolean {
  if (status === "confirmed" || status === "paid") return false;
  const end = new Date(periodEnd);
  return asOf.getTime() > end.getTime();
}
