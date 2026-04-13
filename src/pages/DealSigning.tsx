import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "@/components/addendum/SignaturePad";
import { toast } from "sonner";
import {
  Car,
  FileText,
  Shield,
  ClipboardCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { VehicleFile, AttachedDocument } from "@/types/vehicleFile";

const VEHICLE_FILES_KEY = "vehicle_files";

const DealSigning = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [vehicleFile, setVehicleFile] = useState<VehicleFile | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Customer fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerSig, setCustomerSig] = useState({ data: "", type: "draw" as "draw" | "type" });

  // Co-buyer fields
  const [showCobuyer, setShowCobuyer] = useState(false);
  const [cobuyerName, setCobuyerName] = useState("");
  const [cobuyerPhone, setCobuyerPhone] = useState("");
  const [cobuyerSig, setCobuyerSig] = useState({ data: "", type: "draw" as "draw" | "type" });

  // Dealer / F&I manager fields
  const [dealerName, setDealerName] = useState("");
  const [dealerSig, setDealerSig] = useState({ data: "", type: "draw" as "draw" | "type" });

  // Acknowledgments
  const [ackBuyersGuide, setAckBuyersGuide] = useState(false);
  const [ackK208, setAckK208] = useState(false);
  const [ackSticker, setAckSticker] = useState(false);
  const [deliveryMileage, setDeliveryMileage] = useState("");

  useEffect(() => {
    if (!token) { setError("No deal token provided."); setLoading(false); return; }
    loadDeal();
  }, [token]);

  const loadDeal = () => {
    try {
      const all: VehicleFile[] = JSON.parse(localStorage.getItem(VEHICLE_FILES_KEY) || "[]");
      const file = all.find(f => f.deal_qr_token === token);
      if (!file) {
        setError("Deal not found. This link may be invalid or expired.");
        setLoading(false);
        return;
      }
      if (file.deal_status === "signed" || file.deal_status === "delivered") {
        setError("This deal has already been signed.");
        setLoading(false);
        return;
      }
      setVehicleFile(file);
      // Pre-fill customer info if already on file
      if (file.customer_name) setCustomerName(file.customer_name);
      if (file.customer_phone) setCustomerPhone(file.customer_phone);
      if (file.customer_email) setCustomerEmail(file.customer_email);
      if (file.cobuyer_name) {
        setCobuyerName(file.cobuyer_name);
        setShowCobuyer(true);
      }
    } catch {
      setError("Failed to load deal data.");
    }
    setLoading(false);
  };

  const hasK208 = vehicleFile?.attached_documents?.some(d => d.type === "k208") || false;
  const hasBuyersGuide = vehicleFile?.attached_documents?.some(d => d.type === "ftc_buyers_guide") || false;
  const buyersGuideDoc = vehicleFile?.attached_documents?.find(d => d.type === "ftc_buyers_guide");
  const k208Doc = vehicleFile?.attached_documents?.find(d => d.type === "k208");

  const handleSubmit = () => {
    if (!customerName.trim()) { toast.error("Customer name is required."); return; }
    if (!customerSig.data) { toast.error("Customer signature is required."); return; }
    if (showCobuyer && cobuyerName.trim() && !cobuyerSig.data) {
      toast.error("Co-buyer signature is required when co-buyer is added.");
      return;
    }
    if (!dealerName.trim()) { toast.error("Dealer/F&I manager name is required."); return; }
    if (!dealerSig.data) { toast.error("Dealer/F&I manager signature is required."); return; }
    if (hasBuyersGuide && !ackBuyersGuide) { toast.error("Please acknowledge the FTC Buyers Guide."); return; }
    if (hasK208 && !ackK208) { toast.error("Please acknowledge the K-208 inspection form."); return; }
    if (!ackSticker) { toast.error("Please acknowledge the window sticker/addendum."); return; }
    if (!deliveryMileage.trim()) { toast.error("Please enter mileage at delivery."); return; }

    setSubmitting(true);

    try {
      const all: VehicleFile[] = JSON.parse(localStorage.getItem(VEHICLE_FILES_KEY) || "[]");
      const idx = all.findIndex(f => f.deal_qr_token === token);
      if (idx === -1) { toast.error("Deal not found."); setSubmitting(false); return; }

      const now = new Date().toISOString();
      const signingRecord = {
        id: crypto.randomUUID(),
        sticker_id: "deal_signing",
        customer_name: customerName.trim(),
        customer_initials: {},
        customer_selections: {},
        customer_signature_data: customerSig.data,
        customer_signature_type: customerSig.type,
        cobuyer_name: showCobuyer ? cobuyerName.trim() : undefined,
        cobuyer_signature_data: showCobuyer ? cobuyerSig.data : undefined,
        employee_name: dealerName.trim(),
        employee_signature_data: dealerSig.data,
        signed_at: now,
        customer_ip: "",
        device_info: navigator.userAgent,
        delivery_mileage: deliveryMileage,
        ack_buyers_guide: ackBuyersGuide,
        ack_k208: ackK208,
        ack_sticker: ackSticker,
      };

      all[idx] = {
        ...all[idx],
        deal_status: "signed",
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
        cobuyer_name: showCobuyer ? cobuyerName.trim() : "",
        cobuyer_phone: showCobuyer ? cobuyerPhone.trim() : "",
        cobuyer_email: "",
        signings: [...(all[idx].signings || []), signingRecord],
        updated_at: now,
      };

      localStorage.setItem(VEHICLE_FILES_KEY, JSON.stringify(all));
      setSubmitted(true);
      toast.success("Deal signed successfully!");
    } catch (err) {
      toast.error("Failed to save signatures.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading deal...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Cannot Open Deal</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Deal Signed!</h1>
          <p className="text-sm text-muted-foreground mb-1">
            {vehicleFile?.year} {vehicleFile?.make} {vehicleFile?.model} {vehicleFile?.trim}
          </p>
          <p className="text-xs text-muted-foreground">
            VIN: {vehicleFile?.vin} | Stock #{vehicleFile?.stock_number}
          </p>
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left space-y-2">
            <p className="text-xs font-semibold text-emerald-800">Signed by:</p>
            <p className="text-sm text-emerald-900">Customer: {customerName}</p>
            {showCobuyer && cobuyerName && <p className="text-sm text-emerald-900">Co-Buyer: {cobuyerName}</p>}
            <p className="text-sm text-emerald-900">Dealer: {dealerName}</p>
            <p className="text-xs text-emerald-700 mt-2">Delivery mileage: {parseInt(deliveryMileage).toLocaleString()} miles</p>
          </div>
          <p className="text-xs text-muted-foreground mt-6">You may close this page. A copy has been saved to the deal file.</p>
        </div>
      </div>
    );
  }

  // ── Main signing form ──
  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 topbar-navy text-white">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <p className="text-sm font-semibold">Deal Signing</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Vehicle Info */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-primary text-primary-foreground px-5 py-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              <div>
                <p className="text-lg font-bold tracking-tight">
                  {vehicleFile?.year} {vehicleFile?.make} {vehicleFile?.model}
                </p>
                {vehicleFile?.trim && <p className="text-xs text-primary-foreground/70">{vehicleFile.trim}</p>}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VIN</span>
              <span className="font-mono font-semibold text-foreground">{vehicleFile?.vin}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stock #</span>
              <span className="font-semibold text-foreground">{vehicleFile?.stock_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Condition</span>
              <span className="font-semibold text-foreground capitalize">{vehicleFile?.condition}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mileage (at intake)</span>
              <span className="font-semibold text-foreground">{(vehicleFile?.mileage || 0).toLocaleString()} mi</span>
            </div>
          </div>
        </div>

        {/* Attached Documents */}
        {(hasBuyersGuide || hasK208) && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Compliance Documents on File</h3>
            {hasBuyersGuide && buyersGuideDoc && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">FTC Used Car Buyers Guide</p>
                  <p className="text-xs text-blue-700 capitalize">
                    {buyersGuideDoc.data?.guide_type === "as-is" ? "As-Is / No Warranty" : buyersGuideDoc.data?.guide_type === "implied" ? "Implied Warranty" : "Warranty"}
                  </p>
                </div>
              </div>
            )}
            {hasK208 && k208Doc && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <ClipboardCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">CT K-208 Vehicle Inspection</p>
                  <p className="text-xs text-amber-700">Required per CGS 14-62(g)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delivery Mileage */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Delivery Mileage</h3>
          <p className="text-xs text-muted-foreground">Confirm the odometer reading at time of delivery.</p>
          <input
            value={deliveryMileage}
            onChange={(e) => setDeliveryMileage(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 45230"
            inputMode="numeric"
            className={`w-full h-12 border-2 rounded-lg px-4 text-base font-bold text-center bg-background text-foreground ${
              deliveryMileage.trim() ? "border-emerald-300" : "border-border"
            }`}
          />
        </div>

        {/* Acknowledgments */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Acknowledgments</h3>

          {hasBuyersGuide && (
            <button
              onClick={() => setAckBuyersGuide(!ackBuyersGuide)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                ackBuyersGuide ? "border-emerald-300 bg-emerald-50/50" : "border-border"
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                ackBuyersGuide ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
              }`}>
                {ackBuyersGuide && <span className="text-xs font-bold">&#10003;</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">FTC Buyers Guide Acknowledged</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  I have reviewed the FTC Buyers Guide on this vehicle and understand the warranty status as disclosed.
                </p>
              </div>
            </button>
          )}

          {hasK208 && (
            <button
              onClick={() => setAckK208(!ackK208)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                ackK208 ? "border-emerald-300 bg-emerald-50/50" : "border-border"
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                ackK208 ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
              }`}>
                {ackK208 && <span className="text-xs font-bold">&#10003;</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">CT K-208 Inspection Acknowledged</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  I acknowledge that I have received a copy of the completed vehicle safety inspection form as required by Connecticut law.
                </p>
              </div>
            </button>
          )}

          <button
            onClick={() => setAckSticker(!ackSticker)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
              ackSticker ? "border-emerald-300 bg-emerald-50/50" : "border-border"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
              ackSticker ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
            }`}>
              {ackSticker && <span className="text-xs font-bold">&#10003;</span>}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Window Sticker / Addendum Confirmed</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                I confirm that the window sticker and any addendum on this vehicle match what has been disclosed
                to me, and I have had time to review all documents before signing.
              </p>
            </div>
          </button>
        </div>

        {/* Customer Section */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Customer (Buyer)
          </h3>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Full legal name *"
            className="w-full h-12 border-2 border-border rounded-lg px-4 text-base bg-background text-foreground placeholder:text-muted-foreground/40"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone"
              inputMode="tel"
              className="h-11 border-2 border-border rounded-lg px-4 text-sm bg-background text-foreground placeholder:text-muted-foreground/40"
            />
            <input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Email"
              inputMode="email"
              className="h-11 border-2 border-border rounded-lg px-4 text-sm bg-background text-foreground placeholder:text-muted-foreground/40"
            />
          </div>
          <SignaturePad
            label="Customer Signature"
            subtitle="Sign above to acknowledge receipt of all documents"
            onChange={(data, type) => setCustomerSig({ data, type })}
          />
        </div>

        {/* Co-Buyer Toggle + Section */}
        {!showCobuyer ? (
          <button
            onClick={() => setShowCobuyer(true)}
            className="w-full h-12 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            Add Co-Buyer
          </button>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Co-Buyer
              </h3>
              <button
                onClick={() => { setShowCobuyer(false); setCobuyerName(""); setCobuyerPhone(""); setCobuyerSig({ data: "", type: "draw" }); }}
                className="text-xs text-destructive font-semibold hover:underline"
              >
                Remove
              </button>
            </div>
            <input
              value={cobuyerName}
              onChange={(e) => setCobuyerName(e.target.value)}
              placeholder="Co-buyer full legal name"
              className="w-full h-12 border-2 border-border rounded-lg px-4 text-base bg-background text-foreground placeholder:text-muted-foreground/40"
            />
            <input
              value={cobuyerPhone}
              onChange={(e) => setCobuyerPhone(e.target.value)}
              placeholder="Co-buyer phone"
              inputMode="tel"
              className="w-full h-11 border-2 border-border rounded-lg px-4 text-sm bg-background text-foreground placeholder:text-muted-foreground/40"
            />
            <SignaturePad
              label="Co-Buyer Signature"
              subtitle="Co-buyer sign above to acknowledge"
              onChange={(data, type) => setCobuyerSig({ data, type })}
            />
          </div>
        )}

        {/* Dealer / F&I Manager Section */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Dealer / F&I Manager
          </h3>
          <input
            value={dealerName}
            onChange={(e) => setDealerName(e.target.value)}
            placeholder="Salesperson or F&I manager name *"
            className="w-full h-12 border-2 border-border rounded-lg px-4 text-base bg-background text-foreground placeholder:text-muted-foreground/40"
          />
          <SignaturePad
            label="Dealer Signature"
            subtitle="Dealer representative sign above"
            onChange={(data, type) => setDealerSig({ data, type })}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-14 rounded-xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Sign & Complete Deal
            </>
          )}
        </button>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
          By signing above, all parties acknowledge receipt and review of the vehicle documents,
          compliance forms, and pricing as disclosed. Signatures are timestamped and recorded
          in the deal file for audit compliance.
        </p>
      </div>
    </div>
  );
};

export default DealSigning;
