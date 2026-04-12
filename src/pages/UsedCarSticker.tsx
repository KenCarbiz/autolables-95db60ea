import { useState, useRef } from "react";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { useTenant } from "@/contexts/TenantContext";
import { useVinDecode } from "@/hooks/useVinDecode";
import { useAuth } from "@/contexts/AuthContext";
import { useAudit } from "@/contexts/AuditContext";
import { useProducts } from "@/hooks/useProducts";
import { useAiDescription } from "@/hooks/useAiDescription";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { useZebraPrint } from "@/hooks/useZebraPrint";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Printer, Download, Car, Fuel, Gauge, Cog, Sparkles, MapPin, Tag,
  Shield, Star, Zap, Thermometer, Eye, Radio, Lock, ChevronDown, ChevronUp,
} from "lucide-react";

type StickerMode = "full" | "equipment_only" | "accessories_only";
type IconStyle = "icons" | "graphics" | "minimal";

const UsedCarSticker = () => {
  const { settings } = useDealerSettings();
  const { currentStore, tenant } = useTenant();
  const { decode, decoding } = useVinDecode();
  const { user } = useAuth();
  const { log } = useAudit();
  const { data: products } = useProducts();
  const { generate: generateAiDesc, generating: aiGenerating } = useAiDescription();
  const { pinLocation, tracking: gpsTracking } = useGpsTracking();
  const { printLabel, printing: zebraPrinting } = useZebraPrint();
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const [mode, setMode] = useState<StickerMode>("full");
  const [iconStyle, setIconStyle] = useState<IconStyle>("icons");

  const [vehicle, setVehicle] = useState({
    vin: "", year: "", make: "", model: "", trim: "",
    stock: "", mileage: "", color: "", interiorColor: "",
    engine: "", transmission: "", drivetrain: "", fuelType: "",
    mpgCity: "", mpgHwy: "", mpgCombined: "", hp: "", torque: "",
    doors: "", bodyStyle: "", marketValue: "", description: "",
    safetyOverall: "", safetyFrontal: "", safetySide: "", safetyRollover: "",
  });

  const [equipment, setEquipment] = useState<string[]>([]);
  const [showEquipment, setShowEquipment] = useState(true);
  const [valueProps, setValueProps] = useState<{ name: string; value: string }[]>([
    { name: "", value: "No Charge" },
  ]);
  // Generate proper tracking code: AC-{STORE}-{VIN6}-{TYPE}-{TIMESTAMP}
  const trackingCode = (() => {
    const storePrefix = (currentStore?.id || "STOR").slice(0, 4).toUpperCase();
    const vinSuffix = vehicle.vin ? vehicle.vin.slice(-6).toUpperCase() : "000000";
    const typeCode = mode === "accessories_only" ? "UA" : "US";
    const ts = Date.now().toString(36).toUpperCase().slice(-6);
    return `AC-${storePrefix}-${vinSuffix}-${typeCode}-${ts}`;
  })();

  const dealerName = currentStore?.name || settings.dealer_name || "Your Dealership";
  const dealerLogo = currentStore?.logo_url || settings.dealer_logo_url || tenant?.logo_url || "";
  const dealerPhone = currentStore?.phone || "";
  const dealerTagline = currentStore?.tagline || settings.dealer_tagline || "";
  const dealerAddress = currentStore ? `${currentStore.city || ""}, ${currentStore.state || ""}` : "";

  const installed = products?.filter(p => p.badge_type === "installed") || [];
  const optional = products?.filter(p => p.badge_type === "optional") || [];
  const installedTotal = installed.reduce((s, p) => s + p.price, 0);
  const optionalTotal = optional.reduce((s, p) => s + p.price, 0);
  const marketVal = parseFloat(vehicle.marketValue) || 0;
  const docFee = settings.doc_fee_enabled ? (settings.doc_fee_amount || 0) : 0;
  const totalPrice = marketVal + installedTotal + docFee;

  const signingUrl = vehicle.vin ? `${window.location.origin}/vehicle/${vehicle.vin}` : "";

  const handleVinDecode = async () => {
    if (vehicle.vin.length !== 17) return;
    const result = await decode(vehicle.vin);
    if (result) {
      setVehicle(prev => ({
        ...prev, year: result.year, make: result.make, model: result.model,
        trim: result.trim, bodyStyle: result.bodyStyle, drivetrain: result.driveType,
        fuelType: result.fuelType, engine: result.engineDescription,
      }));
      setEquipment(prev => prev.length > 1 ? prev : [
        result.bodyStyle, result.driveType, result.fuelType, result.engineDescription,
      ].filter(Boolean));
      toast.success(`${result.year} ${result.make} ${result.model}`);
    }
  };

  const handlePrint = () => {
    window.print();
    if (user) log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_printed", entity_type: "used_car_sticker", entity_id: vehicle.vin, details: { ymm: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, mode, trackingCode } });
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
      pdf.save(`Used-Car-Sticker-${vehicle.vin || "draft"}.pdf`);
    } catch { toast.error("PDF failed"); } finally { setGenerating(false); }
  };

  // Star rating component
  const Stars = ({ rating, label }: { rating: string; label: string }) => {
    const num = parseInt(rating) || 0;
    return (
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => (
            <Star key={i} className={`w-3 h-3 ${i <= num ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
          ))}
        </div>
      </div>
    );
  };

  // Fuel economy display with icon
  const FuelEconomyBlock = () => {
    if (!vehicle.mpgCity && !vehicle.mpgHwy) return null;
    return (
      <div className="text-center px-3 py-3">
        {iconStyle === "icons" && <Fuel className="w-6 h-6 mx-auto text-blue-600 mb-1" />}
        {iconStyle === "graphics" && <div className="text-3xl mb-1">⛽</div>}
        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">EPA Fuel Economy</p>
        <div className="flex items-end justify-center gap-4 mt-1">
          {vehicle.mpgCity && (
            <div>
              <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{vehicle.mpgCity}</p>
              <p className="text-[8px] text-muted-foreground font-semibold uppercase">City</p>
            </div>
          )}
          {vehicle.mpgCombined && (
            <div className="bg-primary/10 rounded-lg px-3 py-1">
              <p className="text-3xl font-extrabold text-primary tabular-nums leading-none">{vehicle.mpgCombined}</p>
              <p className="text-[8px] text-primary font-bold uppercase">Combined MPG</p>
            </div>
          )}
          {vehicle.mpgHwy && (
            <div>
              <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{vehicle.mpgHwy}</p>
              <p className="text-[8px] text-muted-foreground font-semibold uppercase">Highway</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-display text-foreground">Used Car Window Sticker</h1>
          <p className="text-xs text-muted-foreground mt-1">Premium Monroney-style sticker for pre-owned vehicles.</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted"><Printer className="w-3.5 h-3.5" /> Print</button>
          <button onClick={handlePdf} disabled={generating} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"><Download className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Config panel */}
        <div className="lg:col-span-2 space-y-4 no-print">
          {/* Sticker mode */}
          <CfgCard title="Sticker Type">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: "full" as const, label: "Full (All-in-One)" },
                { key: "equipment_only" as const, label: "Equipment Only" },
                { key: "accessories_only" as const, label: "Accessories Only" },
              ]).map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`h-9 rounded-md text-[10px] font-medium border-2 ${mode === m.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                >{m.label}</button>
              ))}
            </div>
          </CfgCard>

          {/* Icon style */}
          <CfgCard title="Graphics Style">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: "icons" as const, label: "Lucide Icons" },
                { key: "graphics" as const, label: "Emoji Graphics" },
                { key: "minimal" as const, label: "Text Only" },
              ]).map(s => (
                <button key={s.key} onClick={() => setIconStyle(s.key)}
                  className={`h-9 rounded-md text-[10px] font-medium border-2 ${iconStyle === s.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                >{s.label}</button>
              ))}
            </div>
          </CfgCard>

          {/* Vehicle */}
          <CfgCard title="Vehicle">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={vehicle.vin} onChange={e => setVehicle({ ...vehicle, vin: e.target.value.toUpperCase() })} placeholder="VIN (17 chars)" className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm font-mono outline-none" />
                <button onClick={handleVinDecode} disabled={decoding || vehicle.vin.length !== 17} className={`h-9 px-3 rounded-md text-xs font-medium text-white disabled:opacity-40 bg-primary`}>{decoding ? "..." : "Decode"}</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["year","make","model","trim"] as const).map(k => (
                  <input key={k} value={vehicle[k]} onChange={e => setVehicle({ ...vehicle, [k]: e.target.value })} placeholder={k.charAt(0).toUpperCase()+k.slice(1)} className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={vehicle.stock} onChange={e => setVehicle({ ...vehicle, stock: e.target.value })} placeholder="Stock #" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.mileage} onChange={e => setVehicle({ ...vehicle, mileage: e.target.value })} placeholder="Mileage" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.marketValue} onChange={e => setVehicle({ ...vehicle, marketValue: e.target.value })} placeholder="Market Value $" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={vehicle.color} onChange={e => setVehicle({ ...vehicle, color: e.target.value })} placeholder="Ext. Color" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.interiorColor} onChange={e => setVehicle({ ...vehicle, interiorColor: e.target.value })} placeholder="Int. Color" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
            </div>
          </CfgCard>

          {/* Powertrain */}
          <CfgCard title="Powertrain">
            <div className="grid grid-cols-3 gap-2">
              <input value={vehicle.engine} onChange={e => setVehicle({ ...vehicle, engine: e.target.value })} placeholder="Engine" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.transmission} onChange={e => setVehicle({ ...vehicle, transmission: e.target.value })} placeholder="Trans." className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.drivetrain} onChange={e => setVehicle({ ...vehicle, drivetrain: e.target.value })} placeholder="Drivetrain" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input value={vehicle.hp} onChange={e => setVehicle({ ...vehicle, hp: e.target.value })} placeholder="Horsepower" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.torque} onChange={e => setVehicle({ ...vehicle, torque: e.target.value })} placeholder="Torque (lb-ft)" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
            </div>
          </CfgCard>

          {/* Fuel Economy + Safety */}
          <CfgCard title="Fuel Economy & Safety">
            <div className="grid grid-cols-3 gap-2">
              <input value={vehicle.mpgCity} onChange={e => setVehicle({ ...vehicle, mpgCity: e.target.value })} placeholder="City MPG" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.mpgHwy} onChange={e => setVehicle({ ...vehicle, mpgHwy: e.target.value })} placeholder="Hwy MPG" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.mpgCombined} onChange={e => setVehicle({ ...vehicle, mpgCombined: e.target.value })} placeholder="Combined" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <input value={vehicle.safetyOverall} onChange={e => setVehicle({ ...vehicle, safetyOverall: e.target.value })} placeholder="Overall ★" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.safetyFrontal} onChange={e => setVehicle({ ...vehicle, safetyFrontal: e.target.value })} placeholder="Frontal ★" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.safetySide} onChange={e => setVehicle({ ...vehicle, safetySide: e.target.value })} placeholder="Side ★" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              <input value={vehicle.safetyRollover} onChange={e => setVehicle({ ...vehicle, safetyRollover: e.target.value })} placeholder="Rollover ★" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
            </div>
          </CfgCard>

          <CfgCard title="Equipment (one per line)">
            <textarea value={equipment.join("\n")} onChange={e => setEquipment(e.target.value.split("\n"))} placeholder={"Backup Camera\nBluetooth\nAlloy Wheels"} rows={5} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none resize-y" />
          </CfgCard>

          <CfgCard title="Description">
            <textarea value={vehicle.description} onChange={e => setVehicle({ ...vehicle, description: e.target.value })} placeholder="Vehicle description..." rows={3} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm outline-none resize-y" />
            <button onClick={async () => { const desc = await generateAiDesc(vehicle); if (desc) setVehicle(prev => ({ ...prev, description: desc })); }} disabled={aiGenerating} className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-purple-600 text-white text-xs font-medium hover:opacity-90 disabled:opacity-40">
              <Sparkles className="w-3 h-3" /> {aiGenerating ? "Writing..." : "AI Description"}
            </button>
          </CfgCard>

          <CfgCard title="Quick Actions">
            <div className="space-y-2">
              <button onClick={async () => { if (!vehicle.vin || !user) return; const loc = await pinLocation(vehicle.vin, user.id); if (loc) toast.success("GPS pinned"); else toast.error("GPS failed"); }} disabled={gpsTracking || !vehicle.vin} className="w-full inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-40"><MapPin className="w-3.5 h-3.5" /> {gpsTracking ? "Pinning..." : "Pin GPS"}</button>
              <button onClick={async () => { if (!vehicle.vin || !vehicle.stock) return; await printLabel({ vin: vehicle.vin, stockNumber: vehicle.stock, ymm: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, labelType: "stock_number" }); toast.success("Label queued"); }} disabled={zebraPrinting || !vehicle.stock} className="w-full inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-40"><Tag className="w-3.5 h-3.5" /> Zebra Stock Label</button>
            </div>
          </CfgCard>
        </div>

        {/* Live sticker preview */}
        <div className="lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 no-print">Live Preview — {mode === "full" ? "Full Sticker" : mode === "equipment_only" ? "Equipment Only" : "Accessories Only"}</p>
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
                <span className="text-[9px] font-bold bg-amber-400 text-amber-950 px-2 py-0.5 rounded">PRE-OWNED</span>
              </div>
            </div>

            {/* Vehicle title */}
            <div className="px-5 py-3 border-b-2 border-foreground">
              <p className="text-lg font-bold tracking-tight text-foreground">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</p>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                {vehicle.vin && <span className="font-mono">{vehicle.vin}</span>}
                {vehicle.stock && <span>Stock: {vehicle.stock}</span>}
                {vehicle.color && <span>{vehicle.color}{vehicle.interiorColor ? ` / ${vehicle.interiorColor}` : ""}</span>}
              </div>
            </div>

            {/* Mileage bar */}
            {vehicle.mileage && (
              <div className="px-5 py-2 border-b border-foreground bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {iconStyle === "icons" && <Gauge className="w-4 h-4 text-blue-600" />}
                  {iconStyle === "graphics" && <span className="text-lg">🔢</span>}
                  <span className="text-xs font-bold text-foreground uppercase">Odometer</span>
                </div>
                <p className="text-base font-extrabold text-foreground tabular-nums">{parseInt(vehicle.mileage).toLocaleString()} miles</p>
              </div>
            )}

            {mode !== "accessories_only" && (
              <>
                {/* Fuel economy + Safety side by side */}
                {(vehicle.mpgCity || vehicle.safetyOverall) && (
                  <div className="grid grid-cols-2 gap-0 border-b border-foreground">
                    <div className="border-r border-foreground">
                      <FuelEconomyBlock />
                    </div>
                    <div className="px-3 py-3">
                      {vehicle.safetyOverall && (
                        <>
                          <div className="flex items-center gap-1.5 mb-2 justify-center">
                            {iconStyle === "icons" && <Shield className="w-5 h-5 text-emerald-600" />}
                            {iconStyle === "graphics" && <span className="text-xl">🛡️</span>}
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">NHTSA Safety</p>
                          </div>
                          <div className="space-y-1">
                            <Stars rating={vehicle.safetyOverall} label="Overall" />
                            {vehicle.safetyFrontal && <Stars rating={vehicle.safetyFrontal} label="Frontal" />}
                            {vehicle.safetySide && <Stars rating={vehicle.safetySide} label="Side" />}
                            {vehicle.safetyRollover && <Stars rating={vehicle.safetyRollover} label="Rollover" />}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Powertrain */}
                {vehicle.engine && (
                  <div className="px-5 py-2 border-b border-foreground">
                    <div className="flex items-center gap-1.5 mb-1">
                      {iconStyle === "icons" && <Cog className="w-3.5 h-3.5 text-muted-foreground" />}
                      {iconStyle === "graphics" && <span>⚙️</span>}
                      <p className="text-[9px] font-bold text-foreground uppercase tracking-wider">Engine & Drivetrain</p>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {vehicle.engine}{vehicle.transmission ? ` · ${vehicle.transmission}` : ""}{vehicle.drivetrain ? ` · ${vehicle.drivetrain}` : ""}
                    </p>
                    {(vehicle.hp || vehicle.torque) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {vehicle.hp ? `${vehicle.hp} HP` : ""}{vehicle.hp && vehicle.torque ? " · " : ""}{vehicle.torque ? `${vehicle.torque} lb-ft` : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Equipment list */}
                {equipment.filter(Boolean).length > 0 && (
                  <div className="border-b border-foreground">
                    <button onClick={() => setShowEquipment(!showEquipment)} className="w-full flex items-center justify-between px-5 py-2 text-[9px] font-bold text-foreground uppercase tracking-wider hover:bg-muted/30 no-print">
                      <span>Standard & Optional Equipment ({equipment.filter(Boolean).length})</span>
                      {showEquipment ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showEquipment && (
                      <div className="px-5 pb-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {equipment.filter(Boolean).map((item, i) => (
                          <p key={i} className="text-[9px] text-foreground flex items-center gap-1">
                            {iconStyle === "icons" && <Zap className="w-2.5 h-2.5 text-teal flex-shrink-0" />}
                            {iconStyle === "graphics" && <span className="text-[8px]">✓</span>}
                            {iconStyle === "minimal" && <span className="text-[8px] text-muted-foreground">•</span>}
                            {item.trim()}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {vehicle.description && (
                  <div className="px-5 py-2 border-b border-foreground">
                    <p className="text-[9px] text-muted-foreground leading-relaxed">{vehicle.description}</p>
                  </div>
                )}
              </>
            )}

            {mode !== "equipment_only" && (
              <>
                {/* Dealer value propositions */}
                {valueProps.filter(v => v.name.trim()).length > 0 && (
                  <div className="px-5 py-2 border-b border-foreground bg-emerald-50/50">
                    <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Included With Purchase</p>
                    {valueProps.filter(v => v.name.trim()).map((vp, i) => (
                      <div key={i} className="flex justify-between text-[10px] py-0.5">
                        <span className="text-emerald-900">{vp.name}</span>
                        <span className="font-semibold text-emerald-700">{vp.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Installed accessories */}
                {installed.length > 0 && (
                  <div className="px-5 py-2 border-b border-foreground">
                    <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider mb-1">Installed Accessories</p>
                    {installed.map(p => (
                      <div key={p.id} className="flex justify-between text-[10px] py-0.5">
                        <span className="text-foreground">{p.name}</span>
                        <span className="font-semibold text-foreground tabular-nums">${p.price.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold pt-1 mt-1 border-t border-border">
                      <span>Installed Total</span><span className="tabular-nums">${installedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Optional accessories */}
                {optional.length > 0 && (
                  <div className="px-5 py-2 border-b border-foreground">
                    <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">Optional (May Accept or Decline)</p>
                    {optional.map(p => (
                      <div key={p.id} className="flex justify-between text-[10px] py-0.5">
                        <span className="text-foreground">{p.name}</span>
                        <span className="font-semibold text-foreground tabular-nums">${p.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pricing summary */}
                <div className="px-5 py-2 bg-muted/30">
                  {marketVal > 0 && <div className="flex justify-between text-xs text-foreground mb-0.5"><span>Market Value</span><span className="font-semibold tabular-nums">${marketVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                  {installedTotal > 0 && <div className="flex justify-between text-xs text-foreground mb-0.5"><span>Installed Accessories</span><span className="font-semibold tabular-nums">${installedTotal.toFixed(2)}</span></div>}
                  {docFee > 0 && <div className="flex justify-between text-xs text-foreground mb-0.5"><span>Documentation Fee</span><span className="font-semibold tabular-nums">${docFee.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-sm font-extrabold text-foreground pt-1 mt-1 border-t-2 border-foreground">
                    <span>TOTAL PRICE</span><span className="tabular-nums">${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {optionalTotal > 0 && <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>With all optional</span><span className="tabular-nums">${(totalPrice + optionalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                </div>
              </>
            )}

            {/* UPC tracking code + QR */}
            <div className="px-5 py-2 flex items-center justify-between border-t border-foreground">
              <div className="flex-1 min-w-0">
                <p className="text-[7px] font-bold text-foreground">UPC: {trackingCode}</p>
                <p className="text-[6px] text-muted-foreground mt-0.5">Scan QR for details & sign-off · This is NOT the FTC Buyers Guide</p>
              </div>
              {signingUrl && <QRCodeSVG value={signingUrl} size={48} className="flex-shrink-0 ml-2" />}
            </div>

            {/* Footer */}
            <div className="text-center py-1 bg-primary text-primary-foreground text-[7px] font-semibold">
              {dealerName} {dealerPhone && `· ${dealerPhone}`} {dealerAddress && `· ${dealerAddress}`}
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

export default UsedCarSticker;
