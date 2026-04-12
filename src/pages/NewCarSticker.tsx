import { useState, useRef } from "react";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { useTenant } from "@/contexts/TenantContext";
import { useVinDecode } from "@/hooks/useVinDecode";
import { useFactoryData } from "@/hooks/useFactoryData";
import { useAuth } from "@/contexts/AuthContext";
import { useAudit } from "@/contexts/AuditContext";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Download, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const NewCarSticker = () => {
  const { settings } = useDealerSettings();
  const { currentStore, tenant } = useTenant();
  const { decode, decoding } = useVinDecode();
  const { fetchFactoryData, loading: factoryLoading } = useFactoryData();
  const { user } = useAuth();
  const { log } = useAudit();
  const { data: products } = useProducts();
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const [vehicle, setVehicle] = useState({
    vin: "", year: "", make: "", model: "", trim: "",
    stock: "", msrp: "", destinationCharge: "",
    engine: "", transmission: "", drivetrain: "", fuelType: "",
    mpgCity: "", mpgHwy: "", mpgCombined: "",
    color: "", interiorColor: "", bodyStyle: "", doors: "",
  });

  const [equipment, setEquipment] = useState<string[]>([]);
  const [showEquipment, setShowEquipment] = useState(true);

  const dealerName = currentStore?.name || settings.dealer_name || "Your Dealership";
  const dealerLogo = currentStore?.logo_url || settings.dealer_logo_url || tenant?.logo_url || "";
  const dealerPhone = currentStore?.phone || "";
  const dealerTagline = currentStore?.tagline || settings.dealer_tagline || "";

  const installed = products?.filter(p => p.badge_type === "installed") || [];
  const optional = products?.filter(p => p.badge_type === "optional") || [];
  const installedTotal = installed.reduce((s, p) => s + p.price, 0);
  const optionalTotal = optional.reduce((s, p) => s + p.price, 0);
  const baseMsrp = parseFloat(vehicle.msrp) || 0;
  const destCharge = parseFloat(vehicle.destinationCharge) || 0;
  const docFee = settings.doc_fee_enabled ? (settings.doc_fee_amount || 0) : 0;
  const totalSuggestedRetail = baseMsrp + destCharge + installedTotal + docFee;

  const signingUrl = vehicle.vin ? `${window.location.origin}/vehicle/${vehicle.vin}` : "";

  // Proper tracking code: AC-{STORE}-{VIN6}-NA-{TIMESTAMP}
  const trackingCode = (() => {
    const storePrefix = (currentStore?.id || "STOR").slice(0, 4).toUpperCase();
    const vinSuffix = vehicle.vin ? vehicle.vin.slice(-6).toUpperCase() : "000000";
    const ts = Date.now().toString(36).toUpperCase().slice(-6);
    return `AC-${storePrefix}-${vinSuffix}-NA-${ts}`;
  })();

  const handleVinDecode = async () => {
    if (vehicle.vin.length !== 17) return;
    const result = await decode(vehicle.vin);
    if (result) {
      setVehicle(prev => ({
        ...prev, year: result.year, make: result.make, model: result.model,
        trim: result.trim, bodyStyle: result.bodyStyle, drivetrain: result.driveType,
        fuelType: result.fuelType, engine: result.engineDescription,
      }));
      toast.success(`${result.year} ${result.make} ${result.model}`);

      // Auto-fetch factory equipment
      const factory = await fetchFactoryData(vehicle.vin);
      if (factory) {
        setEquipment(factory.standardEquipment);
        if (factory.baseMsrp) {
          setVehicle(prev => ({ ...prev, msrp: factory.baseMsrp }));
        }
      }
    }
  };

  const handlePrint = () => {
    window.print();
    if (user) log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_printed", entity_type: "new_car_sticker", entity_id: vehicle.vin, details: { ymm: `${vehicle.year} ${vehicle.make} ${vehicle.model}` } });
  };

  const handlePdf = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const { default: jsPDF } = await import("jspdf");
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const w = 8.5, h = (canvas.height / canvas.width) * w;
      const pdf = new jsPDF({ unit: "in", format: [w, h], orientation: "portrait" });
      pdf.addImage(imgData, "JPEG", 0, 0, w, h);
      pdf.save(`New-Car-Sticker-${vehicle.vin || "draft"}.pdf`);
    } catch { toast.error("PDF failed"); } finally { setGenerating(false); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-display text-foreground">New Car Window Sticker</h1>
          <p className="text-xs text-muted-foreground mt-1">Dealer addendum sticker for new vehicles. Sits alongside the factory Monroney label.</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted"><Printer className="w-3.5 h-3.5" /> Print</button>
          <button onClick={handlePdf} disabled={generating} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Config */}
        <div className="lg:col-span-2 space-y-4 no-print">
          <CfgCard title="Vehicle">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={vehicle.vin} onChange={e => setVehicle({ ...vehicle, vin: e.target.value.toUpperCase() })} placeholder="VIN (17 chars)" className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm font-mono outline-none" />
                <button onClick={handleVinDecode} disabled={decoding || factoryLoading || vehicle.vin.length !== 17} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
                  {decoding || factoryLoading ? "..." : "Decode"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["year","make","model","trim"] as const).map(k => (
                  <input key={k} value={vehicle[k]} onChange={e => setVehicle({ ...vehicle, [k]: e.target.value })} placeholder={k.charAt(0).toUpperCase()+k.slice(1)} className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={vehicle.stock} onChange={e => setVehicle({ ...vehicle, stock: e.target.value })} placeholder="Stock #" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.color} onChange={e => setVehicle({ ...vehicle, color: e.target.value })} placeholder="Ext. Color" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.interiorColor} onChange={e => setVehicle({ ...vehicle, interiorColor: e.target.value })} placeholder="Int. Color" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={vehicle.engine} onChange={e => setVehicle({ ...vehicle, engine: e.target.value })} placeholder="Engine" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.transmission} onChange={e => setVehicle({ ...vehicle, transmission: e.target.value })} placeholder="Trans." className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.drivetrain} onChange={e => setVehicle({ ...vehicle, drivetrain: e.target.value })} placeholder="Drivetrain" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
            </div>
          </CfgCard>
          <CfgCard title="Pricing">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Base MSRP ($)</label>
                <input value={vehicle.msrp} onChange={e => setVehicle({ ...vehicle, msrp: e.target.value })} placeholder="32500" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Destination ($)</label>
                <input value={vehicle.destinationCharge} onChange={e => setVehicle({ ...vehicle, destinationCharge: e.target.value })} placeholder="1095" className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
            </div>
          </CfgCard>
          <CfgCard title="Fuel Economy">
            <div className="grid grid-cols-3 gap-2">
              <input value={vehicle.mpgCity} onChange={e => setVehicle({ ...vehicle, mpgCity: e.target.value })} placeholder="City MPG" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.mpgHwy} onChange={e => setVehicle({ ...vehicle, mpgHwy: e.target.value })} placeholder="Hwy MPG" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.mpgCombined} onChange={e => setVehicle({ ...vehicle, mpgCombined: e.target.value })} placeholder="Combined" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
            </div>
          </CfgCard>
          <CfgCard title="Factory Equipment (one per line)">
            <textarea value={equipment.join("\n")} onChange={e => setEquipment(e.target.value.split("\n"))} placeholder={"ABS\nBackup Camera\nBluetooth\nLane Departure Warning"} rows={5} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none resize-y" />
          </CfgCard>
        </div>

        {/* Sticker preview */}
        <div className="lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 no-print">Live Preview</p>
          <div ref={cardRef} className="bg-white rounded-lg border-2 border-foreground overflow-hidden shadow-premium-lg mx-auto" style={{ maxWidth: "600px" }}>

            {/* Dealer header */}
            <div className="bg-primary text-primary-foreground px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {dealerLogo && <div className="bg-white rounded p-1.5"><img src={dealerLogo} alt="" className="h-7 object-contain" /></div>}
                  <div>
                    <p className="text-sm font-bold tracking-tight">{dealerName}</p>
                    {dealerTagline && <p className="text-[9px] text-primary-foreground/70">{dealerTagline}</p>}
                  </div>
                </div>
                <span className="text-[9px] font-bold bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded">NEW</span>
              </div>
            </div>

            {/* Vehicle title */}
            <div className="px-5 py-3 border-b-2 border-foreground">
              <p className="text-lg font-bold tracking-tight text-foreground">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</p>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                {vehicle.vin && <span className="font-mono">{vehicle.vin}</span>}
                {vehicle.stock && <span>Stock: {vehicle.stock}</span>}
                {vehicle.color && <span>{vehicle.color}</span>}
              </div>
            </div>

            {/* MSRP line */}
            {baseMsrp > 0 && (
              <div className="px-5 py-2 border-b border-foreground bg-muted/20 flex items-center justify-between">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Manufacturer's Suggested Retail Price</p>
                <p className="text-base font-extrabold text-foreground tabular-nums">${baseMsrp.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            )}

            {/* Destination charge */}
            {destCharge > 0 && (
              <div className="px-5 py-1.5 border-b border-foreground flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Destination & Handling</span>
                <span className="font-semibold text-foreground tabular-nums">${destCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {/* Specs */}
            <div className="grid grid-cols-3 gap-0 border-b border-foreground text-[10px]">
              {vehicle.engine && <div className="px-3 py-1.5 border-r border-foreground"><p className="text-[8px] font-bold text-muted-foreground uppercase">Engine</p><p className="text-foreground font-medium">{vehicle.engine}</p></div>}
              {vehicle.transmission && <div className="px-3 py-1.5 border-r border-foreground"><p className="text-[8px] font-bold text-muted-foreground uppercase">Transmission</p><p className="text-foreground font-medium">{vehicle.transmission}</p></div>}
              {vehicle.drivetrain && <div className="px-3 py-1.5"><p className="text-[8px] font-bold text-muted-foreground uppercase">Drivetrain</p><p className="text-foreground font-medium">{vehicle.drivetrain}</p></div>}
            </div>

            {/* MPG */}
            {(vehicle.mpgCity || vehicle.mpgHwy) && (
              <div className="px-5 py-2 border-b border-foreground flex items-center justify-between">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">EPA Fuel Economy</p>
                <div className="flex items-center gap-3 text-xs">
                  {vehicle.mpgCity && <span><strong>{vehicle.mpgCity}</strong> city</span>}
                  {vehicle.mpgHwy && <span><strong>{vehicle.mpgHwy}</strong> hwy</span>}
                  {vehicle.mpgCombined && <span><strong>{vehicle.mpgCombined}</strong> combined</span>}
                </div>
              </div>
            )}

            {/* Factory equipment */}
            {equipment.filter(Boolean).length > 0 && (
              <div className="border-b border-foreground">
                <button onClick={() => setShowEquipment(!showEquipment)} className="w-full flex items-center justify-between px-5 py-2 text-[9px] font-bold text-foreground uppercase tracking-wider hover:bg-muted/30">
                  <span>Standard Equipment ({equipment.filter(Boolean).length})</span>
                  {showEquipment ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showEquipment && (
                  <div className="px-5 pb-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {equipment.filter(Boolean).map((item, i) => (
                      <p key={i} className="text-[9px] text-foreground">• {item.trim()}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dealer accessories — installed */}
            {installed.length > 0 && (
              <div className="px-5 py-2 border-b border-foreground">
                <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-1">Dealer-Installed Accessories</p>
                {installed.map(p => (
                  <div key={p.id} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-foreground">{p.name}</span>
                    <span className="font-semibold text-foreground tabular-nums">${p.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Optional accessories */}
            {optional.length > 0 && (
              <div className="px-5 py-2 border-b border-foreground">
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">Optional Accessories (May Accept or Decline)</p>
                {optional.map(p => (
                  <div key={p.id} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-foreground">{p.name}</span>
                    <span className="font-semibold text-foreground tabular-nums">${p.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Doc fee */}
            {docFee > 0 && (
              <div className="px-5 py-1.5 border-b border-foreground flex justify-between text-[10px]">
                <span className="text-muted-foreground">{settings.doc_fee_state ? `${settings.doc_fee_state} ` : ""}Documentation Fee</span>
                <span className="font-semibold text-foreground tabular-nums">${docFee.toFixed(2)}</span>
              </div>
            )}

            {/* Total Suggested Retail */}
            <div className="px-5 py-3 bg-primary text-primary-foreground flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wide">Total Suggested Retail Price</p>
              <p className="text-lg font-extrabold tabular-nums">${totalSuggestedRetail.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Optional total note */}
            {optionalTotal > 0 && (
              <div className="px-5 py-1.5 bg-amber-50 text-[9px] text-amber-800 flex justify-between">
                <span>With all optional accessories accepted</span>
                <span className="font-semibold tabular-nums">${(totalSuggestedRetail + optionalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {/* QR + footer */}
            <div className="px-5 py-2 flex items-center justify-between border-t border-foreground">
              <div>
                <p className="text-[7px] font-bold text-foreground">UPC: {trackingCode}</p>
                <p className="text-[6px] text-muted-foreground">Scan QR for details & sign-off · Separate from factory Monroney label</p>
              </div>
              {signingUrl && <QRCodeSVG value={signingUrl} size={48} />}
            </div>

            <div className="text-center py-1 bg-primary text-primary-foreground text-[7px] font-semibold">
              {dealerName} {dealerPhone && `· ${dealerPhone}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CfgCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border shadow-premium p-4">
    <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
    {children}
  </div>
);

export default NewCarSticker;
