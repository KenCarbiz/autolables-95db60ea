import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/brand/Logo";
import AppSwitcher from "@/components/layout/AppSwitcher";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Sparkles,
  Scan,
  FileText,
  Signature,
  Check,
  Play,
  LogIn,
} from "lucide-react";
import { AUTOCURB_BRAND } from "@/data/autocurbBrand";

/**
 * Public marketing landing — the dealer-facing front door for AutoLabels.io.
 *
 * Top-right hosts the cross-app AppSwitcher (so a HarteCash / Autocurb
 * customer can hop into AutoLabels) and a Dealer Login button. Logged-in
 * users are nudged to /dashboard.
 */
const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="bg-background">
      {/* ─────────── Top Nav ─────────── */}
      <nav className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center"
            aria-label="AutoLabels.io home"
          >
            <Logo variant="full" size={26} />
          </button>

          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <NavLink onClick={() => navigate("/about")}>About</NavLink>
            <NavLink onClick={() => navigate("/brand")}>Brand</NavLink>
            <NavLink onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
              How it works
            </NavLink>
            <NavLink onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
              Pricing
            </NavLink>
          </div>

          <div className="flex items-center gap-2">
            {/* Cross-app switcher — visible to public so subscribers know we're part of a platform */}
            <div className="hidden sm:block">
              <PublicAppSwitcher />
            </div>

            {user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md shimmer-cta text-sm font-semibold hover:brightness-110 transition-all"
              >
                Open Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Dealer Login
                </button>
                <button
                  onClick={() => navigate("/onboarding")}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md shimmer-cta text-sm font-semibold hover:brightness-110 transition-all"
                >
                  Start Free
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─────────── Hero ─────────── */}
      <section className="relative overflow-hidden shimmer-hero text-white py-24 lg:py-32 px-6 lg:px-8">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#3BB4FF]/25 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-[#1E90FF]/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1 text-xs font-medium mb-6">
            <Sparkles className="w-3 h-3 text-[#3BB4FF]" />
            <span>The dealer label platform</span>
          </div>

          <h1 className="text-6xl lg:text-8xl font-black tracking-tighter font-display leading-none">
            Clear.
            <br />
            Compliant.
            <br />
            <span className="bg-gradient-to-r from-[#3BB4FF] via-[#1E90FF] to-[#3BB4FF] bg-clip-text text-transparent italic">
              Consistent.
            </span>
          </h1>

          <p className="text-lg lg:text-xl text-white/65 mt-8 max-w-2xl mx-auto leading-relaxed">
            Every sticker, addendum, and Buyers Guide that leaves your lot — perfectly priced,
            fully disclosed, and ready to sign. Scan a VIN, build a label, capture a lead,
            close the deal.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate(user ? "/dashboard" : "/onboarding")}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-white text-slate-950 text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              {user ? "Open Dashboard" : "Start free trial"}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/about")}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-md border border-white/25 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              <Play className="w-4 h-4" />
              See a demo
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 text-xs text-white/50 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400" />
              CARS Act compliant
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400" />
              Set up in 5 minutes
            </span>
          </div>
        </div>
      </section>

      {/* ─────────── How it works ─────────── */}
      <section id="how" className="py-24 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1E90FF]">How it works</p>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter font-display mt-2">
              Four verbs. One platform.
            </h2>
            <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
              Decode, stick, sign, close — that's the whole product.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <VerbCard num="01" icon={Scan} verb="Decode" body="VIN to full factory build sheet in under 800ms via the NHTSA database." />
            <VerbCard num="02" icon={FileText} verb="Stick" body="Build a fully-compliant dealer addendum with FTC disclosures in under a minute." />
            <VerbCard num="03" icon={Signature} verb="Sign" body="Customer scans a QR, signs on their phone, and every action lands in your audit log." />
            <VerbCard num="04" icon={BarChart3} verb="Close" body="Every scan becomes a lead. Every addendum becomes data — live." />
          </div>
        </div>
      </section>

      {/* ─────────── Power band ─────────── */}
      <section className="py-24 px-6 lg:px-8 bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1E90FF]">Under the hood</p>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter font-display mt-2">
              Power where you need it
            </h2>
            <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
              Compliance-grade tools, premium UX, zero learning curve.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature icon={ShieldCheck} title="CARS Act ready" body="California SB 766 disclosures, multi-language support, 2-year retention — built in." />
            <Feature icon={Zap} title="VIN decode + scrape" body="NHTSA free decode or Black Book live pricing. Or paste a VDP URL and let us scrape it." />
            <Feature icon={Sparkles} title="Rules engine" body="Auto-assign products by year, make, model, trim, body style, or mileage." />
            <Feature icon={Signature} title="Digital signing" body="Customer signs on their phone via QR. Every signature cryptographically logged." />
            <Feature icon={FileText} title="Buyers Guide" body="FTC As-Is / Implied / Warranty guides in English + Spanish. Federal + state compliant." />
            <Feature icon={BarChart3} title="Live analytics" body="Product acceptance rates, revenue per addendum, top hooks — every signal that matters." />
          </div>
        </div>
      </section>

      {/* ─────────── Pricing teaser ─────────── */}
      <section id="pricing" className="py-24 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1E90FF]">Pricing</p>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter font-display mt-2">
              Per rooftop. No surprises.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <PriceCard
              tier="Starter"
              price="$0"
              cadence="forever"
              description="Try it. Print 5 addendums per month."
              highlights={["5 addendums / mo", "1 store", "Email support", "Brand watermark"]}
              cta="Start free"
              onCta={() => navigate("/onboarding")}
            />
            <PriceCard
              tier="Dealer"
              price="$199"
              cadence="per rooftop / mo"
              description="The standard for single-rooftop dealers."
              highlights={["Unlimited labels", "VIN decode + scrape", "Digital signing", "Rules engine", "Buyers Guide"]}
              cta="Start trial"
              featured
              onCta={() => navigate("/onboarding")}
            />
            <PriceCard
              tier="Group"
              price="Custom"
              cadence="multi-rooftop"
              description="White-label, SSO, multi-tenant for groups."
              highlights={["Everything in Dealer", "Multi-store dashboards", "SSO + SAML", "Cross-app subscriptions", "Dedicated CSM"]}
              cta="Talk to sales"
              onCta={() => window.open("mailto:hello@autolabels.io", "_blank")}
            />
          </div>
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto shimmer-hero rounded-3xl px-8 lg:px-16 py-20 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#3BB4FF]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#1E90FF]/20 blur-3xl pointer-events-none" />

          <div className="relative">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter font-display leading-none">
              Ready to label your lot
              <br />
              the right way?
            </h2>
            <p className="text-lg text-white/65 mt-6">
              Set up in 5 minutes. No credit card required. Cancel anytime.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => navigate(user ? "/dashboard" : "/onboarding")}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-white text-slate-950 text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                {user ? "Open Dashboard" : "Start free trial"}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-md border border-white/25 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
              >
                Dealer Login
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="border-t border-border py-10 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <Logo variant="full" size={22} tagline />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {AUTOCURB_BRAND.name} · {AUTOCURB_BRAND.tagline}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <button onClick={() => navigate("/about")} className="hover:text-foreground">About</button>
            <button onClick={() => navigate("/brand")} className="hover:text-foreground">Brand</button>
            <button onClick={() => navigate("/login")} className="hover:text-foreground">Sign in</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const NavLink = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="px-3 h-9 rounded-md text-sm font-medium hover:text-foreground hover:bg-muted transition-colors"
  >
    {children}
  </button>
);

/**
 * Light-themed AppSwitcher for the public landing nav. Uses the same
 * entitlement model as the in-app version — only shows enabled apps.
 */
const PublicAppSwitcher = () => <AppSwitcher currentApp="autolabels" theme="light" />;

const VerbCard = ({
  num,
  icon: Icon,
  verb,
  body,
}: {
  num: string;
  icon: typeof Scan;
  verb: string;
  body: string;
}) => (
  <div className="bg-card rounded-2xl border border-border shadow-premium p-6 hover:shadow-premium-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3BB4FF] via-[#1E90FF] to-[#0066CC] flex items-center justify-center">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs font-bold text-[#1E90FF] tabular-nums">{num}</p>
    </div>
    <h3 className="text-2xl font-bold tracking-tight font-display text-foreground">{verb}</h3>
    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{body}</p>
  </div>
);

const Feature = ({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Scan;
  title: string;
  body: string;
}) => (
  <div className="p-6">
    <div className="w-9 h-9 rounded-lg bg-[#1E90FF]/10 flex items-center justify-center mb-4">
      <Icon className="w-4 h-4 text-[#1E90FF]" />
    </div>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
  </div>
);

const PriceCard = ({
  tier,
  price,
  cadence,
  description,
  highlights,
  cta,
  onCta,
  featured = false,
}: {
  tier: string;
  price: string;
  cadence: string;
  description: string;
  highlights: string[];
  cta: string;
  onCta: () => void;
  featured?: boolean;
}) => (
  <div
    className={`rounded-2xl border p-7 flex flex-col ${
      featured
        ? "border-[#1E90FF] shadow-premium-lg bg-card relative"
        : "border-border shadow-premium bg-card"
    }`}
  >
    {featured && (
      <span className="absolute -top-3 left-7 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest shimmer-cta px-2.5 py-1 rounded-full">
        Most popular
      </span>
    )}
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{tier}</p>
    <div className="mt-4 flex items-baseline gap-1.5">
      <span className="text-4xl font-black tracking-tight font-display text-foreground">{price}</span>
      <span className="text-xs text-muted-foreground">{cadence}</span>
    </div>
    <p className="text-sm text-muted-foreground mt-2">{description}</p>

    <ul className="mt-6 space-y-2 flex-1">
      {highlights.map((h) => (
        <li key={h} className="flex items-start gap-2 text-sm text-foreground">
          <Check className="w-3.5 h-3.5 text-emerald-500 mt-1 flex-shrink-0" />
          <span>{h}</span>
        </li>
      ))}
    </ul>

    <button
      onClick={onCta}
      className={`mt-6 h-10 rounded-md text-sm font-semibold transition-all ${
        featured
          ? "shimmer-cta hover:brightness-110"
          : "bg-foreground text-background hover:opacity-90"
      }`}
    >
      {cta}
    </button>
  </div>
);

export default Landing;
