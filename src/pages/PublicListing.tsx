import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle2,
  Package,
  DollarSign,
  Play,
  Phone,
  Share2,
  Printer,
  QrCode as QrIcon,
  Sparkles,
  Clock,
  Award,
  MessageSquare,
  X,
  Send,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/brand/Logo";
import { QRCodeSVG } from "qrcode.react";
import { useVehicleListing, type VehicleListing } from "@/hooks/useVehicleListing";
import { supabase } from "@/integrations/supabase/client";

// ──────────────────────────────────────────────────────────────
// PublicListing — the shopper-facing window sticker. Mounted at
// /v/:slug. This is what a customer sees when they scan the QR
// on the printed addendum, or open the link a dealer embeds on
// their VDP. Must be Supabase-backed, SEO-friendly, ADA-friendly,
// and signed-in-unnecessary.
// ──────────────────────────────────────────────────────────────

const PublicListing = () => {
  const { slug } = useParams<{ slug: string }>();
  const { publicUrl } = useVehicleListing("");
  const [listing, setListing] = useState<VehicleListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      // Rate-limited edge function handles view-count, audit event,
      // and abusive-scraper throttling server-side. Clients no longer
      // talk to the RPC directly.
      const { data, error } = await supabase.functions.invoke("public-listing-view", {
        body: { slug },
      });
      if (!mounted) return;
      if (error) {
        const status = (error as unknown as { context?: { status?: number } })?.context?.status;
        if (status === 429) setRateLimited(true);
        else setNotFound(true);
        setLoading(false);
        return;
      }
      const row = (data as { listing?: VehicleListing } | null)?.listing ?? null;
      if (!row) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setListing(row);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1E90FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading vehicle details…</p>
        </div>
      </div>
    );
  }

  if (rateLimited) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center max-w-md">
          <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Slow Down a Moment</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We've seen a lot of traffic from your network in the last few minutes.
            Please wait a few minutes and refresh.
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center max-w-md">
          <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Vehicle Not Available</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This listing may have been sold, unpublished, or the link is incorrect.
          </p>
          <p className="text-[11px] text-muted-foreground mt-3 font-mono">{slug}</p>
        </div>
      </div>
    );
  }

  const dealer = listing.dealer_snapshot || {};
  const sticker = listing.sticker_snapshot || {};
  const installed = (sticker.products_snapshot || []).filter((p) => p.badge_type === "installed");
  const optional = (sticker.products_snapshot || []).filter((p) => p.badge_type === "optional");
  const totals = sticker.totals || {};
  const viewUrl = publicUrl(listing.slug);

  const handleShare = async () => {
    const data = {
      title: `${listing.ymm || "Vehicle"} — ${dealer.name || "AutoLabels"}`,
      text: `Take a look at this ${listing.ymm || "vehicle"}`,
      url: viewUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(viewUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-white/90 backdrop-blur-sm border-b border-border sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {dealer.logo_url ? (
              <img src={dealer.logo_url} alt={dealer.name || "Dealer"} className="h-8 w-auto" />
            ) : (
              <Logo variant="full" size={28} />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{dealer.name || "Your Dealership"}</p>
              {dealer.phone && <p className="text-[10px] text-muted-foreground truncate">{dealer.phone}</p>}
            </div>
          </div>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-white text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            aria-label="Share vehicle"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Hero */}
        <section
          className="rounded-2xl border border-border overflow-hidden shadow-premium"
          style={{ background: "linear-gradient(135deg, #0B2041 0%, #1E90FF 100%)" }}
        >
          <div className="text-white p-6">
            <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">
              {listing.condition === "new"
                ? "New Vehicle"
                : listing.condition === "cpo"
                  ? "Certified Pre-Owned"
                  : "Pre-Owned Vehicle"}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{listing.ymm || "Vehicle"}</h1>
            {listing.trim && <p className="text-sm text-white/80 mt-0.5">{listing.trim}</p>}
            <div className="mt-3 flex items-center gap-4 text-[11px] text-white/70 flex-wrap">
              <span>VIN: {listing.vin}</span>
              {listing.mileage != null && <span>{listing.mileage.toLocaleString()} miles</span>}
              {dealer.city && dealer.state && (
                <span>
                  {dealer.city}, {dealer.state}
                </span>
              )}
            </div>
          </div>

          {/* Pricing */}
          {(typeof listing.price === "number" || typeof totals.final_price === "number") && (
            <div className="p-5 bg-white border-t border-border flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {listing.condition === "new" ? "Suggested Retail" : "Asking Price"}
                </p>
                <p className="text-3xl font-black tracking-tight font-display tabular-nums text-foreground">
                  ${(listing.price ?? totals.final_price ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="text-right text-[10px] text-muted-foreground space-y-0.5">
                {typeof totals.base_price === "number" && (
                  <p>Base ${totals.base_price.toLocaleString()}</p>
                )}
                {typeof totals.accessories_total === "number" && (
                  <p>Accessories ${totals.accessories_total.toLocaleString()}</p>
                )}
                {typeof totals.doc_fee === "number" && totals.doc_fee > 0 && (
                  <p>Doc fee ${totals.doc_fee}</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Prep verified banner */}
        {listing.prep_status?.foreman_signed_at && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-900">Prep & install verified</p>
              <p className="text-[10px] text-emerald-800/80">
                All accessories on this vehicle were installed and photographed before it was listed for sale.
              </p>
            </div>
          </div>
        )}

        {/* Videos */}
        {listing.videos?.length > 0 && (
          <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <Play className="w-4 h-4 text-[#1E90FF]" />
              <h2 className="text-sm font-semibold text-foreground">Video Walkaround</h2>
            </div>
            <div className="grid gap-3">
              {listing.videos.map((v) => (
                <a
                  key={v.id}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-muted aspect-video flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E90FF]">
                    <Play className="w-4 h-4" /> Watch {v.caption || "video"}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* What's on this vehicle */}
        <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-[#1E90FF]" />
            <h2 className="text-sm font-semibold text-foreground">What's On This Vehicle</h2>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
            Below are the dealer-installed products and accessories on this vehicle.
            Items marked <strong>Pre-Installed</strong> are already on the vehicle and included in the price.
            Items marked <strong>Optional</strong> can be accepted or declined at no impact to your purchase.
          </p>

          {installed.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1E90FF] mb-2">
                Pre-Installed (Included in Price)
              </p>
              <div className="space-y-2">
                {installed.map((p) => (
                  <ProductCard key={p.id} p={p} tone="installed" />
                ))}
              </div>
            </div>
          )}

          {optional.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">
                Optional (You Choose)
              </p>
              <div className="space-y-2">
                {optional.map((p) => (
                  <ProductCard key={p.id} p={p} tone="optional" />
                ))}
              </div>
            </div>
          )}

          {installed.length === 0 && optional.length === 0 && (
            <p className="text-xs text-muted-foreground">No additional products on this vehicle.</p>
          )}
        </section>

        {/* Dealer value props */}
        {listing.value_props?.length > 0 && (
          <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">Included With Your Purchase</h2>
            </div>
            <div className="space-y-2">
              {listing.value_props.map((vp, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-amber-50/60 border border-amber-100"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{vp.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{vp.description}</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                    {vp.price}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documents */}
        {listing.documents?.length > 0 && (
          <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-[#1E90FF]" />
              <h2 className="text-sm font-semibold text-foreground">Program Documents</h2>
            </div>
            <div className="space-y-2">
              {listing.documents.map((d, i) => (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-[#1E90FF]/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-[#1E90FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">{d.type} — Tap to view</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Trust */}
        <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-foreground">Your Protection</h2>
          </div>
          <div className="space-y-2">
            <TrustItem text="Every product is fully disclosed with pricing before you sign." />
            <TrustItem text="Optional items can be declined with zero impact on your purchase or financing." />
            <TrustItem text="All disclosures meet FTC federal requirements and your state's consumer protection laws." />
            <TrustItem text="Your signature, initials, and selections are timestamped and stored in a tamper-evident audit trail." />
            <TrustItem text="You will receive a copy of every signed document for your records." />
          </div>
        </section>

        {/* Sticker QR + share */}
        <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
          <div className="grid md:grid-cols-[auto,1fr] gap-5 items-center">
            <div className="bg-white p-3 rounded-lg border border-border w-fit mx-auto md:mx-0">
              <QRCodeSVG value={viewUrl} size={112} level="M" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <QrIcon className="w-4 h-4 text-[#1E90FF]" />
                <h3 className="text-sm font-semibold text-foreground">Keep this vehicle handy</h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                Scan or save this code to return to this addendum on any device.
              </p>
              <p className="text-[10px] text-muted-foreground font-mono break-all">{viewUrl}</p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-border bg-card shadow-premium p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Questions about this vehicle?</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Take your time reviewing everything above. When you're ready, your salesperson will walk you through each
            item and answer any questions.
          </p>
          <div className="flex flex-wrap gap-2">
            {dealer.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#0B2041] text-white text-sm font-semibold"
              >
                <Phone className="w-4 h-4" /> Call {dealer.name || "dealership"}
              </a>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 pb-32 md:pb-6">
          <Logo variant="full" size={22} />
          <p className="text-[10px] text-muted-foreground mt-2">
            Powered by AutoLabels.io · <Clock className="inline w-2.5 h-2.5 -mt-0.5" /> Published{" "}
            {listing.published_at ? new Date(listing.published_at).toLocaleDateString() : "recently"}
          </p>
        </footer>
      </main>

      {/* Sticky shopper CTA — thumbs-reach on mobile, anchored right
          on desktop. Mobile rail uses backdrop-blur so page content
          stays visible under the action buttons. */}
      <div className="fixed bottom-0 inset-x-0 z-30 p-4 surface-blur border-t border-border md:bg-transparent md:border-t-0 md:backdrop-blur-0 md:pointer-events-none">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-2 md:pointer-events-auto">
          {dealer.phone && (
            <a
              href={`tel:${dealer.phone}`}
              className="h-12 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 inline-flex items-center gap-1.5 shadow-premium hover:brightness-95 transition-all whitespace-nowrap"
            >
              <Phone className="w-4 h-4 stroke-[2.5]" />
              <span className="font-display font-bold tracking-tight">Call</span>
            </a>
          )}
          <button
            onClick={() => setInquiryOpen(true)}
            className="h-12 px-5 rounded-xl bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white inline-flex items-center gap-1.5 shadow-premium hover:brightness-110 transition-all whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4 stroke-[2.5]" />
            <span className="font-display font-black tracking-tight text-[15px]">Request this vehicle</span>
          </button>
        </div>
      </div>

      {inquiryOpen && (
        <InquiryModal
          listing={listing}
          dealer={dealer}
          onClose={() => {
            setInquiryOpen(false);
            if (inquirySent) setInquirySent(false);
          }}
          onSent={() => setInquirySent(true)}
          sent={inquirySent}
        />
      )}
    </div>
  );
};

interface InquiryModalProps {
  listing: VehicleListing;
  dealer: { name?: string; phone?: string; address?: string; city?: string; state?: string };
  onClose: () => void;
  onSent: () => void;
  sent: boolean;
}

const InquiryModal = ({ listing, dealer, onClose, onSent, sent }: InquiryModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("I'm interested in this vehicle. Please contact me.");
  const [intent, setIntent] = useState<"info" | "test_drive" | "offer">("info");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("Name plus email or phone is required.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("audit_log").insert({
        action: "vehicle_inquiry",
        entity_type: "vehicle_listing",
        entity_id: listing.id,
        store_id: listing.store_id,
        details: {
          slug: listing.slug,
          vin: listing.vin,
          ymm: listing.ymm,
          intent,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          message: message.trim() || null,
          page: typeof window !== "undefined" ? window.location.href : null,
          at: new Date().toISOString(),
        },
      });
      if (error) {
        toast.error("Couldn't send your request. Try calling the dealer directly.");
      } else {
        onSent();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-[28px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="pt-2 md:hidden flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black font-display tracking-tight">
              {sent ? "You're all set" : "Request this vehicle"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {sent ? `${dealer.name || "The dealer"} will be in touch shortly.` : listing.ymm || listing.vin}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Request sent.</p>
                <p className="text-xs mt-0.5">
                  Your message is now in the dealer's inbox with a timestamp
                  and the vehicle you were looking at. They usually respond
                  within a few hours during business days.
                </p>
              </div>
            </div>

            {(dealer.phone || dealer.address) && (
              <div className="rounded-xl border border-slate-200 p-4 text-xs space-y-1">
                <p className="font-bold text-slate-900">{dealer.name || "Dealership"}</p>
                {dealer.phone && (
                  <a href={`tel:${dealer.phone}`} className="text-slate-600 hover:text-[#1E90FF] block">
                    <Phone className="inline w-3 h-3 mr-1" />
                    {dealer.phone}
                  </a>
                )}
                {dealer.address && (
                  <p className="text-slate-600">
                    {dealer.address}
                    {dealer.city ? `, ${dealer.city}` : ""}
                    {dealer.state ? `, ${dealer.state}` : ""}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-slate-900 text-white font-display font-black text-sm hover:brightness-110"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "info", label: "More info", icon: MessageSquare },
                { id: "test_drive", label: "Test drive", icon: Calendar },
                { id: "offer", label: "Make an offer", icon: DollarSign },
              ].map((i) => (
                <button
                  key={i.id}
                  onClick={() => setIntent(i.id as typeof intent)}
                  className={`h-14 rounded-xl border text-[11px] font-semibold inline-flex flex-col items-center justify-center gap-0.5 ${
                    intent === i.id
                      ? "border-[#1E90FF] bg-[#1E90FF]/5 text-[#1E90FF]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <i.icon className="w-4 h-4" />
                  {i.label}
                </button>
              ))}
            </div>

            <Field label="Your name" value={name} onChange={setName} placeholder="Full name" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
              <Field label="Phone" value={phone} onChange={setPhone} placeholder="(555) 123-4567" type="tel" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:border-[#1E90FF] focus:ring-2 focus:ring-[#1E90FF]/20"
              />
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              By sending this you agree we can share your contact with this
              dealership so they can follow up. Your request is time-stamped
              and logged to the dealer's audit trail.
            </p>

            <button
              onClick={submit}
              disabled={submitting || !name.trim() || (!email.trim() && !phone.trim())}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white font-display font-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-premium hover:brightness-110"
            >
              {submitting ? "Sending…" : (<><Send className="w-4 h-4 stroke-[2.5]" /> Send request</>)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
}) => (
  <div>
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      placeholder={placeholder}
      className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#1E90FF] focus:ring-2 focus:ring-[#1E90FF]/20"
    />
  </div>
);

const ProductCard = ({
  p,
  tone,
}: {
  p: {
    id: string;
    name: string;
    subtitle?: string | null;
    warranty?: string | null;
    price: number;
    disclosure?: string | null;
  };
  tone: "installed" | "optional";
}) => (
  <div
    className={`rounded-lg border p-3 ${
      tone === "installed" ? "border-[#1E90FF]/20 bg-[#1E90FF]/5" : "border-amber-200 bg-amber-50/40"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{p.name}</p>
        {p.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{p.subtitle}</p>}
        {p.warranty && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            <Award className="inline w-3 h-3 mr-1 -mt-0.5" />
            {p.warranty}
          </p>
        )}
      </div>
      <p className="text-sm font-bold tabular-nums text-foreground whitespace-nowrap">
        <DollarSign className="inline w-3 h-3 -mt-0.5" />
        {p.price.toLocaleString()}
      </p>
    </div>
    {p.disclosure && (
      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{p.disclosure}</p>
    )}
  </div>
);

const TrustItem = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2">
    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
    <p className="text-[11px] text-muted-foreground">{text}</p>
  </div>
);

export default PublicListing;
