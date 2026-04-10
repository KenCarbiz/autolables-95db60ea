import { useState, useRef, useEffect } from "react";
import { useProducts, Product } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
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

const Index = () => {
  const { data: products, isLoading } = useProducts();
  const { user, isAdmin } = useAuth();
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

  // Initials & optional selections
  const [initials, setInitials] = useState<Record<string, string>>({});
  const [optionalSelections, setOptionalSelections] = useState<Record<string, string>>({});

  // Signatures
  const [customerSig, setCustomerSig] = useState({ data: "", type: "draw" as "draw" | "type" });
  const [cobuyerSig, setCobuyerSig] = useState({ data: "", type: "draw" as "draw" | "type" });
  const [employeeSig, setEmployeeSig] = useState({ data: "", type: "draw" as "draw" | "type" });

  // QR modal
  const [qrOpen, setQrOpen] = useState(false);
  const [signingUrl, setSigningUrl] = useState("");

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

  const displayProducts = viewMode && loadedProducts ? loadedProducts : products;
  const installed = displayProducts?.filter((p) => p.badge_type === "installed") || [];
  const optional = displayProducts?.filter((p) => p.badge_type === "optional") || [];
  const installedTotal = installed.reduce((sum, p) => sum + p.price, 0);
  const acceptedOptional = optional.filter((p) => optionalSelections[p.id] === "accept");
  const optionalTotal = acceptedOptional.reduce((sum, p) => sum + p.price, 0);
  const grandTotal = installedTotal + optionalTotal;

  const handlePrint = () => window.print();

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
      pdf.save("Dealer-Addendum-Harte-Auto-Group.pdf");
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
      total_with_optional: grandTotal,
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
      total_with_optional: grandTotal,
      status: customerSig.data && employeeSig.data ? "signed" : "draft",
    };
    const { error } = await supabase.from("addendums").insert([payload]);
    setSaving(false);
    if (error) { toast.error(error.message); } else { toast.success("Addendum saved!"); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground animate-pulse">Loading products...</p></div>;

  return (
    <div className="min-h-screen bg-background py-4 px-2 md:px-4">
      {/* Controls */}
      <div className="max-w-[8.5in] mx-auto mb-3 flex flex-wrap gap-2 items-center no-print">
        {viewMode && (
          <button onClick={() => navigate("/")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
            ← New Addendum
          </button>
        )}
        {user && isAdmin && (
          <button onClick={() => navigate("/admin")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-gold text-navy tracking-[0.4px] hover:opacity-85">
            ⚙️ Admin Panel
          </button>
        )}
        {user && (
          <button onClick={() => navigate("/saved")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-blue text-primary-foreground tracking-[0.4px] hover:opacity-85">
            📋 Saved Addendums
          </button>
        )}
        {!user && (
          <button onClick={() => navigate("/login")} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
            🔑 Admin Login
          </button>
        )}
        {user && !viewMode && (
          <button onClick={handleSave} disabled={saving} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-teal text-primary-foreground tracking-[0.4px] hover:opacity-85 disabled:opacity-50">
            {saving ? "Saving..." : "💾 Save Addendum"}
          </button>
        )}
        {user && !viewMode && (
          <button onClick={handleSendToCustomer} disabled={saving} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-action text-primary-foreground tracking-[0.4px] hover:opacity-85 disabled:opacity-50">
            📱 Send to Customer
          </button>
        )}
        <button onClick={handlePrint} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85">
          🖨️ Print
        </button>
        <button onClick={handleDownloadPdf} disabled={generating} className="font-semibold text-[13px] px-5 py-2 rounded-md bg-navy text-primary-foreground tracking-[0.4px] hover:opacity-85 disabled:opacity-50">
          {generating ? "⏳ Generating…" : "📄 Download PDF"}
        </button>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={inkSaving} onChange={(e) => setInkSaving(e.target.checked)} />
          🖨️ Ink-Saving Mode
        </label>
      </div>
      <QRCodeModal open={qrOpen} signingUrl={signingUrl} onClose={() => setQrOpen(false)} />

      {/* Addendum Card */}
      <div ref={cardRef} className="addendum-card max-w-[8.5in] mx-auto bg-card shadow-lg rounded-lg overflow-hidden border border-border-custom">
        <AddendumHeader inkSaving={inkSaving} />
        <VehicleStrip vehicle={vehicle} onChange={setVehicle} inkSaving={inkSaving} />
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
            <span className="flex-1">Product Name & Description</span>
            <span className="w-24 text-right">Dealer Retail Price</span>
          </div>

          {/* Products */}
          {displayProducts?.map((p, i) => (
            <ProductRow
              key={p.id}
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
            />
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

          {/* Signature Section */}
          <div className="space-y-3 pt-2">
            <SignaturePad label="Customer Signature" subtitle="Buyer acknowledges receipt of this addendum" value={customerSig.data} type={customerSig.type} onChange={(data, type) => setCustomerSig({ data, type })} />
            <SignaturePad label="Co-Buyer Signature (if applicable)" subtitle="Co-Buyer acknowledges receipt" value={cobuyerSig.data} type={cobuyerSig.type} onChange={(data, type) => setCobuyerSig({ data, type })} />
            <SignaturePad label="Dealer Representative" subtitle="Sales / Finance representative signature & date" value={employeeSig.data} type={employeeSig.type} onChange={(data, type) => setEmployeeSig({ data, type })} />
          </div>

          <AddendumFooter inkSaving={inkSaving} />
        </div>
      </div>
    </div>
  );
};

export default Index;
