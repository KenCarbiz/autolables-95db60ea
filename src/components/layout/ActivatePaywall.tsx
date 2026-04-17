import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEntitlements, type AppSlug, type EntitlementRow, type TenantRow } from "@/hooks/useEntitlements";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_DEFINITIONS } from "@/data/planTiers";
import Logo from "@/components/brand/Logo";
import { Sparkles, Check, ShieldCheck, ArrowRight, ExternalLink, LogOut } from "lucide-react";
import { toast } from "sonner";

// ──────────────────────────────────────────────────────────────
// ActivatePaywall — shown when a signed-in user has a tenant
// (e.g. they came in from autocurb.io) but no AutoLabels entitlement.
// One-click trial activation for now; Stripe checkout link goes here
// in prod.
// ──────────────────────────────────────────────────────────────

interface Props {
  app: AppSlug;
  tenant: TenantRow;
  entitlement: EntitlementRow | null;
}

const ActivatePaywall = ({ app, tenant, entitlement }: Props) => {
  const { signOut } = useAuth();
  const { activateApp } = useEntitlements();
  const navigate = useNavigate();
  const [activating, setActivating] = useState<string | null>(null);

  const canceled = entitlement?.status === "canceled" || entitlement?.status === "past_due";
  const appName =
    app === "autolabels" ? "AutoLabels" :
    app === "autocurb" ? "Autocurb" :
    app === "autoframe" ? "AutoFrame" : "AutoVideo";

  const handleActivate = async (tier: string) => {
    setActivating(tier);
    const ok = await activateApp(app, tier);
    setActivating(null);
    if (ok) {
      toast.success(`${appName} activated — 14-day trial started`);
      navigate("/dashboard");
    } else {
      toast.error("Could not activate. Please contact support.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-border bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo variant="full" size={26} />
          <button
            onClick={() => signOut().then(() => navigate("/"))}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-[#1E90FF]/10 text-[#1E90FF] px-3 py-1 rounded-full text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            {tenant.source === "autocurb" ? "Welcome from Autocurb" : `Your ${tenant.name} account is ready`}
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight font-display text-foreground">
            {canceled
              ? `Reactivate ${appName} for ${tenant.name}`
              : `Activate ${appName} for ${tenant.name}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            {tenant.source === "autocurb"
              ? `Your dealership profile is already on file from Autocurb. Pick a plan and be running in under 60 seconds — no re-onboarding.`
              : `Pick a plan. All plans start with a 14-day free trial. Cancel anytime.`}
          </p>
        </div>

        {/* Tenant summary card */}
        <div className="mb-8 rounded-2xl border border-border bg-card shadow-premium p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#0B2041] text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
            {tenant.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">
              {tenant.source === "autocurb" ? "Onboarded via Autocurb.io" : "Dealer account"}
              {tenant.domain ? ` · ${tenant.domain}` : ""}
            </p>
          </div>
          {tenant.source === "autocurb" && (
            <a
              href="https://autocurb.io/settings"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#1E90FF] hover:underline inline-flex items-center gap-1"
            >
              Manage on Autocurb <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLAN_DEFINITIONS.map((plan) => {
            const featured = plan.tier === "compliance";
            return (
              <div
                key={plan.tier}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  featured
                    ? "border-[#1E90FF] shadow-premium-lg bg-card"
                    : "border-border shadow-premium bg-card"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white px-2.5 py-1 rounded-full">
                    Most popular
                  </span>
                )}
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {plan.name}
                </p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tracking-tight font-display text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{plan.priceNote}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{plan.tagline}</p>
                <ul className="mt-5 space-y-1.5 flex-1">
                  {plan.features.slice(0, 7).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[11px] text-foreground">
                      <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleActivate(plan.tier)}
                  disabled={!!activating}
                  className={`mt-5 h-10 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    featured
                      ? "bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white hover:brightness-110"
                      : "bg-foreground text-background hover:opacity-90"
                  } disabled:opacity-50`}
                >
                  {activating === plan.tier ? "Activating…" : `Start ${plan.name} trial`}
                  {activating !== plan.tier && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center text-[11px] text-muted-foreground space-y-1">
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> 14-day trial · no credit card · cancel anytime
          </p>
          <p>
            Need help?{" "}
            <a href="mailto:hello@autolabels.io" className="text-[#1E90FF] hover:underline">
              hello@autolabels.io
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ActivatePaywall;
