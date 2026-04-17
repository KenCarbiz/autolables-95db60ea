import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "@/components/addendum/SignaturePad";
import { useEmailDistribution } from "@/hooks/useEmailDistribution";
import { useReviewRequest } from "@/hooks/useReviewRequest";
import { toast } from "sonner";
import {
  ESIGN_CONSENT_TEXT,
  buildConsentRecord,
  fetchClientIp,
  hashPayload,
} from "@/lib/esign";
import { isSb766Applicable, type FinancingDisclosure } from "@/lib/sb766";
import SB766DisclosurePanel from "@/components/addendum/SB766DisclosurePanel";

interface ProductSnapshot {
  id: string;
  name: string;
  subtitle: string | null;
  warranty: string | null;
  badge_type: string;
  price: number;
  price_label: string | null;
  disclosure: string | null;
}

const MobileSigning = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [addendum, setAddendum] = useState<any>(null);
  const [error, setError] = useState("");

  const [initials, setInitials] = useState<Record<string, string>>({});
  const [optionalSelections, setOptionalSelections] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerSig, setCustomerSig] = useState({ data: "", type: "draw" as "draw" | "type" });
  const [bulkInitials, setBulkInitials] = useState("");
  const { sendPacket } = useEmailDistribution();
  const { queueReviewRequest } = useReviewRequest();

  // FTC Buyers Guide warranty acknowledgment
  const [warrantyAck, setWarrantyAck] = useState(false);
  const [deliveryMileage, setDeliveryMileage] = useState("");
  // Addendum/sticker matching acknowledgment
  const [stickerMatchAck, setStickerMatchAck] = useState(false);
  // Price overrides — sales manager can discount accessories (NOT doc fee)
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  // E-SIGN Act consent — required before any signature can be captured
  const [esignConsent, setEsignConsent] = useState(false);
  const [showFullConsent, setShowFullConsent] = useState(false);
  // CA SB 766 (eff 10/1/2026) — 3-day return ack + financing disclosure
  const [sb766ThreeDayAck, setSb766ThreeDayAck] = useState(false);
  const [sb766Disclosure, setSb766Disclosure] = useState<FinancingDisclosure | null>(null);

  useEffect(() => {
    if (!token) return;
    loadAddendum();
  }, [token]);

  const loadAddendum = async () => {
    const { data, error } = await supabase.rpc("get_addendum_by_token", { _token: token });
    if (error || !data || data.length === 0) {
      setError("Invalid or expired signing link.");
      setLoading(false);
      return;
    }
    const doc = data[0];
    if (doc.status === "signed") {
      setError("This addendum has already been signed.");
      setLoading(false);
      return;
    }
    setAddendum(doc);
    setInitials((doc.initials as Record<string, string>) || {});
    setOptionalSelections((doc.optional_selections as Record<string, string>) || {});
    setLoading(false);
  };

  const products: ProductSnapshot[] = addendum?.products_snapshot || [];
  const installed = products.filter((p) => p.badge_type === "installed");
  const optional = products.filter((p) => p.badge_type === "optional");

  const handleFillAll = () => {
    if (!bulkInitials.trim()) return;
    const filled: Record<string, string> = {};
    products.forEach((p) => { filled[p.id] = bulkInitials.toUpperCase(); });
    setInitials(filled);
  };

  const handleSubmit = async () => {
    if (!esignConsent) {
      toast.error("Please accept the Electronic Records Disclosure before signing.");
      return;
    }
    const missingInitials = products.filter((p) => !initials[p.id]?.trim());
    if (missingInitials.length > 0) {
      toast.error(`Please initial all ${missingInitials.length} product(s).`);
      return;
    }
    const missingSelections = optional.filter((p) => !optionalSelections[p.id]);
    if (missingSelections.length > 0) {
      toast.error(`Please accept or decline all optional products.`);
      return;
    }
    if (!warrantyAck) {
      toast.error("Please acknowledge the warranty status.");
      return;
    }
    if (!deliveryMileage.trim()) {
      toast.error("Please confirm mileage at delivery.");
      return;
    }
    if (!stickerMatchAck) {
      toast.error("Please acknowledge the window sticker matches this addendum.");
      return;
    }
    if (isSb766Applicable(addendum?.vehicle_state, addendum?.vehicle_price) && !sb766ThreeDayAck) {
      toast.error("Please acknowledge the California 3-Day Right to Cancel notice.");
      return;
    }
    if (!customerSig.data) {
      toast.error("Please provide your signature.");
      return;
    }

    setSubmitting(true);

    // Build canonical payload + tamper-evident hash. Anything that
    // influences the customer's decision is included so we can prove
    // what they saw at the moment of signature.
    const consent = buildConsentRecord();
    const canonicalPayload = {
      addendum_id: addendum.id,
      vehicle_vin: addendum.vehicle_vin,
      vehicle_ymm: addendum.vehicle_ymm,
      products_snapshot: addendum.products_snapshot,
      price_overrides: priceOverrides,
      initials,
      optional_selections: optionalSelections,
      customer_name: customerName,
      warranty_ack: warrantyAck,
      sticker_match_ack: stickerMatchAck,
      delivery_mileage: deliveryMileage,
      esign_consent_version: consent.version,
      sb766_three_day_return_ack: sb766ThreeDayAck || null,
      sb766_financing_disclosure: sb766Disclosure,
      signed_at: new Date().toISOString(),
    };
    const contentHash = await hashPayload(canonicalPayload);
    const customerIp = await fetchClientIp();

    const signedAt = new Date().toISOString();
    const { error } = await supabase
      .from("addendums")
      .update({
        initials: initials as any,
        optional_selections: optionalSelections as any,
        customer_name: customerName || null,
        customer_signature_data: customerSig.data,
        customer_signature_type: customerSig.type,
        customer_signed_at: signedAt,
        status: "signed",
        // Hardening columns (see migration 20260417_platform_expansion.sql)
        content_hash: contentHash,
        esign_consent: consent as any,
        user_agent: consent.user_agent,
        delivery_mileage: deliveryMileage ? parseInt(deliveryMileage, 10) : null,
        sticker_match_ack: stickerMatchAck,
        warranty_ack: warrantyAck,
        customer_ip: customerIp,
        sb766_three_day_return_ack: sb766ThreeDayAck || null,
        sb766_financing_disclosure: sb766Disclosure as any,
        price_overrides: priceOverrides as any,
      } as any)
      .eq("signing_token", token!);

    // Append to the server audit log (anon RLS permits this exact action).
    (supabase as any)
      .from("audit_log")
      .insert({
        action: "addendum_signed",
        entity_type: "addendum",
        entity_id: addendum.id,
        details: {
          vin: addendum.vehicle_vin,
          ymm: addendum.vehicle_ymm,
          token: token,
          customer_name: customerName,
          hash: contentHash,
          consent_version: consent.version,
        },
        ip_address: customerIp,
        user_agent: consent.user_agent,
        content_hash: contentHash,
      })
      .then(() => undefined, () => undefined);

    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit. Please try again.");
      console.error(error);
    } else {
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Cannot Open</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Thank You!</h1>
          <p className="text-muted-foreground">Your signature has been recorded. You may close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <h1 className="text-xl font-bold font-barlow-condensed text-foreground">Dealer Addendum — Sign & Initial</h1>
          {addendum.vehicle_ymm && <p className="text-sm font-semibold text-foreground mt-1">{addendum.vehicle_ymm}</p>}
          {addendum.vehicle_vin && <p className="text-xs text-muted-foreground">VIN: {addendum.vehicle_vin}</p>}
        </div>

        {/* Fill All Initials */}
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Quick Fill — Your Initials</p>
          <div className="flex gap-2">
            <input
              value={bulkInitials}
              onChange={(e) => setBulkInitials(e.target.value.toUpperCase())}
              placeholder="e.g. JD"
              className="flex-1 h-12 border-2 border-border rounded-lg px-4 text-lg font-bold text-center uppercase bg-background text-foreground placeholder:text-muted-foreground/40"
            />
            <button onClick={handleFillAll} className="px-5 h-12 bg-teal text-primary-foreground rounded-lg font-bold text-sm">
              Fill All
            </button>
          </div>
        </div>

        {/* Products */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold font-barlow-condensed text-foreground">Products & Acknowledgment</h2>

          {installed.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold bg-navy text-primary-foreground px-1.5 py-0.5 rounded">Pre-Installed</span>
                  <p className="text-sm font-semibold text-foreground mt-1">{p.name}</p>
                  {p.warranty && <p className="text-[10px] text-muted-foreground">{p.warranty}</p>}
                </div>
                <p className="text-sm font-bold text-foreground">${p.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground">INITIALS:</span>
                <input
                  value={initials[p.id] || ""}
                  onChange={(e) => setInitials((prev) => ({ ...prev, [p.id]: e.target.value.toUpperCase() }))}
                  placeholder="____"
                  className={`w-20 h-10 border-2 rounded-lg px-2 text-base font-bold text-center uppercase bg-background text-foreground ${initials[p.id]?.trim() ? "border-teal" : "border-action"}`}
                />
              </div>
            </div>
          ))}

          {optional.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-bold text-muted-foreground mb-2">▼ Optional Items — Accept or Decline</p>
            </div>
          )}

          {optional.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold bg-gold text-navy px-1.5 py-0.5 rounded">Optional</span>
                  <p className="text-sm font-semibold text-foreground mt-1">{p.name}</p>
                </div>
                <p className="text-sm font-bold text-foreground">${p.price.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOptionalSelections((prev) => ({ ...prev, [p.id]: "accept" }))}
                  className={`flex-1 h-10 rounded-lg text-sm font-bold border-2 ${optionalSelections[p.id] === "accept" ? "border-teal bg-teal text-primary-foreground" : "border-border text-foreground"}`}
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => setOptionalSelections((prev) => ({ ...prev, [p.id]: "decline" }))}
                  className={`flex-1 h-10 rounded-lg text-sm font-bold border-2 ${optionalSelections[p.id] === "decline" ? "border-destructive bg-destructive text-primary-foreground" : "border-border text-foreground"}`}
                >
                  ✗ Decline
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground">INITIALS:</span>
                <input
                  value={initials[p.id] || ""}
                  onChange={(e) => setInitials((prev) => ({ ...prev, [p.id]: e.target.value.toUpperCase() }))}
                  placeholder="____"
                  className={`w-20 h-10 border-2 rounded-lg px-2 text-base font-bold text-center uppercase bg-background text-foreground ${initials[p.id]?.trim() ? "border-teal" : "border-action"}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Price Confirmation — sales manager can discount accessories */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-barlow-condensed text-foreground">Confirm Pricing</h2>
            <button
              onClick={() => setShowPriceEdit(!showPriceEdit)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded ${showPriceEdit ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {showPriceEdit ? "Done Editing" : "Adjust Prices"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Review and confirm all pricing before the customer signs. Accessories may be discounted by a sales manager.
          </p>

          <div className="space-y-2">
            {products.map(p => {
              const originalPrice = p.price;
              const currentPrice = priceOverrides[p.id] ?? originalPrice;
              const isDiscounted = currentPrice < originalPrice;
              const isDocFee = p.name.toLowerCase().includes("doc") || p.name.toLowerCase().includes("conveyance") || p.name.toLowerCase().includes("processing fee") || p.name.toLowerCase().includes("documentation");

              return (
                <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${isDiscounted ? "border-emerald-200 bg-emerald-50/50" : "border-border"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      p.badge_type === "installed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.badge_type === "installed" ? "Installed" : "Optional"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {showPriceEdit && !isDocFee ? (
                      <div className="flex items-center gap-1">
                        {isDiscounted && (
                          <span className="text-xs text-muted-foreground line-through tabular-nums">${originalPrice.toFixed(2)}</span>
                        )}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={currentPrice}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0 && val <= originalPrice) {
                                setPriceOverrides(prev => ({ ...prev, [p.id]: val }));
                              }
                            }}
                            className="w-24 h-9 pl-5 pr-2 rounded-md border border-border bg-background text-sm font-semibold text-right tabular-nums outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        {isDiscounted && <p className="text-[10px] text-muted-foreground line-through tabular-nums">${originalPrice.toFixed(2)}</p>}
                        <p className={`text-sm font-bold tabular-nums ${isDiscounted ? "text-emerald-700" : "text-foreground"}`}>
                          ${currentPrice.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {isDocFee && showPriceEdit && (
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground tabular-nums">${currentPrice.toFixed(2)}</p>
                        <p className="text-[8px] text-destructive font-semibold">Cannot discount</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(priceOverrides).length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs text-emerald-800 font-medium">
                Price adjustments applied. Original prices and discounts will be recorded in the compliance audit trail.
              </p>
            </div>
          )}
        </div>

        {/* FTC Warranty Acknowledgment + Mileage at Delivery */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold font-barlow-condensed text-foreground">FTC Warranty Acknowledgment</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Federal law requires that you acknowledge the warranty status of this vehicle as disclosed
            on the FTC Buyers Guide displayed on the vehicle, and confirm the odometer mileage at delivery.
          </p>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Mileage at Time of Delivery
            </label>
            <input
              value={deliveryMileage}
              onChange={(e) => setDeliveryMileage(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 45230"
              inputMode="numeric"
              className={`w-full h-12 border-2 rounded-lg px-4 text-base font-bold text-center bg-background text-foreground ${deliveryMileage.trim() ? "border-teal" : "border-action"}`}
            />
            {deliveryMileage && (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {parseInt(deliveryMileage).toLocaleString()} miles
              </p>
            )}
          </div>

          <button
            onClick={() => setWarrantyAck(!warrantyAck)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
              warrantyAck ? "border-teal bg-teal/5" : "border-border"
            }`}
          >
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
              warrantyAck ? "border-teal bg-teal text-white" : "border-border"
            }`}>
              {warrantyAck && <span className="text-sm font-bold">✓</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">I acknowledge the warranty status</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                I have reviewed the FTC Buyers Guide on this vehicle. I understand the warranty
                status (As-Is, Implied, or Warranty) as disclosed. I confirm the mileage reading
                above is accurate at the time of delivery.
              </p>
            </div>
          </button>
        </div>

        {/* Window Sticker / Addendum Match Acknowledgment */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold font-barlow-condensed text-foreground">Addendum Acknowledgment</h2>
          <button
            onClick={() => setStickerMatchAck(!stickerMatchAck)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
              stickerMatchAck ? "border-teal bg-teal/5" : "border-border"
            }`}
          >
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
              stickerMatchAck ? "border-teal bg-teal text-white" : "border-border"
            }`}>
              {stickerMatchAck && <span className="text-sm font-bold">✓</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">I confirm the sticker matches this addendum</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                I acknowledge that: (1) this addendum matches the window sticker on the vehicle;
                (2) I have been given time to review both documents; (3) my initials and signature
                below constitute acceptance of the products and pricing as disclosed; (4) I understand
                that optional items can be declined with no impact on my purchase or financing.
              </p>
            </div>
          </button>
        </div>

        {/* CA SB 766 — only renders for California vehicles under $50k after 10/1/2026 */}
        <SB766DisclosurePanel
          vehicleState={addendum?.vehicle_state}
          vehiclePrice={addendum?.vehicle_price}
          financingInput={addendum?.financing_input}
          threeDayAck={sb766ThreeDayAck}
          onThreeDayAck={setSb766ThreeDayAck}
          onDisclosureChange={setSb766Disclosure}
        />

        {/* E-SIGN Act consent — REQUIRED before signature */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold font-barlow-condensed text-foreground">
            Electronic Records & Signatures Consent
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Federal law (E-SIGN Act, 15 U.S.C. §7001) and your state's UETA
            require that you consent before conducting this transaction electronically.
          </p>

          {!showFullConsent ? (
            <button
              onClick={() => setShowFullConsent(true)}
              className="text-xs font-semibold text-[#1E90FF] hover:underline"
            >
              Read the full disclosure →
            </button>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg bg-muted/40 border border-border p-3 text-[11px] text-foreground whitespace-pre-line leading-relaxed">
              {ESIGN_CONSENT_TEXT}
            </div>
          )}

          <button
            onClick={() => setEsignConsent(!esignConsent)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
              esignConsent ? "border-teal bg-teal/5" : "border-border"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                esignConsent ? "border-teal bg-teal text-white" : "border-border"
              }`}
            >
              {esignConsent && <span className="text-sm font-bold">✓</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                I consent to use electronic records and signatures for this transaction
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                I understand I can request a paper copy at no charge, I can withdraw
                consent at any time before signing, and my electronic signature is
                legally equivalent to a handwritten one under ESIGN/UETA.
              </p>
            </div>
          </button>
        </div>

        {/* Signature */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold font-barlow-condensed text-foreground">Your Signature</h2>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Full name (printed)"
            className="w-full h-12 border-2 border-border rounded-lg px-4 text-base bg-background text-foreground placeholder:text-muted-foreground/40"
          />
          <SignaturePad
            label="Customer Signature"
            subtitle="Sign above to acknowledge receipt"
            onChange={(data, type) => setCustomerSig({ data, type })}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-14 bg-teal text-primary-foreground rounded-xl font-bold text-lg disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "✅ Submit Signature"}
        </button>
      </div>
    </div>
  );
};

export default MobileSigning;
