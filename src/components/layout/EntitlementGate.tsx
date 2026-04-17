import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements, type AppSlug } from "@/hooks/useEntitlements";
import ActivatePaywall from "@/components/layout/ActivatePaywall";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// ──────────────────────────────────────────────────────────────
// EntitlementGate — wrap any protected route. Outcomes, in order:
//
//   1. Not signed in.
//      → redirect to /login.
//
//   2. Signed in but has no local tenant_members row.
//      → first attempt a one-shot cold pull from Autocurb (in case
//        the user signed up there with the same email and Autocurb
//        runs in a separate Supabase project). If the pull seeds a
//        local tenant, we proceed; otherwise we send them to
//        /onboarding to do the standalone signup wizard.
//
//   3. Signed in, has tenant, no entitlement for this app.
//      → If the tenant came from Autocurb (source==='autocurb' OR
//        has an active autocurb entitlement), the dealer's plan
//        already bundles the AutoLabels Essential tier. We
//        auto-provision it once and skip the paywall entirely so
//        Autocurb-sourced users get a seamless one-link sign-in.
//      → Otherwise show <ActivatePaywall /> for standalone signup
//        or upgrade.
//
//   4. Entitlement ok.
//      → render children.
// ──────────────────────────────────────────────────────────────

interface Props {
  app: AppSlug;
  children: ReactNode;
}

const EntitlementGate = ({ app, children }: Props) => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { loading, tenant, hasApp, needsOnboarding, entitlementFor, activateApp, reload } =
    useEntitlements();

  const [pulling, setPulling] = useState(false);
  const [activating, setActivating] = useState(false);
  const pulledRef = useRef(false);
  const activatedRef = useRef(false);

  // Cold pull from Autocurb when the user has no local tenant.
  // Admins skip this entirely — they are platform operators, not
  // dealership members. The pull is bounded by a hard 4s timeout so
  // a missing edge function never blocks the gate.
  useEffect(() => {
    if (authLoading || loading || !user || isAdmin) return;
    if (tenant) return;
    if (pulledRef.current) return;
    pulledRef.current = true;
    let cancelled = false;
    (async () => {
      setPulling(true);
      try {
        const pullPromise = supabase.functions.invoke("autocurb-pull", {
          body: { app_slug: app },
        });
        const timeout = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(
            () => resolve({ data: null, error: new Error("autocurb-pull timeout") }),
            4000
          )
        );
        const result = await Promise.race([pullPromise, timeout]);
        if (cancelled) return;
        if (!(result as { error?: unknown }).error) {
          await reload();
        }
      } catch {
        // best-effort — fall through to onboarding wizard
      } finally {
        if (!cancelled) setPulling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loading, user, tenant, app, reload, isAdmin]);

  // Auto-provision the bundled AutoLabels essential tier when the
  // tenant is Autocurb-sourced and no entitlement exists yet.
  useEffect(() => {
    if (!tenant || hasApp(app) || activatedRef.current) return;
    const isAutocurbSourced =
      tenant.source === "autocurb" || hasApp("autocurb");
    if (!isAutocurbSourced) return;
    activatedRef.current = true;
    (async () => {
      setActivating(true);
      await activateApp(app, "essential");
      setActivating(false);
    })();
  }, [tenant, app, hasApp, activateApp]);

  if (authLoading || loading || pulling || activating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setTimeout(() => navigate("/login"), 0);
    return null;
  }

  // Platform admins see everything without needing a tenant or
  // entitlement. They're managing the whole fleet, not a dealership.
  if (isAdmin) {
    return <>{children}</>;
  }

  if (needsOnboarding || !tenant) {
    setTimeout(() => navigate("/onboarding"), 0);
    return null;
  }

  if (!hasApp(app)) {
    return <ActivatePaywall app={app} tenant={tenant} entitlement={entitlementFor(app)} />;
  }

  return <>{children}</>;
};

export default EntitlementGate;
