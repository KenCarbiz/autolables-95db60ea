import { useState } from "react";
import { useVinDecode } from "@/hooks/useVinDecode";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";

interface VehicleStripProps {
  vehicle: { ymm: string; stock: string; vin: string; date: string };
  onChange: (v: { ymm: string; stock: string; vin: string; date: string }) => void;
  onVinDecoded?: (result: { year: string; make: string; model: string; trim: string; bodyStyle: string }) => void;
  inkSaving?: boolean;
}

const fields = [
  { label: "Year / Make / Model", key: "ymm" as const, placeholder: "e.g. 2026 Honda CR-V EX-L" },
  { label: "Stock #", key: "stock" as const, placeholder: "e.g. H12345" },
  { label: "VIN", key: "vin" as const, placeholder: "e.g. 1HGCV1F3XRA000000" },
  { label: "Date", key: "date" as const, placeholder: "e.g. 04/04/2026" },
];

const VehicleStrip = ({ vehicle, onChange, onVinDecoded, inkSaving }: VehicleStripProps) => {
  const { decode, decoding, error: vinError } = useVinDecode();
  const { settings } = useDealerSettings();
  const [decoded, setDecoded] = useState(false);

  const handleVinDecode = async () => {
    if (!vehicle.vin.trim()) return;
    const result = await decode(vehicle.vin);
    if (result) {
      onChange({ ...vehicle, ymm: result.ymm });
      setDecoded(true);
      onVinDecoded?.(result);
      setTimeout(() => setDecoded(false), 3000);
    }
  };

  return (
    <div className={`px-3 py-2 text-[9px] ${inkSaving ? "bg-card" : "bg-blue/10"}`}>
      <div className="grid grid-cols-4 gap-2">
        {fields.map((f) => (
          <div key={f.key}>
            <span className="font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</span>
            <div className={f.key === "vin" && settings.feature_vin_decode ? "flex gap-1 items-end" : ""}>
              <input
                value={vehicle[f.key]}
                onChange={(e) => onChange({ ...vehicle, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full border-b-[1.5px] border-border-custom bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50 min-h-[20px] py-0.5"
              />
              {f.key === "vin" && settings.feature_vin_decode && (
                <button
                  onClick={handleVinDecode}
                  disabled={decoding || !vehicle.vin.trim()}
                  className={`shrink-0 text-[8px] font-bold px-2 py-1 rounded transition-all ${
                    decoded
                      ? "bg-teal text-primary-foreground"
                      : "bg-action text-primary-foreground hover:opacity-85"
                  } disabled:opacity-40`}
                >
                  {decoding ? "Decoding..." : decoded ? "Decoded" : "Decode VIN"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {vinError && settings.feature_vin_decode && (
        <p className="text-[8px] text-red mt-1">{vinError}</p>
      )}
      <div className="flex justify-end">
        <span className="inline-block mt-1 text-[8px] font-bold bg-teal text-primary-foreground px-2 py-0.5 rounded-sm tracking-widest">
          FTC
          <br />
          Compliant
          <br />
          Label
        </span>
      </div>
    </div>
  );
};

export default VehicleStrip;
