// ──────────────────────────────────────────────────────────────
// California SB 766 — eff Oct 1, 2026
//
// Three buyer-protection requirements applicable to retail used-car
// sales by dealers in California:
//
//   1. Three-day right to cancel for vehicles under $50,000.
//      - Cannot be waived. 400-mile cap. $1/mile over 250 ($150 cap).
//      - Restocking fee = 1.5% of price ($200 floor, $600 ceiling).
//      - Buyer must receive a printed "3-Day Right to Cancel" form.
//
//   2. Upfront cost-of-financing disclosure for any financed deal.
//      - Total interest over the loan, monthly payment, and lifetime
//        cost (vehicle + interest + add-ons) presented BEFORE signing.
//
//   3. Add-on precontract disclosure for vehicles under $50k.
//      - Each optional add-on must be itemized with a separate buyer
//        acknowledgment captured BEFORE the contract is signed.
//      - Useless add-ons (no benefit to buyer) are banned.
//
// CA doc-fee cap remains $85 (SB 791 raise was vetoed Oct 2025).
// Source: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB766
// ──────────────────────────────────────────────────────────────

export const SB766_EFFECTIVE_DATE = "2026-10-01";
export const SB766_PRICE_THRESHOLD = 50000;
export const SB766_MILEAGE_CAP = 400;
export const SB766_MILEAGE_GRACE = 250;
export const SB766_PER_MILE_FEE = 1;
export const SB766_PER_MILE_FEE_CAP = 150;
export const SB766_RESTOCKING_FEE_PERCENT = 0.015;
export const SB766_RESTOCKING_FLOOR = 200;
export const SB766_RESTOCKING_CEILING = 600;
export const CA_DOC_FEE_CAP = 85;

export type VehicleState = string; // 2-letter postal abbreviation, uppercase

export const isSb766Applicable = (state: VehicleState | undefined, price: number | undefined) => {
  if (!state || !price) return false;
  if (state.toUpperCase() !== "CA") return false;
  if (new Date() < new Date(SB766_EFFECTIVE_DATE)) return false;
  return price < SB766_PRICE_THRESHOLD;
};

export interface FinancingDisclosureInput {
  amount_financed: number;
  apr_percent: number;          // annual percentage rate, e.g. 7.25
  term_months: number;
  down_payment?: number;
  trade_in_credit?: number;
  add_ons_total?: number;
}

export interface FinancingDisclosure {
  amount_financed: number;
  apr_percent: number;
  term_months: number;
  monthly_payment: number;
  total_interest: number;
  total_of_payments: number;
  lifetime_cost: number;        // vehicle + interest + add-ons, net of trade
  presented_at: string;         // ISO timestamp
  vehicle_state: VehicleState;
}

export const computeFinancingDisclosure = (
  input: FinancingDisclosureInput,
  state: VehicleState
): FinancingDisclosure => {
  const r = input.apr_percent / 100 / 12;
  const n = input.term_months;
  const p = input.amount_financed;
  // Standard amortization formula. Guard against zero APR.
  const monthly = r === 0 ? p / n : (p * r) / (1 - Math.pow(1 + r, -n));
  const totalOfPayments = monthly * n;
  const totalInterest = totalOfPayments - p;
  const lifetimeCost =
    p +
    totalInterest +
    (input.add_ons_total || 0) -
    (input.trade_in_credit || 0);
  return {
    amount_financed: round2(p),
    apr_percent: input.apr_percent,
    term_months: n,
    monthly_payment: round2(monthly),
    total_interest: round2(totalInterest),
    total_of_payments: round2(totalOfPayments),
    lifetime_cost: round2(lifetimeCost),
    presented_at: new Date().toISOString(),
    vehicle_state: state.toUpperCase(),
  };
};

export interface RestockingFee {
  applicable: boolean;
  amount: number;
}

export const computeRestockingFee = (price: number): RestockingFee => {
  if (!price) return { applicable: false, amount: 0 };
  const raw = price * SB766_RESTOCKING_FEE_PERCENT;
  const clamped = Math.min(SB766_RESTOCKING_CEILING, Math.max(SB766_RESTOCKING_FLOOR, raw));
  return { applicable: true, amount: round2(clamped) };
};

export interface AddOnPrecontract {
  add_ons: Array<{
    id: string;
    name: string;
    price: number;
    precontract_ack_at: string | null;
    declined: boolean;
  }>;
}

export const allAddOnsAcknowledged = (record: AddOnPrecontract | null | undefined) => {
  if (!record || record.add_ons.length === 0) return true;
  return record.add_ons.every(a => a.declined || !!a.precontract_ack_at);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const SB766_THREE_DAY_RETURN_TEXT = `
3-DAY RIGHT TO CANCEL — California Vehicle Code §11713.21 (SB 766, eff. 10/1/2026)

For vehicles purchased for under $50,000, the buyer has the unconditional
right to cancel this purchase by returning the vehicle to the selling
dealership within three (3) calendar days, subject to the following:

  - The vehicle is returned in the same condition it was received,
    excepting reasonable wear and tear.
  - The vehicle has been driven no more than 400 miles since delivery.
    A per-mile fee of $1.00 applies to miles over 250, capped at $150.
  - The dealer may retain a restocking fee of 1.5% of the purchase price,
    not less than $200 and not more than $600.

This right cannot be waived. The dealer must provide this notice in writing
at the time of sale. The buyer's signature below acknowledges receipt only
and does not constitute a waiver of any right granted by this section.
`.trim();
