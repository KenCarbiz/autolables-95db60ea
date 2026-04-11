import { useState, useRef, useEffect, useMemo } from "react";
import { useProducts, Product } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { useProductRules, VehicleContext } from "@/hooks/useProductRules";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import AddendumHeader from "@/components/addendum/AddendumHeader";
import VehicleStrip from "@/components/addendum/VehicleStrip";
import IntentBox from "@/components/addendum/IntentBox";
import ProductRow from "@/components/addendum/ProductRow";
import TotalBar from "@/components/addendum/TotalBar";
import SelectionRecord from "@/components/addendum/SelectionRecord";
import Disclosures from "@/components/addendum/Disclosures";
import SignaturePad from "@/components/addendum/SignaturePad";
import AddendumFooter from "@/components/addendum/AddendumFooter";
import QRCodeModal from "@/components/addendum/QRCodeModal";
import LeadCaptureModal from "@/components/addendum/LeadCaptureModal";
import VinBarcode from "@/components/addendum/VinBarcode";
import VehicleDetailsBar from "@/components/addendum/VehicleDetailsBar";
import StoreSelector from "@/components/StoreSelector";
import { ScrapedVehicle } from "@/hooks/useVehicleUrlScrape";
import { useAudit } from "@/contexts/AuditContext";
import { useTenant } from "@/contexts/TenantContext";
import { QRCodeSVG } from "qrcode.react";

// Paper size map (width in inches)
const PAPER_WIDTHS: Record<string, string> = {
  letter: "8.5in",
  legal: "8.5in",
  "half-sheet": "5.5in",
  custom: "8.5in",
};

const Index = () => {
  const { data: products, isLoading } = useProducts();
  const { user, isAdmin } = useAuth();
  const { settings } = useDealerSettings();
  const { rules, getMatchingProducts } = useProductRules();
  const { log } = useAudit();
  const { currentStore } = useTenant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get("id");
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [inkSaving, setInkSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [loadedProducts, setLoadedProducts] = useState<Product[] | null>(null);

  // Vehicle info
  const [vehicle, setVehicle] = useState({ ymm: "", stock: "", vin: "", date: "" });

  // Decoded vehicle context for rules
  const [vehicleContext, setVehicleContext] = useState<VehicleContext>({
    year: "", make: "", model: "", trim: "", bodyStyle: "",
  });

  // Scraped vehicle details (from URL import)
  const [vehicleDetails, setVehicleDetails] = useState<Partial<ScrapedVehicle>>({});

  // Product type overrides — employee can toggle installed <-> optional at signing time
  const [typeOverrides, setTypeOverrides] = useState<Record<string, "installed" | "optional">>({});

  // Initials & optional selections
  const [initials, setInitials] = useState<Record<string, string>>({});
  const [optionalSelections, setOptionalSelections] = useState<Record<string, string>>({});

  // Signatures
  const [customerSig, setCustomerSig] = useState({ data: "", type: "draw" as "draw" | "type" });
  const [cobuyerSig, setCobuyerSig] = useState({ data: "", type: "draw" as "draw" | "type" });
  const [employeeSig, setEmployeeSig] = useState({ data: "", type: "draw" as "draw" | "type" });

  // QR / Lead capture modal
  const [qrOpen, setQrOpen] = useState(false);
  const [signingUrl, setSigningUrl] = useState("");

  // Paper size
  const paperWidth = settings.addendum_paper_size === "custom"
    ? `${settings.addendum_custom_width || "8.5"}in`
    : PAPER_WIDTHS[settings.addendum_paper_size] || "8.5in";

  // Load saved addendum when ?id= is present
  useEffect(() => {
    if (!viewId) {
      setViewMode(false);
      setLoadedProducts(null);
      return;
    }
    const loadAddendum = async () => {
      const { data, error } = await supabase
        .from("addendums")
        .select("*")
        .eq("id", viewId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Could not load addendum");
        return;
      }
      setViewMode(true);
      setVehicle({
        ymm: data.vehicle_ymm || "",
        stock: data.vehicle_stock || "",
        vin: data.vehicle_vin || "",
        date: data.addendum_date || "",
      });
      setInitials((data.initials as Record<string, string>) || {});
      setOptionalSelections((data.optional_selections as Record<string, string>) || {});
      setCustomerSig({
        data: data.customer_signature_data || "",
        type: (data.customer_signature_type as "draw" | "type") || "draw",
      });
      setCobuyerSig({
        data: data.cobuyer_signature_data || "",
        type: (data.cobuyer_signature_type as "draw" | "type") || "draw",
      });
      setEmployeeSig({
        data: data.employee_signature_data || "",
        type: (data.employee_signature_type as "draw" | "type") || "draw",
      });
      const snapshot = data.products_snapshot as any[];
      if (snapshot?.length) {
        setLoadedProducts(snapshot.map((p: any, i: number) => ({
          ...p,
          sort_order: p.sort_order ?? i,
          is_active: true,
        })));
      }
    };
    loadAddendum();
  }, [viewId]);

  // Apply product rules, then apply admin default mode + overrides
  const baseProducts = viewMode && loadedProducts ? loadedProducts : products;
  const ruledProducts = settings.feature_product_rules && rules.length > 0 && !viewMode
    ? getMatchingProducts(vehicleContext, baseProducts || [])
    : baseProducts;

  // Apply product_default_mode from admin settings, then per-product overrides
  const displayProducts = useMemo(() => {
    if (!ruledProducts) return [];
    return ruledProducts.map(p => {
      // Check for employee override first
      if (typeOverrides[p.id]) {
        const overType = typeOverrides[p.id];
        return {
          ...p,
          badge_type: overType,
          price_label: overType === "installed" ? "Included in Selling Price" : "If Accepted",
        };
      }
      // Apply admin default mode
      if (settings.product_default_mode === "all_installed") {
        return { ...p, badge_type: "installed", price_label: "Included in Selling Price" };
      }
      if (settings.product_default_mode === "all_optional") {
        return { ...p, badge_type: "optional", price_label: "If Accepted" };
      }
      return p; // "selective" = use whatever's set per product
    });
  }, [ruledProducts, typeOverrides, settings.product_default_mode]);

  const installed = displayProducts.filter((p) => p.badge_type === "installed");
  const optional = displayProducts.filter((p) => p.badge_type === "optional");
  const installedTotal = installed.reduce((sum, p) => sum + p.price, 0);
  const acceptedOptional = optional.filter((p) => optionalSelections[p.id] === "accept");
  const optionalTotal = acceptedOptional.reduce((sum, p) => sum + p.price, 0);
  const grandTotal = installedTotal + optionalTotal;
  const docFeeAmount = settings.doc_fee_enabled ? (settings.doc_fee_amount || 0) : 0;
  const grandTotalWithFee = grandTotal + docFeeAmount;

  const iconMap = JSON.parse(localStorage.getItem("product_icons") || "{}");

  const handleToggleProductType = (productId: string) => {
    const current = displayProducts.find(p => p.id === productId);
    if (!current) return;
    const newType = current.badge_type === "installed" ? "optional" : "installed";
    setTypeOverrides(prev => ({ ...prev, [productId]: newType as "installed" | "optional" }));
    // Clear optional selection if switching to installed
    if (newType === "installed") {
      setOptionalSelections(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  };

  const handleVinDecoded = (result: { year: string; make: string; model: string; trim: string; bodyStyle: string }) => {
    setVehicleContext({ year: result.year, make: result.make, model: result.model, trim: result.trim, bodyStyle: result.bodyStyle });
  };

  const handleVehicleScraped = (result: ScrapedVehicle) => {
    setVehicleDetails(result);
  };

  const handlePrint = () => {
    window.print();
    if (user) log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_printed", entity_type: "addendum", entity_id: vehicle.vin, details: { ymm: vehicle.ymm } });
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
      const storeName = currentStore?.name || settings.dealer_name;
      pdf.save(`Dealer-Addendum-${storeName.replace(/\s+/g, "-")}.pdf`);
      if (user) log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_pdf", entity_type: "addendum", entity_id: vehicle.vin, details: { ymm: vehicle.ymm } });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!vehicle.ymm.trim()) { toast.error("Please enter Year/Make/Model first"); return; }
    if (!vehicle.vin.trim()) { toast.error("Please enter the VIN first"); return; }

    setSaving(true);
    const token = crypto.randomUUID();
    const payload = {
      created_by: user.id,
      vehicle_ymm: vehicle.ymm,
      vehicle_stock: vehicle.stock,
      vehicle_vin: vehicle.vin,
      addendum_date: vehicle.date || null,
      products_snapshot: JSON.parse(JSON.stringify(displayProducts || [])),
      initials: {},
      optional_selections: {},
      total_installed: installedTotal,
      total_with_optional: grandTotalWithFee,
      status: "draft" as const,
      signing_token: token,
    };
    const { error } = await supabase.from("addendums").insert([payload as any]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    const url = `${window.location.origin}/sign/${token}`;
    setSigningUrl(url);
    setQrOpen(true);
    toast.success("Signing link created!");
    log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_sent", entity_type: "addendum", entity_id: vehicle.vin, details: { ymm: vehicle.ymm, token } });
  };

  const handleSave = async () => {
    if (!user) { toast.error("Sign in to save"); return; }
    if (!vehicle.ymm.trim()) { toast.error("Please enter Year/Make/Model"); return; }
    if (!vehicle.vin.trim()) { toast.error("Please enter the VIN"); return; }

    const allProducts = displayProducts || [];
    const missingInitials = allProducts.filter((p) => !initials[p.id]?.trim());
    if (missingInitials.length > 0) {
      toast.error(`Please initial all products. Missing ${missingInitials.length} initial(s).`);
      return;
    }

    const optionalProducts = allProducts.filter((p) => p.badge_type === "optional");
    const missingSelections = optionalProducts.filter((p) => !optionalSelections[p.id]);
    if (missingSelections.length > 0) {
      toast.error(`Please accept or decline all optional products. ${missingSelections.length} remaining.`);
      return;
    }

    if (!customerSig.data) { toast.error("Customer signature is required"); return; }
    if (!employeeSig.data) { toast.error("Dealer representative signature is required"); return; }

    setSaving(true);
    const now = new Date().toISOString();
    const token = crypto.randomUUID();
    const payload = {
      created_by: user.id,
      vehicle_ymm: vehicle.ymm,
      vehicle_stock: vehicle.stock,
      vehicle_vin: vehicle.vin,
      addendum_date: vehicle.date || null,
      products_snapshot: JSON.parse(JSON.stringify(displayProducts || [])),
      initials,
      optional_selections: optionalSelections,
      customer_signature_data: customerSig.data,
      customer_signature_type: customerSig.type,
      customer_signed_at: customerSig.data ? now : null,
      cobuyer_signature_data: cobuyerSig.data || null,
      cobuyer_signature_type: cobuyerSig.data ? cobuyerSig.type : null,
      cobuyer_signed_at: cobuyerSig.data ? now : null,
      employee_signature_data: employeeSig.data,
      employee_signature_type: employeeSig.type,
      employee_signed_at: employeeSig.data ? now : null,
      total_installed: installedTotal,
      total_with_optional: grandTotalWithFee,
      status: customerSig.data && employeeSig.data ? "signed" : "draft",
      signing_token: token,
    };
    const { error } = await supabase.from("addendums").insert([payload]);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Addendum saved!");
      log({ store_id: currentStore?.id || "", user_id: user.id, action: "addendum_created", entity_type: "addendum", entity_id: vehicle.vin, details: { ymm: vehicle.ymm, vin: vehicle.vin, status: payload.status, products_count: displayProducts.length, installed_total: installedTotal, optional_total: optionalTotal, type_overrides: typeOverrides } });
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground animate-pulse">Loading products...</p></div>;

  // Signing URL for barcode on the printed addendum
  const addendumSigningUrl = signingUrl || (vehicle.vin ? `${window.location.origin}/sign/pending-${vehicle.vin}` : "");

  return (
    <div className="min-h-screen bg-background py-4 px-2 md:px-4">
      {/* Controls */}
      <div style={{ maxWidth: paperWidth }} className="mx-auto mb-3 flex flex-wrap gap-2 items-center no-print">
        <StoreSelector />
        {viewMode && (
          <button onClick={() => navigate("/")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
            ← New Addendum
          </button>
        )}
        {user && isAdmin && (
          <button onClick={() => navigate("/admin")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-gold text-navy tracking-[0.4px] hover:opacity-85">
            Admin Panel
          </button>
        )}
        {user && (
          <button onClick={() => navigate("/saved")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-blue text-primary-foreground tracking-[0.4px] hover:opacity-85">
            Saved Addendums
          </button>
        )}
        {settings.feature_buyers_guide && user && (
          <button onClick={() => navigate("/buyers-guide")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
            Buyers Guide
          </button>
        )}
        {!user && (
          <button onClick={() => navigate("/login")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
            Admin Login
          </button>
        )}
        {user && !viewMode && (
          <button onClick={handleSave} disabled={saving} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-teal text-primary-foreground tracking-[0.4px] hover:opacity-85 disabled:opacity-50">
            {saving ? "Saving..." : "Save Addendum"}
          </button>
        )}
        {user && !viewMode && (
          <button onClick={handleSendToCustomer} disabled={saving} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-action text-primary-foreground tracking-[0.4px] hover:opacity-85 disabled:opacity-50">
            Send to Customer
          </button>
        )}
        <button onClick={handlePrint} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
          Print
        </button>
        <button onClick={handleDownloadPdf} disabled={generating} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85 disabled:opacity-50">
          {generating ? "Generating..." : "Download PDF"}
        </button>
        {settings.feature_ink_saving && (
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={inkSaving} onChange={(e) => setInkSaving(e.target.checked)} />
            Ink-Saving Mode
          </label>
        )}
      </div>

      {/* QR / Lead Capture Modal */}
      {settings.feature_lead_capture ? (
        <LeadCaptureModal open={qrOpen} signingUrl={signingUrl} vehicleInfo={vehicle.ymm} onClose={() => setQrOpen(false)} />
      ) : (
        <QRCodeModal open={qrOpen} signingUrl={signingUrl} onClose={() => setQrOpen(false)} />
      )}

      {/* Rules notification */}
      {settings.feature_product_rules && rules.length > 0 && vehicleContext.make && !viewMode && (
        <div style={{ maxWidth: paperWidth }} className="mx-auto mb-2 no-print">
          <div className="bg-teal/10 border border-teal/30 rounded-md px-3 py-1.5 text-[11px] text-teal font-semibold">
            Product rules active — showing {displayProducts?.length || 0} products matching {vehicleContext.year} {vehicleContext.make} {vehicleContext.model}
          </div>
        </div>
      )}

      {/* Addendum Card — scales to paper size */}
      <div ref={cardRef} style={{ maxWidth: paperWidth }} className="addendum-card mx-auto bg-card shadow-lg rounded-lg overflow-hidden border border-border-custom">
        <AddendumHeader inkSaving={inkSaving} />
        <VehicleStrip vehicle={vehicle} onChange={setVehicle} onVinDecoded={handleVinDecoded} onVehicleScraped={handleVehicleScraped} inkSaving={inkSaving} />

        {/* VIN Barcode */}
        {settings.feature_vin_barcode && vehicle.vin.trim().length === 17 && (
          <div className="px-3 py-1 border-b border-border-custom flex justify-center">
            <VinBarcode vin={vehicle.vin.trim()} />
          </div>
        )}

        {/* Scraped vehicle details */}
        {Object.keys(vehicleDetails).length > 0 && (vehicleDetails.mileage || vehicleDetails.color || vehicleDetails.condition || vehicleDetails.price) && (
          <VehicleDetailsBar details={vehicleDetails} inkSaving={inkSaving} />
        )}

        <div className="px-3 py-2 space-y-2">
          <IntentBox inkSaving={inkSaving} />

          {/* Section Head */}
          <div className="text-[9px] font-bold text-foreground">
            <p>Dealer-Installed Products & Pricing</p>
            <p className="text-muted-foreground font-normal">
              {installed.length > 0 && `Items #1–#${installed.length}: Pre-Installed · Non-Removable`}
              {optional.length > 0 && ` | ${optional.length > 0 ? `Item #${installed.length + 1}${optional.length > 1 ? `–#${installed.length + optional.length}` : ""}: Optional` : ""}`}
            </p>
          </div>

          {/* Product Table Header */}
          <div className="flex text-[8px] font-bold text-muted-foreground border-b border-border-custom pb-0.5">
            <span className="w-5">#</span>
            {settings.allow_type_override_at_signing && !viewMode && <span className="w-14 text-center no-print">Type</span>}
            <span className="flex-1">Product Name & Description</span>
            <span className="w-24 text-right">Dealer Retail Price</span>
          </div>

          {/* Products with inline type override toggle */}
          {displayProducts?.map((p, i) => (
            <div key={p.id} className="flex items-start gap-0">
              {settings.allow_type_override_at_signing && !viewMode && (
                <button
                  onClick={() => handleToggleProductType(p.id)}
                  className="no-print w-14 shrink-0 mt-2 flex flex-col items-center gap-0.5"
                  title={`Click to switch to ${p.badge_type === "installed" ? "optional" : "installed"}`}
                >
                  <div className={`relative w-8 h-4 rounded-full transition-colors ${p.badge_type === "installed" ? "bg-navy" : "bg-gold"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow transition-transform ${p.badge_type === "installed" ? "translate-x-0.5" : "translate-x-4"}`} />
                  </div>
                  <span className="text-[6px] text-muted-foreground font-semibold">
                    {p.badge_type === "installed" ? "INST" : "OPT"}
                  </span>
                </button>
              )}
              <div className="flex-1 min-w-0">
                <ProductRow
                  num={i + 1}
                  name={p.name}
                  subtitle={p.subtitle || ""}
                  warranty={p.warranty || ""}
                  badgeType={p.badge_type as "installed" | "optional"}
                  price={`$${p.price.toFixed(2)}`}
                  priceLabel={p.price_label || ""}
                  disclosure={p.disclosure || ""}
                  isOptional={p.badge_type === "optional"}
                  inkSaving={inkSaving}
                  iconType={iconMap[p.id] || ""}
                />
              </div>
            </div>
          ))}

          <TotalBar
            installedTotal={installedTotal}
            optionalTotal={optionalTotal}
            grandTotal={grandTotal}
            optionalItems={optional}
            acceptedOptional={acceptedOptional}
            inkSaving={inkSaving}
          />
          <SelectionRecord
            installed={installed}
            optional={optional}
            initials={initials}
            onInitialChange={(id, val) => setInitials((prev) => ({ ...prev, [id]: val }))}
            optionalSelections={optionalSelections}
            onOptionalChange={(id, val) => setOptionalSelections((prev) => ({ ...prev, [id]: val }))}
            installedStartNum={1}
            inkSaving={inkSaving}
          />
          <Disclosures inkSaving={inkSaving} />

          {/* Signing QR Barcode — printed on every addendum for remote signing */}
          {addendumSigningUrl && (
            <div className="flex items-center justify-between border border-border-custom rounded px-3 py-2">
              <div>
                <p className="text-[8px] font-bold text-foreground">Remote Signing</p>
                <p className="text-[7px] text-muted-foreground">Scan to sign this addendum electronically</p>
                <p className="text-[6px] text-muted-foreground mt-0.5 font-mono break-all max-w-[3in]">{addendumSigningUrl}</p>
              </div>
              <QRCodeSVG value={addendumSigningUrl} size={60} />
            </div>
          )}

          {/* Signature Section */}
          <div className="space-y-3 pt-2">
            <SignaturePad label="Customer Signature" subtitle="Buyer acknowledges receipt of this addendum" value={customerSig.data} type={customerSig.type} onChange={(data, type) => setCustomerSig({ data, type })} />
            {settings.feature_cobuyer_signature && (
              <SignaturePad label="Co-Buyer Signature (if applicable)" subtitle="Co-Buyer acknowledges receipt" value={cobuyerSig.data} type={cobuyerSig.type} onChange={(data, type) => setCobuyerSig({ data, type })} />
            )}
            <SignaturePad label="Dealer Representative" subtitle="Sales / Finance representative signature & date" value={employeeSig.data} type={employeeSig.type} onChange={(data, type) => setEmployeeSig({ data, type })} />
          </div>

          <AddendumFooter inkSaving={inkSaving} />
        </div>
      </div>
    </div>
  );
};

export default Index;
