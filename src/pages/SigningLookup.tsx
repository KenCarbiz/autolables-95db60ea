import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Mail } from "lucide-react";
import Logo from "@/components/brand/Logo";

// ──────────────────────────────────────────────────────────────
// SigningLookup — buyer recovery path at /lookup.
//
// If a buyer lost their /sign/:token link (email auto-deleted,
// phone switched, etc.) they enter VIN + the email or phone they
// used at signing. Server validates the match; on hit, an email
// is sent to the address on file with a fresh link to
// /sign/:token. Anti-enumeration by design: UI always shows the
// same "check your email" state regardless of match.
// ──────────────────────────────────────────────────────────────

interface DispatchEnvelope {
  email?: string;
  signing_url?: string;
  ymm?: string;
  dealer_name?: string;
}

const SigningLookup = () => {
  const [vin, setVin] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (vin.trim().length !== 17 || contact.trim().length === 0) return;
    setSubmitting(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "https://autolabels.io";
    const { data } = await (supabase as any).rpc("request_signing_link_resend", {
      _vin: vin.trim(),
      _contact: contact.trim(),
      _origin: origin,
    });

    const dispatch: DispatchEnvelope | undefined = (data as { dispatch?: DispatchEnvelope })?.dispatch;

    // If the RPC matched, fire the email. Swallow failures silently.
    // If no match, skip — UI always lands on the same "check your
    // email" state so a scraper can't distinguish hit from miss.
    if (dispatch?.email && dispatch?.signing_url) {
      const dealerName = dispatch.dealer_name || "your dealership";
      const html = `
        <p>Here's your signing link for the <strong>${dispatch.ymm || "vehicle"}</strong> at ${dealerName}:</p>
        <p><a href="${dispatch.signing_url}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open your signing page</a></p>
        <p style="font-size:12px;color:#555">Or paste this URL into your browser: ${dispatch.signing_url}</p>
        <p style="font-size:11px;color:#888">This link is yours. Please do not share it.</p>
      `;
      supabase.functions.invoke("send-email", {
        body: {
          to: dispatch.email,
          subject: `Your signing link${dispatch.ymm ? " — " + dispatch.ymm : ""}`,
          html,
        },
      }).catch(() => { /* best-effort */ });
    }

    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Logo variant="full" size={22} />
          <Link to="/" className="text-[11px] font-semibold text-slate-600 hover:text-slate-900">Home</Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-10 pb-16">
        {done ? (
          <div className="space-y-6">
            <div className="rounded-3xl bg-slate-950 text-white p-7 md:p-8">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <Mail className="w-5 h-5" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-[-0.03em] leading-[0.95]">
                Check your email.
              </h1>
              <p className="mt-3 text-[13px] text-white/75 leading-relaxed">
                If we matched your VIN and contact, a fresh signing link is on its way to the email on file. It usually arrives within a minute.
              </p>
            </div>

            <div className="text-[12px] text-slate-600 leading-relaxed space-y-2">
              <p className="font-bold text-slate-900">Nothing in your inbox after a few minutes?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Check your spam / promotions folder.</li>
                <li>Verify the VIN exactly matches the one on your contract.</li>
                <li>Try the phone number you gave the dealer instead of email.</li>
                <li>If you still can't get in, call your dealership directly.</li>
              </ul>
            </div>

            <button
              onClick={() => { setDone(false); setVin(""); setContact(""); }}
              className="w-full h-11 rounded-xl border border-slate-200 text-slate-900 text-sm font-bold hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500 font-semibold">
                Lost signing link
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-black font-display tracking-[-0.03em] leading-[0.95] text-slate-950">
                Get your link back.
              </h1>
              <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">
                Enter your VIN and the email or phone you gave the dealer. We'll email a fresh link to the contact on file.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">VIN (17 characters)</label>
                <input
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, ""))}
                  maxLength={17}
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="1HGBH41JXMN109186"
                  className="mt-1 w-full h-12 px-3 rounded-xl border border-slate-200 text-base font-mono tracking-wider text-slate-950 focus:outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                />
                <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
                  {vin.length}/17
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Email or phone you used at signing
                </label>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="you@example.com or (555) 123-4567"
                  className="mt-1 w-full h-12 px-3 rounded-xl border border-slate-200 text-base text-slate-950 focus:outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                />
              </div>

              <button
                onClick={submit}
                disabled={submitting || vin.length !== 17 || contact.trim().length === 0}
                className="w-full h-12 rounded-xl bg-slate-950 text-white font-display font-bold text-sm disabled:opacity-50 hover:bg-slate-900 transition-colors"
              >
                {submitting ? "Sending…" : "Send me the link"}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  For your protection, we only send the link to the exact email or phone the dealer has on file. We don't reveal whether a match was found.
                </span>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SigningLookup;
