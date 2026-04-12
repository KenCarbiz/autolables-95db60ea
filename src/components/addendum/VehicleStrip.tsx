import { useState } from "react";
import { useVinDecode } from "@/hooks/useVinDecode";
import { useVehicleUrlScrape, ScrapedVehicle } from "@/hooks/useVehicleUrlScrape";
import { useBlackBook } from "@/hooks/useBlackBook";
import { useOemBuildSheet } from "@/hooks/useOemBuildSheet";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";

interface VehicleStripProps {
  vehicle: { ymm: string; stock: string; vin: string; date: string };
  onChange: (v: { ymm: string; stock: string; vin: string; date: string }) => void;
  onVinDecoded?: (result: { year: string; make: string; model: string; trim: string; bodyStyle: string }) => void;
  onVehicleScraped?: (result: ScrapedVehicle) => void;
  inkSaving?: boolean;
}

const fields = [
  { label: "Year / Make / Model", key: "ymm" as const, placeholder: "e.g. 2026 Honda CR-V EX-L" },
  { label: "Stock #", key: "stock" as const, placeholder: "e.g. H12345" },
  { label: "VIN", key: "vin" as const, placeholder: "e.g. 1HGCV1F3XRA000000" },
  { label: "Date", key: "date" as const, placeholder: "e.g. 04/04/2026" },
];

const VehicleStrip = ({ vehicle, onChange, onVinDecoded, onVehicleScraped, inkSaving }: VehicleStripProps) => {
  const { decode, decoding, error: vinError } = useVinDecode();
  const { scrape, scraping, error: scrapeError } = useVehicleUrlScrape();
  const { pull: pullBlackBook, loading: bbLoading, data: bbData, error: bbError } = useBlackBook();
  const { pull: pullOem, loading: oemLoading, data: oemData, error: oemError } = useOemBuildSheet();
  const { settings } = useDealerSettings();
  const [decoded, setDecoded] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlBar, setShowUrlBar] = useState(false);

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

  const handleUrlScrape = async () => {
    if (!urlInput.trim()) return;
    const result = await scrape(urlInput);
    if (result) {
      onChange({
        ymm: result.ymm || vehicle.ymm,
        stock: result.stock || vehicle.stock,
        vin: result.vin || vehicle.vin,
        date: vehicle.date,
      });
      setScraped(true);
      onVehicleScraped?.(result);
      onVinDecoded?.({
        year: result.year,
        make: result.make,
        model: result.model,
        trim: result.trim,
        bodyStyle: result.bodyStyle,
      });
      setTimeout(() => setScraped(false), 3000);
    }
  };

  return (
    <div className={`px-3 py-2 text-[9px] ${inkSaving ? "bg-card" : "bg-blue/10"}`}>
      {/* URL Import Bar */}
      {settings.feature_url_scrape && (
        <div className="mb-2 no-print">
          {!showUrlBar ? (
            <button
              onClick={() => setShowUrlBar(true)}
              className="text-[9px] font-semibold text-action hover:underline"
            >
              + Import from website URL
            </button>
          ) : (
            <div className="flex gap-1 items-center">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlScrape()}
                placeholder="Paste vehicle listing URL from your website (e.g. https://yourdealer.com/inventory/2026-honda-crv)"
                className="flex-1 px-2 py-1.5 border border-border-custom rounded text-[10px] bg-card text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleUrlScrape}
                disabled={scraping || !urlInput.trim()}
                className={`shrink-0 text-[9px] font-bold px-3 py-1.5 rounded transition-all ${
                  scraped
                    ? "bg-teal text-primary-foreground"
                    : "bg-action text-primary-foreground hover:opacity-85"
                } disabled:opacity-40`}
              >
                {scraping ? "Importing..." : scraped ? "Imported" : "Import"}
              </button>
              <button
                onClick={() => { setShowUrlBar(false); setUrlInput(""); }}
                className="shrink-0 text-[9px] px-2 py-1.5 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
          {scrapeError && <p className="text-[8px] text-red mt-0.5">{scrapeError}</p>}
        </div>
      )}

      {/* Vehicle fields */}
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
              {f.key === "vin" && vehicle.vin.trim().length === 17 && (
                <button
                  onClick={() => pullOem(vehicle.vin.trim())}
                  disabled={oemLoading}
                  className="shrink-0 text-[8px] font-bold px-2 py-1 rounded bg-blue-600 text-white hover:opacity-85 disabled:opacity-40 transition-all"
                >
                  {oemLoading ? "Pulling..." : oemData ? "OEM" : "OEM Data"}
                </button>
              )}
              {f.key === "vin" && settings.feature_blackbook && vehicle.vin.trim().length === 17 && (
                <button
                  onClick={() => pullBlackBook(vehicle.vin.trim())}
                  disabled={bbLoading}
                  className="shrink-0 text-[8px] font-bold px-2 py-1 rounded bg-purple-600 text-white hover:opacity-85 disabled:opacity-40 transition-all"
                >
                  {bbLoading ? "Pulling..." : bbData ? "Pulled" : "Black Book"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {vinError && settings.feature_vin_decode && (
        <p className="text-[8px] text-red mt-1">{vinError}</p>
      )}
      {bbError && settings.feature_blackbook && (
        <p className="text-[8px] text-red mt-1">{bbError}</p>
      )}
      {oemError && <p className="text-[8px] text-red mt-1">{oemError}</p>}
      {oemData && (
        <div className="mt-1 p-1.5 bg-blue-50 border border-blue-200 rounded text-[8px] no-print">
          <p className="font-bold text-blue-800 mb-0.5">OEM Build Sheet ({oemData.source})</p>
          {oemData.totalMsrp > 0 && <p className="text-blue-700">Total MSRP: ${oemData.totalMsrp.toLocaleString()}</p>}
          {oemData.standardEquipment.length > 0 && (
            <p className="text-blue-600 mt-0.5">{oemData.standardEquipment.map(e => e.name).join(" · ")}</p>
          )}
          {oemData.source === "demo" && (
            <p className="text-blue-600 italic mt-0.5">Connect DataOne or Auto.dev API key in Admin &gt; Settings for live OEM data.</p>
          )}
        </div>
      )}
      {bbData && settings.feature_blackbook && (
        <div className="mt-1 p-1.5 bg-purple-50 border border-purple-200 rounded text-[8px] no-print">
          <p className="font-bold text-purple-800 mb-0.5">Black Book Data</p>
          {bbData.baseMsrp && bbData.baseMsrp !== "—" && (
            <p className="text-purple-700">Base MSRP: ${bbData.baseMsrp}</p>
          )}
          {bbData.standardEquipment.length > 0 && (
            <p className="text-purple-600 mt-0.5">{bbData.standardEquipment.join(" · ")}</p>
          )}
          {bbData.baseMsrp === "—" && (
            <p className="text-purple-600 italic">Connect Black Book API key in Admin &gt; Settings to pull live market data.</p>
          )}
        </div>
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
