import { useEffect, useMemo, useState } from "react";
import {
  SB766_THREE_DAY_RETURN_TEXT,
  computeFinancingDisclosure,
  computeRestockingFee,
  isSb766Applicable,
  type FinancingDisclosure,
  type FinancingDisclosureInput,
} from "@/lib/sb766";

interface Props {
  vehicleState: string | undefined;
  vehiclePrice: number | undefined;
  financingInput?: Partial<FinancingDisclosureInput>;
  threeDayAck: boolean;
  onThreeDayAck: (next: boolean) => void;
  onDisclosureChange: (d: FinancingDisclosure | null) => void;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export const SB766DisclosurePanel = ({
  vehicleState,
  vehiclePrice,
  financingInput,
  threeDayAck,
  onThreeDayAck,
  onDisclosureChange,
}: Props) => {
  const applicable = useMemo(
    () => isSb766Applicable(vehicleState, vehiclePrice),
    [vehicleState, vehiclePrice]
  );
  const [showFullReturnText, setShowFullReturnText] = useState(false);

  const restocking = useMemo(
    () => (vehiclePrice ? computeRestockingFee(vehiclePrice) : null),
    [vehiclePrice]
  );

  const disclosure = useMemo<FinancingDisclosure | null>(() => {
    if (!applicable || !vehicleState) return null;
    if (
      !financingInput ||
      typeof financingInput.amount_financed !== "number" ||
      typeof financingInput.apr_percent !== "number" ||
      typeof financingInput.term_months !== "number"
    ) {
      return null;
    }
    const d = computeFinancingDisclosure(
      financingInput as FinancingDisclosureInput,
      vehicleState
    );
    return d;
  }, [applicable, financingInput, vehicleState]);

  // Hoist disclosure to parent state so the signed payload includes it.
  useEffect(() => {
    onDisclosureChange(disclosure);
  }, [disclosure, onDisclosureChange]);

  if (!applicable) return null;

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm space-y-4 border-2 border-amber-300">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wide">
          California SB 766
        </span>
        <h2 className="text-sm font-bold font-barlow-condensed text-foreground">
          Required Disclosures
        </h2>
      </div>

      {disclosure && (
        <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1 text-xs">
          <p className="font-semibold text-foreground">
            Cost-of-Financing Disclosure
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 tabular-nums">
            <span className="text-muted-foreground">Amount financed</span>
            <span className="text-right font-semibold">
              {fmt(disclosure.amount_financed)}
            </span>
            <span className="text-muted-foreground">APR</span>
            <span className="text-right font-semibold">
              {disclosure.apr_percent.toFixed(2)}%
            </span>
            <span className="text-muted-foreground">Term</span>
            <span className="text-right font-semibold">
              {disclosure.term_months} months
            </span>
            <span className="text-muted-foreground">Monthly payment</span>
            <span className="text-right font-semibold">
              {fmt(disclosure.monthly_payment)}
            </span>
            <span className="text-muted-foreground">Total interest</span>
            <span className="text-right font-semibold text-amber-700">
              {fmt(disclosure.total_interest)}
            </span>
            <span className="text-muted-foreground">Lifetime cost</span>
            <span className="text-right font-bold text-foreground">
              {fmt(disclosure.lifetime_cost)}
            </span>
          </div>
        </div>
      )}

      {restocking && (
        <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs">
          <p className="font-semibold text-foreground">
            3-Day Right to Cancel — Buyer Cost If Exercised
          </p>
          <p className="text-muted-foreground mt-1">
            Restocking fee {fmt(restocking.amount)} (1.5% of price, $200 floor /
            $600 ceiling). Plus $1/mile over 250 miles, $150 cap. 400-mile total
            limit.
          </p>
        </div>
      )}

      {!showFullReturnText ? (
        <button
          type="button"
          onClick={() => setShowFullReturnText(true)}
          className="text-xs font-semibold text-[#1E90FF] hover:underline"
        >
          Read full 3-Day Right to Cancel notice →
        </button>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-lg bg-muted/40 border border-border p-3 text-[11px] text-foreground whitespace-pre-line leading-relaxed">
          {SB766_THREE_DAY_RETURN_TEXT}
        </div>
      )}

      <button
        type="button"
        onClick={() => onThreeDayAck(!threeDayAck)}
        className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
          threeDayAck ? "border-teal bg-teal/5" : "border-border"
        }`}
      >
        <div
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
            threeDayAck ? "border-teal bg-teal text-white" : "border-border"
          }`}
        >
          {threeDayAck && <span className="text-sm font-bold">✓</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            I acknowledge receipt of the 3-Day Right to Cancel notice
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            This acknowledgment is required for vehicles under $50,000 in
            California. It does not waive my right to cancel.
          </p>
        </div>
      </button>
    </div>
  );
};

export default SB766DisclosurePanel;
