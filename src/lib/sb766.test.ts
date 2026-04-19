import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isSb766Applicable,
  computeFinancingDisclosure,
  computeRestockingFee,
  allAddOnsAcknowledged,
  SB766_PRICE_THRESHOLD,
  SB766_RESTOCKING_FLOOR,
  SB766_RESTOCKING_CEILING,
  CA_DOC_FEE_CAP,
} from "./sb766";

// ──────────────────────────────────────────────────────────────
// SB 766: California 3-day right-to-cancel for used vehicles
// under $50k, effective 10/1/2026. These tests pin the financial
// math and eligibility rules so the return flow can't drift.
// ──────────────────────────────────────────────────────────────

describe("isSb766Applicable", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns false for non-CA states", () => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    expect(isSb766Applicable("NY", 30000)).toBe(false);
    expect(isSb766Applicable("TX", 30000)).toBe(false);
  });

  it("returns false before the effective date", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    expect(isSb766Applicable("CA", 30000)).toBe(false);
  });

  it("returns false at or above the $50k threshold", () => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    expect(isSb766Applicable("CA", 50000)).toBe(false);
    expect(isSb766Applicable("CA", 65000)).toBe(false);
  });

  it("returns true for CA, under threshold, post-effective", () => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    expect(isSb766Applicable("CA", 49999)).toBe(true);
    expect(isSb766Applicable("ca", 15000)).toBe(true);
  });

  it("returns false when state or price is missing", () => {
    expect(isSb766Applicable(undefined, 10000)).toBe(false);
    expect(isSb766Applicable("CA", undefined)).toBe(false);
  });
});

describe("computeRestockingFee", () => {
  it("clamps to the $200 floor on small prices", () => {
    const fee = computeRestockingFee(5000);
    expect(fee.applicable).toBe(true);
    expect(fee.amount).toBe(SB766_RESTOCKING_FLOOR);
  });

  it("clamps to the $600 ceiling on big prices", () => {
    const fee = computeRestockingFee(80000);
    expect(fee.amount).toBe(SB766_RESTOCKING_CEILING);
  });

  it("computes 1.5% in the middle band", () => {
    const fee = computeRestockingFee(20000);
    expect(fee.amount).toBe(300); // 1.5% of 20000
  });

  it("returns applicable=false when price is zero", () => {
    const fee = computeRestockingFee(0);
    expect(fee.applicable).toBe(false);
  });
});

describe("computeFinancingDisclosure", () => {
  it("computes monthly payment with standard amortization", () => {
    const disclosure = computeFinancingDisclosure(
      { amount_financed: 20000, apr_percent: 6.0, term_months: 60 },
      "CA"
    );
    // PMT on $20k, 0.5% monthly, 60 months = ~$386.66
    expect(disclosure.monthly_payment).toBeCloseTo(386.66, 1);
    expect(disclosure.term_months).toBe(60);
    expect(disclosure.apr_percent).toBe(6.0);
    expect(disclosure.total_of_payments).toBeCloseTo(23199.36, 0);
    expect(disclosure.total_interest).toBeCloseTo(3199.36, 0);
  });

  it("handles 0% APR as straight-line amortization", () => {
    const disclosure = computeFinancingDisclosure(
      { amount_financed: 12000, apr_percent: 0, term_months: 48 },
      "CA"
    );
    expect(disclosure.monthly_payment).toBe(250);
    expect(disclosure.total_interest).toBe(0);
  });

  it("lifetime cost includes add-ons, nets out trade credit", () => {
    const disclosure = computeFinancingDisclosure(
      {
        amount_financed: 18000,
        apr_percent: 5,
        term_months: 60,
        add_ons_total: 2000,
        trade_in_credit: 3000,
      },
      "CA"
    );
    // 18000 + interest + 2000 add-ons - 3000 trade
    expect(disclosure.lifetime_cost).toBeCloseTo(18000 + disclosure.total_interest + 2000 - 3000, 1);
  });

  it("stamps presented_at and vehicle_state", () => {
    const disclosure = computeFinancingDisclosure(
      { amount_financed: 10000, apr_percent: 4, term_months: 36 },
      "ca"
    );
    expect(disclosure.vehicle_state).toBe("CA");
    expect(disclosure.presented_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("allAddOnsAcknowledged", () => {
  it("returns true when every add-on is acknowledged or declined", () => {
    expect(
      allAddOnsAcknowledged({
        add_ons: [
          { id: "a", name: "GAP", price: 499, precontract_ack_at: "2026-10-01T00:00:00Z", declined: false },
          { id: "b", name: "Paint", price: 999, precontract_ack_at: null, declined: true },
        ],
      })
    ).toBe(true);
  });

  it("returns false when any add-on is neither acknowledged nor declined", () => {
    expect(
      allAddOnsAcknowledged({
        add_ons: [
          { id: "a", name: "GAP", price: 499, precontract_ack_at: null, declined: false },
        ],
      })
    ).toBe(false);
  });

  it("returns true for empty or null records", () => {
    expect(allAddOnsAcknowledged(null)).toBe(true);
    expect(allAddOnsAcknowledged({ add_ons: [] })).toBe(true);
  });
});

describe("SB 766 constants", () => {
  it("threshold is $50,000", () => {
    expect(SB766_PRICE_THRESHOLD).toBe(50000);
  });
  it("CA doc-fee cap stays at $85 (SB 791 vetoed)", () => {
    expect(CA_DOC_FEE_CAP).toBe(85);
  });
});
