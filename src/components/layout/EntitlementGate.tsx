import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements, type AppSlug } from "@/hooks/useEntitlements";
import ActivatePaywall from "@/components/layout/ActivatePaywall";
import { Loader2 } from "lucide-react";

// ──────────────────────────────────────────────────────────────
// EntitlementGate — wrap any protected route. Three outcomes:
//   1. Not signed in         → redirect to /login
//   2. Signed in, no tenant  → redirect to /onboarding
//   3. Signed in, tenant has
//      no entitlement for
//      this app              → render <ActivatePaywall />
//   4. Entitlement ok        → render children
// ──────────────────────────────────────────────────────────────

interface Props {
  app: AppSlug;
  children: ReactNode;
}

const EntitlementGate = ({ app, children }: Props) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading, tenant, hasApp, needsOnboarding, entitlementFor } = useEntitlements();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Defer navigation to avoid render-phase side effect
    setTimeout(() => navigate("/login"), 0);
    return null;
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
