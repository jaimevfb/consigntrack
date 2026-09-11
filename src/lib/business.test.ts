import { describe, it, expect } from "vitest";
import {
  canFulfillSale,
  computeNetPayable,
  reconcile,
  isPaymentConfirmed,
  settlementStatusFromPayment,
} from "./business";

// BR1 — no oversell
describe("BR1: a sale cannot exceed qty_on_hand", () => {
  it("allows a sale within stock", () => {
    expect(canFulfillSale(10, 3)).toBe(true);
    expect(canFulfillSale(10, 10)).toBe(true);
  });
  it("rejects a sale beyond stock", () => {
    expect(canFulfillSale(10, 11)).toBe(false);
    expect(canFulfillSale(0, 1)).toBe(false);
  });
  it("rejects non-positive quantities", () => {
    expect(canFulfillSale(10, 0)).toBe(false);
    expect(canFulfillSale(10, -2)).toBe(false);
  });
});

// BR3 — net_payable = gross − commission − returns
describe("BR3: net_payable maths", () => {
  it("computes commission and net for the seed scenario (15%)", () => {
    // 12 runners @ 450 = 5400 gross, 15% commission = 810, no returns
    const r = computeNetPayable({ grossSales: 5400, commissionPct: 15, returnsTotal: 0 });
    expect(r.commission).toBe(810);
    expect(r.netPayable).toBe(4590);
  });
  it("subtracts returns adjustments", () => {
    const r = computeNetPayable({ grossSales: 1000, commissionPct: 10, returnsTotal: 180 });
    expect(r.commission).toBe(100);
    expect(r.netPayable).toBe(720);
  });
  it("rounds to two decimals", () => {
    const r = computeNetPayable({ grossSales: 333.33, commissionPct: 15, returnsTotal: 0 });
    expect(r.commission).toBe(50); // 333.33 * 0.15 = 49.9995 -> 50.00
    expect(r.netPayable).toBe(283.33);
  });
});

// BR5 — reconciliation identity
describe("BR5: opening + deliveries − sales − returns = closing", () => {
  it("reconciles a clean flow", () => {
    const r = reconcile({ opening: 0, deliveries: 20, sales: 12, returns: 3, closing: 5 });
    expect(r.expectedClosing).toBe(5);
    expect(r.reconciles).toBe(true);
    expect(r.variance).toBe(0);
  });
  it("flags unexplained shrinkage as not reconciling", () => {
    // closing is short by 1 with no adjustment recorded
    const r = reconcile({ opening: 0, deliveries: 20, sales: 12, returns: 3, closing: 4 });
    expect(r.reconciles).toBe(false);
    expect(r.variance).toBe(-1);
  });
  it("does not count an unexplained adjustment as reconciled even if closing matches", () => {
    const r = reconcile({
      opening: 0,
      deliveries: 20,
      sales: 12,
      returns: 3,
      adjustments: -1,
      closing: 4,
    });
    // closing (4) == expected(5) + adjustment(-1); variance 0 but adjustment present
    expect(r.variance).toBe(0);
    expect(r.reconciles).toBe(false);
  });
});

// BR7 — payment closed only when both sides act
describe("BR7: payment confirmed only when paid AND received", () => {
  it("is not confirmed when only paid", () => {
    expect(isPaymentConfirmed("2026-01-05", null)).toBe(false);
    expect(settlementStatusFromPayment("2026-01-05", null)).toBe("paid");
  });
  it("is not confirmed when neither", () => {
    expect(isPaymentConfirmed(null, null)).toBe(false);
    expect(settlementStatusFromPayment(null, null)).toBe("pending");
  });
  it("is confirmed when both timestamps present", () => {
    expect(isPaymentConfirmed("2026-01-05", "2026-01-06")).toBe(true);
    expect(settlementStatusFromPayment("2026-01-05", "2026-01-06")).toBe("confirmed");
  });
});
