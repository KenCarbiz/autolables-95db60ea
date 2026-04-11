import { useState, useRef } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { useVinDecode } from "@/hooks/useVinDecode";
import { useAudit } from "@/contexts/AuditContext";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Sparkles,
  Car,
  DollarSign,
  TrendingUp,
  Printer,
  Download,
  Palette,
  Settings2,
} from "lucide-react";

type Theme = "red" | "blue" | "green" | "navy" | "gold";

const THEMES: Record<Theme, { gradient: string; accent: string; text: string; cta: string }> = {
  red:   { gradient: "from-red-600 to-red-800",       accent: "bg-yellow-400",   text: "text-white", cta: "bg-yellow-400 text-red-900" },
  blue:  { gradient: "from-blue-600 to-blue-900",     accent: "bg-orange-400",   text: "text-white", cta: "bg-orange-400 text-blue-900" },
  green: { gradient: "from-emerald-600 to-emerald-900", accent: "bg-yellow-300", text: "text-white", cta: "bg-yellow-300 text-emerald-900" },
  navy:  { gradient: "from-slate-800 to-slate-950",   accent: "bg-amber-400",    text: "text-white", cta: "bg-amber-400 text-slate-900" },
  gold:  { gradient: "from-amber-500 to-amber-700",   accent: "bg-slate-900",    text: "text-slate-900", cta: "bg-slate-900 text-amber-400" },
};

const TradeUpSticker = () => {
  const { currentStore, tenant } = useTenant();
  const { settings } = useDealerSettings();
  const { decode, decoding } = useVinDecode();
  const { log } = useAudit();
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  // Sticker state
  const [vehicleType, setVehicleType] = useState<"new" | "used">("used");
  const [vehicle, setVehicle] = useState({ year: "", make: "", model: "", trim: "", vin: "", stock: "", mileage: "", price: "" });
  const [headline, setHeadline] = useState("WHAT'S YOUR CAR WORTH?");
  const [subhead, setSubhead] = useState("TRADE UP TODAY");
  const [offerText, setOfferText] = useState("Get instant trade-in value and upgrade to a newer vehicle");
  const [theme, setTheme] = useState<Theme>("red");
  const [qrUrl, setQrUrl] = useState("");
  const [callText, setCallText] = useState("Scan to get your trade-in value");

  const themeCfg = THEMES[theme];
  const dealerName = currentStore?.name || settings.dealer_name || tenant?.name || "Your Dealership";
  const phone = currentStore?.phone || "";
  const website = qrUrl || `https://${currentStore?.slug || "yourdealer"}.com/trade-in`;

  const handleVinDecode = async () => {
    if (!vehicle.vin.trim()) return;
    const result = await decode(vehicle.vin);
    if (result) {
      setVehicle({ ...vehicle, year: result.year, make: result.make, model: result.model, trim: result.trim });
      toast.success("VIN decoded");
    }
  };

  const handlePrint = () => {
    window.print();
    if (user) log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_printed", entity_type: "trade_up_sticker", entity_id: vehicle.vin || "sticker", details: { theme, type: vehicleType } });
  };

  const handleDownloadPdf = async () => {
    const card = cardRef.current;
    if (!card) return;
    setGenerating(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const { default: jsPDF } = await import("jspdf");
      const canvas = await html2canvas(card, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdfWidth = 8.5;
      const pdfHeight = (canvas.height / canvas.width) * pdfWidth;
      const pdf = new jsPDF({ unit: "in", format: [pdfWidth, pdfHeight], orientation: "portrait" });
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Trade-Up-Sticker-${vehicle.vin || "draft"}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-display text-foreground">
            Trade-Up Sticker
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Promotional sticker to drive trade-in leads on every vehicle on your lot.
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={generating}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {generating ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: config panel */}
        <div className="lg:col-span-2 space-y-4 no-print">
          {/* Vehicle Type */}
          <ConfigCard icon={Car} title="Vehicle Type">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVehicleType("new")}
                className={`h-10 rounded-md text-sm font-medium border-2 transition-all ${
                  vehicleType === "new" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                }`}
              >
                New Vehicle
              </button>
              <button
                onClick={() => setVehicleType("used")}
                className={`h-10 rounded-md text-sm font-medium border-2 transition-all ${
                  vehicleType === "used" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                }`}
              >
                Used Vehicle
              </button>
            </div>
          </ConfigCard>

          {/* Vehicle info */}
          <ConfigCard icon={Car} title="Vehicle Info">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={vehicle.vin}
                  onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value.toUpperCase() })}
                  placeholder="VIN (17 chars)"
                  className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                />
                <button
                  onClick={handleVinDecode}
                  disabled={decoding || vehicle.vin.length !== 17}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:opacity-90"
                >
                  {decoding ? "..." : "Decode"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input value={vehicle.year} onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })} placeholder="Year" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.make} onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })} placeholder="Make" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none col-span-1" />
                <input value={vehicle.model} onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })} placeholder="Model" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none col-span-1" />
                <input value={vehicle.trim} onChange={(e) => setVehicle({ ...vehicle, trim: e.target.value })} placeholder="Trim" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none col-span-1" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={vehicle.stock} onChange={(e) => setVehicle({ ...vehicle, stock: e.target.value })} placeholder="Stock #" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.mileage} onChange={(e) => setVehicle({ ...vehicle, mileage: e.target.value })} placeholder="Mileage" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
                <input value={vehicle.price} onChange={(e) => setVehicle({ ...vehicle, price: e.target.value })} placeholder="Price" className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none" />
              </div>
            </div>
          </ConfigCard>

          {/* Messaging */}
          <ConfigCard icon={Settings2} title="Messaging">
            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Headline</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value.toUpperCase())}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Subheading</label>
                <input
                  value={subhead}
                  onChange={(e) => setSubhead(e.target.value.toUpperCase())}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Offer Text</label>
                <input
                  value={offerText}
                  onChange={(e) => setOfferText(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Call To Action</label>
                <input
                  value={callText}
                  onChange={(e) => setCallText(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">QR / Trade-in URL</label>
                <input
                  value={qrUrl}
                  onChange={(e) => setQrUrl(e.target.value)}
                  placeholder="https://yourdealer.com/trade-in"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </ConfigCard>

          {/* Theme */}
          <ConfigCard icon={Palette} title="Color Theme">
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(THEMES) as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`h-10 rounded-md bg-gradient-to-br ${THEMES[t].gradient} border-2 transition-all ${
                    theme === t ? "border-primary scale-105" : "border-transparent hover:border-border"
                  }`}
                  title={t}
                />
              ))}
            </div>
          </ConfigCard>
        </div>

        {/* Right: live sticker preview */}
        <div className="lg:col-span-3">
          <div className="sticky top-20">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 no-print">
              Live Preview
            </p>
            <div
              ref={cardRef}
              className={`rounded-xl overflow-hidden shadow-premium-lg bg-gradient-to-br ${themeCfg.gradient} ${themeCfg.text} relative`}
              style={{ aspectRatio: "8.5 / 11", maxWidth: "600px" }}
            >
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -mr-20 -mt-20" />
              <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white/5 -ml-28 -mb-28" />

              <div className="relative h-full flex flex-col p-10">
                {/* Top: type badge + dealer */}
                <div className="flex items-start justify-between">
                  <span className={`${themeCfg.accent} text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded`}>
                    {vehicleType === "new" ? "New Arrival" : "Pre-Owned"}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{dealerName}</p>
                    {phone && <p className="text-xs opacity-80">{phone}</p>}
                  </div>
                </div>

                {/* Headline */}
                <div className="flex-1 flex flex-col justify-center text-center mt-4">
                  <p className="text-4xl font-black leading-none tracking-tight font-display drop-shadow-sm">
                    {headline}
                  </p>
                  <div className="flex items-center justify-center my-4">
                    <div className="h-[2px] w-12 bg-current opacity-50" />
                    <TrendingUp className="mx-3 w-5 h-5" />
                    <div className="h-[2px] w-12 bg-current opacity-50" />
                  </div>
                  <p className={`text-5xl font-black leading-none tracking-tight font-display ${themeCfg.accent === "bg-yellow-400" ? "text-yellow-300" : themeCfg.accent === "bg-orange-400" ? "text-orange-300" : themeCfg.accent === "bg-yellow-300" ? "text-yellow-200" : themeCfg.accent === "bg-amber-400" ? "text-amber-300" : "text-slate-900"} drop-shadow-md`}>
                    {subhead}
                  </p>
                  <p className="text-sm mt-4 opacity-90 max-w-xs mx-auto leading-relaxed">
                    {offerText}
                  </p>
                </div>

                {/* Vehicle info chip */}
                {(vehicle.year || vehicle.make || vehicle.model) && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 my-4 text-center">
                    <p className="text-xs uppercase tracking-wider opacity-70 mb-1">You're sitting in</p>
                    <p className="text-lg font-bold">
                      {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-1 text-xs opacity-80">
                      {vehicle.stock && <span>Stock: {vehicle.stock}</span>}
                      {vehicle.mileage && <span>{parseInt(vehicle.mileage).toLocaleString()} mi</span>}
                      {vehicle.price && <span>${parseInt(vehicle.price).toLocaleString()}</span>}
                    </div>
                  </div>
                )}

                {/* CTA with QR code */}
                <div className="bg-white rounded-lg p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className={`text-xs font-bold uppercase tracking-wider ${theme === "gold" ? "text-slate-900" : "text-slate-700"}`}>
                      Scan to get your
                    </p>
                    <p className={`text-xl font-black tracking-tight ${theme === "gold" ? "text-slate-900" : "text-slate-900"}`}>
                      Instant Trade Value
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {callText}
                    </p>
                  </div>
                  <div className="bg-white p-1 rounded">
                    <QRCodeSVG value={website} size={88} level="M" />
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[10px] opacity-70">
                  <span>{website.replace(/^https?:\/\//, "")}</span>
                  <span>Limited Time Offer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigCard = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Car;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="bg-card rounded-xl border border-border shadow-premium p-4">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

export default TradeUpSticker;
