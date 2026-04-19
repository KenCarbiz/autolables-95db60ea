import { useState, useEffect, useRef } from "react";
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
  fetchGeoloc,
  hashPayload,
} from "@/lib/esign";
import { getStateRule, validateAddendum, summarizeFindings } from "@/lib/stateCompliance";
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
  // Funnel telemetry: fire opened once on load, started once on first
  // user interaction. Refs because we don't want React re-renders to
  // re-fire.
  const openedFiredRef = useRef(false);
  const startedFiredRef = useRef(false);

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
    fireFunnelEvent("signing_link_opened", openedFiredRef);
  };

  // Fires a single tenant-scoped audit event server-side via the
  // record_signing_event RPC. Silently swallows errors so a telemetry
  // blip never blocks the signer.
  const fireFunnelEvent = (
    event: "signing_link_opened" | "signing_link_started",
    ref: React.MutableRefObject<boolean>,
  ) => {
    if (ref.current || !token) return;
    ref.current = true;
    (supabase as any).rpc("record_signing_event", {
      _signing_token: token,
      _event: event,
      _details: {
        ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
    }).catch(() => { /* best-effort telemetry */ });
  };

  // Called from any onChange/onFocus in the form below. The ref
  // guards against spamming the RPC on every keystroke.
  const markStarted = () => fireFunnelEvent("signing_link_started", startedFiredRef);

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

    // Fetch compliance context in parallel with IP + geoloc. We do
    // this at signing time so every recorded signature carries:
    //  - the public IP seen at the moment of signature
    //  - a best-effort client geolocation (with user consent, null
    //    if denied or unavailable; never blocks submit)
    //  - the install-history snapshot of every product shown on the
    //    addendum (from prep_sign_offs), so later audit reviewers
    //    can prove the accessory was installed prior to sale and
    //    when
    //  - the state rule set that applied at the moment of signing,
    //    so if the statute changes later we can show what rule the
    //    disclosure was built against
    //  - a frozen ComplianceValidator report (PASS/WARN/FAIL)
    const consent = buildConsentRecord();
    const [customerIp, geoloc, prepSnapshot] = await Promise.all([
      fetchClientIp(),
      fetchGeoloc(),
      (async () => {
        try {
          const { data } = await (supabase as any)
            .from("prep_sign_offs")
            .select(
              "id,vin,accessories_installed,inspection_passed,inspection_form_type,foreman_name,signed_at,listing_unlocked"
            )
            .eq("vin", addendum.vehicle_vin)
            .eq("listing_unlocked", true)
            .order("signed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data || null;
        } catch {
          return null;
        }
      })(),
    ]);

    const stateCode = (addendum.vehicle_state || "").toString().toUpperCase() || null;
    const stateRule = stateCode ? getStateRule(stateCode) : null;

    const complianceFindings = validateAddendum({
      state: stateCode || "",
      vehiclePrice: addendum.vehicle_price,
      docFeeAmount: products.find((p) =>
        p.name.toLowerCase().includes("doc")
      )?.price,
      stickerText: products.map((p) => `${p.name} ${p.disclosure || ""}`).join(" "),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        badge_type: p.badge_type,
        disclosure: p.disclosure || undefined,
        separate_signoff: !!initials[p.id]?.trim(),
      })),
      spanishVersion: consent.language?.startsWith("es") || false,
      threeDayAck: sb766ThreeDayAck,
    });
    const complianceSummary = summarizeFindings(complianceFindings);

    // Canonical payload = everything that influenced the customer's
    // decision PLUS the dealer's compliance context. This is what the
    // SHA-256 hash covers.
    const canonicalPayload = {
      addendum_id: addendum.id,
      vehicle_vin: addendum.vehicle_vin,
      vehicle_ymm: addendum.vehicle_ymm,
      vehicle_state: stateCode,
      vehicle_price: addendum.vehicle_price ?? null,
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
      prep_sign_off_snapshot: prepSnapshot,
      state_rule_snapshot: stateRule,
      compliance_findings: complianceFindings,
      compliance_summary: complianceSummary,
      signing_location: geoloc,
      user_agent: consent.user_agent,
      customer_ip: customerIp,
      signed_at: new Date().toISOString(),
    };
    const contentHash = await hashPayload(canonicalPayload);

    // Unified signing path: record_customer_signing RPC validates the
    // token server-side, writes one addendum_signings row, mirrors
    // legacy addendums columns for backward compat, and emits the
    // audit_log event in one transaction. See migration 20260418110000.
    const acknowledgments = {
      warranty_ack: warrantyAck,
      sticker_match_ack: stickerMatchAck,
      sb766_three_day_return_ack: sb766ThreeDayAck || false,
      sb766_financing_disclosure: sb766Disclosure || null,
      initials,
      optional_selections: optionalSelections,
    };

    const { error } = await (supabase as any).rpc("record_customer_signing", {
      _signing_token: token!,
      _signer_type: "customer",
      _signer_name: customerName || null,
      _signer_email: null,
      _signer_phone: null,
      _signature_data: customerSig.data,
      _signature_type: customerSig.type,
      _ip_address: customerIp,
      _user_agent: consent.user_agent,
      _signing_location: geoloc as any,
      _content_hash: contentHash,
      _esign_consent: consent as any,
      _canonical_payload: canonicalPayload,
      _acknowledgments: acknowledgments,
      _delivery_mileage: deliveryMileage ? parseInt(deliveryMileage, 10) : null,
      _price_overrides: priceOverrides as any,
    });

    setSubmitting(false);
    if (error) {
      // Fall back to the legacy direct-update path if the RPC isn't
      // deployed yet (e.g. migration still propagating in Lovable).
      // eslint-disable-next-line no-console
      console.warn("record_customer_signing RPC failed, falling back", error);
      const { error: legacyErr } = await supabase
        .from("addendums")
        .update({
          initials: initials as any,
          optional_selections: optionalSelections as any,
          customer_name: customerName || null,
          customer_signature_data: customerSig.data,
          customer_signature_type: customerSig.type,
          customer_signed_at: new Date().toISOString(),
          status: "signed",
          content_hash: contentHash,
          esign_consent: consent as any,
          user_agent: consent.user_agent,
          delivery_mileage: deliveryMileage ? parseInt(deliveryMileage, 10) : null,
          sticker_match_ack: stickerMatchAck,
          warranty_ack: warrantyAck,
          customer_ip: customerIp,
          signing_location: geoloc as any,
          sb766_three_day_return_ack: sb766ThreeDayAck || null,
          sb766_financing_disclosure: sb766Disclosure as any,
          price_overrides: priceOverrides as any,
        } as any)
        .eq("signing_token", token!);
      if (legacyErr) {
        toast.error("Failed to submit. Please try again.");
        console.error(legacyErr);
        return;
      }
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500">Loading</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black font-display tracking-tight text-slate-950">Cannot open</h1>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const signedAt = new Date().toLocaleString();
    const dealerName = addendum?.dealer_snapshot?.name || "Your Dealership";
    const dealerPhone = addendum?.dealer_snapshot?.phone as string | undefined;
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-4 pt-10 pb-10 space-y-6">
          {/* Hero confirmation — one dark slab, no smiley checks,
              no floating chrome. Tesla's "Order placed" cadence. */}
          <div className="rounded-3xl bg-slate-950 text-white p-7 md:p-9 relative overflow-hidden">
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-400 font-semibold">Signed</p>
              <h1 className="mt-2 text-4xl md:text-5xl font-black font-display tracking-[-0.03em] leading-[0.95]">
                You're done.
              </h1>
              <p className="mt-3 text-[13px] text-white/75 leading-relaxed max-w-sm">
                {dealerName} has a hashed, time-stamped copy. A signed packet is on its way to your email.
              </p>
            </div>
          </div>

          {/* Receipt — mono-uppercase labels, tight meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">Vehicle</p>
              <p className="text-sm font-bold text-slate-950 mt-1">{addendum.vehicle_ymm || "Vehicle"}</p>
              {addendum.vehicle_vin && (
                <p className="text-[10px] font-mono text-slate-500">VIN · {addendum.vehicle_vin.slice(-8)}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">Signed by</p>
              <p className="text-sm font-bold text-slate-950 mt-1">{customerName || "—"}</p>
              <p className="text-[10px] font-mono text-slate-500">{signedAt}</p>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">Legally binding</p>
            <p className="text-[12px] text-slate-700 leading-relaxed mt-1">
              Every product, price, initial, and consent you reviewed is SHA-256 hashed and stored with your IP and device info — defensible under the federal E-SIGN Act and your state's UETA.
            </p>
          </div>

          {dealerPhone && (
            <a
              href={`tel:${dealerPhone}`}
              className="block w-full h-12 rounded-xl border border-slate-200 text-slate-950 text-sm font-bold inline-flex items-center justify-center hover:bg-slate-50"
            >
              Call {dealerName}
            </a>
          )}

          <p className="text-center text-[10px] font-mono uppercase tracking-wider text-slate-400 pt-2">
            You can close this page. A copy is on its way.
          </p>
        </div>
      </div>
    );
  }

  // Progress — compute completion percentage of the required fields so the
  // customer can see how much is left.
  const requiredProducts = products;
  const productsInitialedCount = requiredProducts.filter((p) => (initials[p.id] || "").trim()).length;
  const optionalSelectedCount = optional.filter((p) => !!optionalSelections[p.id]).length;
  const requirements = [
    { label: "E-SIGN consent",  done: esignConsent },
    { label: "Initials on all products", done: requiredProducts.length > 0 && productsInitialedCount === requiredProducts.length },
    { label: "Optional items chosen",    done: optional.length === 0 || optionalSelectedCount === optional.length },
    { label: "Warranty acknowledged",    done: warrantyAck },
    { label: "Delivery mileage",         done: deliveryMileage.trim().length > 0 },
    { label: "Sticker match acknowledged", done: stickerMatchAck },
    { label: "Signature",                done: !!customerSig.data },
  ];
  const doneCount = requirements.filter((r) => r.done).length;
  const progressPct = Math.round((doneCount / requirements.length) * 100);

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky progress — solid slate track, Tesla cadence. Label
          reads as a step count so the customer always knows where
          they are, not a decorative gradient. */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] font-semibold">
            <span className="text-slate-500">Sign &amp; initial</span>
            <span className="tabular-nums text-slate-950">
              {doneCount}/{requirements.length} · {progressPct}%
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-slate-950 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 pb-4">
        <div
          className="max-w-lg mx-auto space-y-6"
          onFocusCapture={markStarted}
          onTouchStartCapture={markStarted}
        >
          {/* Vehicle is the hero. No wrapper card, no drop shadow —
              just confident typography. */}
          <div>
            {addendum.vehicle_ymm && (
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-[-0.03em] leading-[0.95] text-slate-950">
                {addendum.vehicle_ymm}
              </h1>
            )}
            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 font-mono uppercase tracking-wider flex-wrap">
              <span>Dealer addendum</span>
              {addendum.vehicle_vin && <span>VIN · {addendum.vehicle_vin.slice(-8)}</span>}
            </div>
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

        {/* Submit — Tesla-cadence commitment verb. Solid slate, no
            chrome, no emoji. Once pressed, the addendum is hashed,
            archived, and delivered. */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-14 bg-slate-950 text-white rounded-xl font-display font-bold text-base tracking-tight disabled:opacity-50 hover:bg-slate-900 transition-colors"
        >
          {submitting ? "Signing…" : "Sign and finalize"}
        </button>
        <p className="text-center text-[10px] font-mono uppercase tracking-wider text-slate-500">
          By signing, you're hashed, archived, and legally bound.
        </p>
        </div>
      </div>
    </div>
  );
};

export default MobileSigning;
