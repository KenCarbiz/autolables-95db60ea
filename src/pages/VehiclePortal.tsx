import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useVinDecode } from "@/hooks/useVinDecode";
import { ShieldCheck, CheckCircle2, Package, DollarSign, Play, Phone, MapPin, Star } from "lucide-react";
import Logo from "@/components/brand/Logo";

interface PortalProduct {
  id: string;
  name: string;
  subtitle?: string;
  warranty?: string;
  badge_type: string;
  price: number;
  disclosure?: string;
}

const VehiclePortal = () => {
  const { vin } = useParams<{ vin: string }>();
  const [vehicleFile, setVehicleFile] = useState<any>(null);
  const [storeName, setStoreName] = useState("Your Dealership");
  const [storePhone, setStorePhone] = useState("");

  useEffect(() => {
    if (!vin) return;
    try {
      const files = JSON.parse(localStorage.getItem("vehicle_files") || "[]");
      const file = files.find((f: any) => f.vin === vin);
      if (file) {
        setVehicleFile(file);
      }
      const stores = JSON.parse(localStorage.getItem("wl_stores") || "[]");
      if (stores[0]) {
        setStoreName(stores[0].name || "Your Dealership");
        setStorePhone(stores[0].phone || "");
      }
    } catch { /* */ }
  }, [vin]);

  const latestSticker = vehicleFile?.stickers?.[vehicleFile.stickers.length - 1];
  const products: PortalProduct[] = latestSticker?.products_snapshot || [];
  const installed = products.filter(p => p.badge_type === "installed");
  const optional = products.filter(p => p.badge_type === "optional");
  const videos = (() => {
    try {
      return (JSON.parse(localStorage.getItem("video_walkarounds") || "[]") as any[])
        .filter((v: any) => v.vin === vin && v.status === "ready");
    } catch { return []; }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo variant="full" size={28} />
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">{storeName}</p>
            {storePhone && <p className="text-[10px] text-muted-foreground">{storePhone}</p>}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {!vehicleFile ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Vehicle Not Found</h2>
            <p className="text-sm text-muted-foreground mt-1">VIN: {vin}</p>
            <p className="text-xs text-muted-foreground mt-2">This vehicle may not have been stickered yet.</p>
          </div>
        ) : (
          <>
            {/* Vehicle hero */}
            <div className="bg-white rounded-2xl border border-border shadow-premium overflow-hidden">
              <div className="bg-primary text-primary-foreground p-6">
                <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-1">
                  {vehicleFile.condition === "new" ? "New Vehicle" : "Pre-Owned Vehicle"}
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  {vehicleFile.year} {vehicleFile.make} {vehicleFile.model}
                </h1>
                {vehicleFile.trim && <p className="text-sm text-primary-foreground/80 mt-0.5">{vehicleFile.trim}</p>}
                <div className="flex items-center gap-4 mt-3 text-xs text-primary-foreground/70">
                  <span>VIN: {vehicleFile.vin}</span>
                  {vehicleFile.stock_number && <span>Stock: {vehicleFile.stock_number}</span>}
                  <span>{vehicleFile.mileage?.toLocaleString()} miles</span>
                </div>
              </div>

              {/* Video walkaround */}
              {videos.length > 0 && (
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Play className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-foreground">Video Walkaround</h3>
                  </div>
                  {videos.map(v => (
                    <div key={v.id} className="rounded-lg bg-muted aspect-video flex items-center justify-center">
                      <a href={v.videoUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:underline">
                        <Play className="w-5 h-5" /> Watch Video
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Pricing summary */}
              {latestSticker?.totals && (
                <div className="p-4 border-b border-border bg-emerald-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-foreground">
                        {vehicleFile.condition === "new" ? "Suggested Retail Price" : "Asking Price"}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-foreground tabular-nums">
                      ${latestSticker.totals.final_price?.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Base: ${latestSticker.totals.base_price?.toLocaleString()}</span>
                    <span>Accessories: ${latestSticker.totals.accessories_total?.toLocaleString()}</span>
                    {latestSticker.totals.doc_fee > 0 && <span>Doc fee: ${latestSticker.totals.doc_fee}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* What's on this vehicle */}
            <div className="bg-white rounded-2xl border border-border shadow-premium p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-semibold text-foreground">What's On This Vehicle</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Below are the dealer-installed products and accessories on this vehicle.
                Items marked <strong>Pre-Installed</strong> are already on the vehicle and included in the price.
                Items marked <strong>Optional</strong> can be accepted or declined at no impact to your purchase.
              </p>

              {installed.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2">Pre-Installed (Included in Price)</p>
                  <div className="space-y-2">
                    {installed.map(p => (
                      <ProductCard key={p.id} product={p} type="installed" />
                    ))}
                  </div>
                </div>
              )}

              {optional.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">Optional (You Choose)</p>
                  <div className="space-y-2">
                    {optional.map(p => (
                      <ProductCard key={p.id} product={p} type="optional" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trust indicators */}
            <div className="bg-white rounded-2xl border border-border shadow-premium p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-semibold text-foreground">Your Protection</h2>
              </div>
              <div className="space-y-3">
                <TrustItem icon={CheckCircle2} text="Every product is fully disclosed with pricing before you sign anything." />
                <TrustItem icon={CheckCircle2} text="Optional items can be declined with zero impact on your purchase or financing." />
                <TrustItem icon={CheckCircle2} text="All disclosures comply with FTC federal requirements and your state's consumer protection laws." />
                <TrustItem icon={CheckCircle2} text="Your signature, initials, and selections are timestamped and stored in a tamper-proof audit trail." />
                <TrustItem icon={CheckCircle2} text="You will receive a copy of all signed documents for your records." />
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-2xl border border-border shadow-premium p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Questions?</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Take your time reviewing everything above. When you're ready, your salesperson
                will walk you through each item and answer any questions.
              </p>
              <div className="flex gap-3">
                {storePhone && (
                  <a href={`tel:${storePhone}`} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                    <Phone className="w-4 h-4" /> Call {storeName}
                  </a>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center py-6">
              <Logo variant="full" size={24} />
              <p className="text-[10px] text-muted-foreground mt-2">
                Powered by Autocurb.io · Where the lot meets the cloud
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ProductCard = ({ product, type }: { product: PortalProduct; type: "installed" | "optional" }) => (
  <div className={`rounded-lg border p-3 ${type === "installed" ? "border-blue-200 bg-blue-50/30" : "border-amber-200 bg-amber-50/30"}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">{product.name}</p>
        {product.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{product.subtitle}</p>}
        {product.warranty && <p className="text-[10px] text-muted-foreground mt-0.5">{product.warranty}</p>}
      </div>
      <p className="text-sm font-bold text-foreground tabular-nums">${product.price.toLocaleString()}</p>
    </div>
    {product.disclosure && (
      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{product.disclosure}</p>
    )}
  </div>
);

const TrustItem = ({ icon: Icon, text }: { icon: typeof CheckCircle2; text: string }) => (
  <div className="flex items-start gap-2">
    <Icon className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
    <p className="text-xs text-muted-foreground">{text}</p>
  </div>
);

export default VehiclePortal;
