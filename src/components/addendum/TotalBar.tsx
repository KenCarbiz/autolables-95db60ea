import { Product } from "@/hooks/useProducts";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { getDocFeeTerminology, getDocFeeForState } from "@/data/docFees";

interface TotalBarProps {
  installedTotal: number;
  optionalTotal: number;
  grandTotal: number;
  optionalItems: Product[];
  acceptedOptional: Product[];
  inkSaving?: boolean;
}

const TotalBar = ({ installedTotal, optionalTotal, grandTotal, optionalItems, acceptedOptional, inkSaving }: TotalBarProps) => {
  const { settings } = useDealerSettings();
  const docFeeLabel = getDocFeeTerminology(settings.doc_fee_state || "CT");
  const docFeeConfig = getDocFeeForState(settings.doc_fee_state || "CT");
  const docFeeAmount = settings.doc_fee_enabled ? (settings.doc_fee_amount || 0) : 0;
  const cappedNote = docFeeConfig?.maxFee && docFeeAmount > docFeeConfig.maxFee
    ? ` (exceeds ${settings.doc_fee_state} $${docFeeConfig.maxFee} cap)`
    : "";

  const installedWithFee = installedTotal + docFeeAmount;
  const grandWithFee = grandTotal + docFeeAmount;
  const allOptionalSum = optionalItems.reduce((s, p) => s + p.price, 0);

  return (
    <div className={`px-3 py-2 rounded ${inkSaving ? "bg-card border border-border" : "bg-navy/5 border border-navy/20"}`}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-bold text-foreground">Pre-Installed Items (Non-Removable)</p>
          <p className="text-[8px] text-muted-foreground">Included in vehicle selling price · not optional</p>
          {optionalItems.length > 0 && (
            <p className="text-[8px] text-muted-foreground mt-0.5">
              + Optional items: ${allOptionalSum.toFixed(2)} (if accepted)
            </p>
          )}
          {settings.doc_fee_enabled && docFeeAmount > 0 && (
            <p className="text-[8px] text-muted-foreground mt-0.5">
              + {docFeeLabel}: ${docFeeAmount.toFixed(2)}
              {cappedNote && <span className="text-red font-semibold">{cappedNote}</span>}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-muted-foreground">Installed Total</p>
          <p className="text-sm font-bold text-foreground">${installedWithFee.toFixed(2)}</p>
          {optionalItems.length > 0 && (
            <p className="text-[8px] text-muted-foreground">
              ${(installedWithFee + allOptionalSum).toFixed(2)} if all optional accepted
            </p>
          )}
        </div>
      </div>

      {/* Doc Fee disclosure line — required by most states when charged */}
      {settings.doc_fee_enabled && docFeeAmount > 0 && (
        <div className="mt-1 pt-1 border-t border-border-custom/50">
          <p className="text-[7px] text-muted-foreground leading-tight">
            <strong>{docFeeLabel}:</strong> A {docFeeLabel.toLowerCase()} of ${docFeeAmount.toFixed(2)} is charged to cover the costs of processing documents related to the sale of this vehicle.
            {docFeeConfig?.notes && ` ${docFeeConfig.notes}.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default TotalBar;
