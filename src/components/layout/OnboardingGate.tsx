import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";

interface OnboardingGateProps {
  children: ReactNode;
}

/**
 * Redirects standalone users to /onboarding on first run.
 * Embedded users (running inside HarteCash) skip this entirely since
 * their tenant data comes from the parent app.
 */
const OnboardingGate = ({ children }: OnboardingGateProps) => {
  const { isStandalone, isOnboardingComplete, mode, loading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || mode === "loading") return;
    if (!isStandalone) return;
    if (isOnboardingComplete) return;
    if (location.pathname === "/onboarding") return;
    if (location.pathname === "/login") return;
    if (location.pathname.startsWith("/sign/")) return;
    navigate("/onboarding", { replace: true });
  }, [isStandalone, isOnboardingComplete, mode, loading, location.pathname, navigate]);

  return <>{children}</>;
};

export default OnboardingGate;
