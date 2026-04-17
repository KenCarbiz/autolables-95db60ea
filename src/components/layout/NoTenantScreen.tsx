import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/brand/Logo";
import { Mail, LogOut, ShieldAlert } from "lucide-react";

// ──────────────────────────────────────────────────────────────
// NoTenantScreen — shown when a signed-in user is not a member
// of any tenant. In the invite-only world we just rolled out,
// this means they need a super-admin to add them to a dealership.
//
// Replaces the previous behavior of bouncing to /onboarding, which
// allowed anyone who signed up to self-provision a tenant.
// ──────────────────────────────────────────────────────────────

const NoTenantScreen = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-5">
        <Logo variant="full" size={42} />

        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mt-6">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-foreground">
          You're signed in, but not linked to a dealership yet
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          We don't allow open self-registration right now. To activate your account on
          AutoLabels.io, your AutoLabels admin needs to add your email to your
          dealership's team. If you already sent a request, this page will update as
          soon as they finish — just refresh.
        </p>

        <div className="rounded-xl border border-border bg-card p-4 text-left text-xs space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            <span>Your email on file</span>
          </div>
          <p className="font-mono font-semibold text-foreground break-all">
            {user?.email || "—"}
          </p>
        </div>

        <div className="space-y-2">
          <a
            href="mailto:hello@autolabels.io?subject=AutoLabels.io%20access%20request"
            className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
          >
            <Mail className="w-4 h-4" />
            Request access from AutoLabels
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="flex-1 h-9 rounded-md border border-border text-sm font-semibold"
            >
              Back to home
            </button>
            <button
              onClick={() => signOut().then(() => navigate("/"))}
              className="flex-1 h-9 rounded-md border border-border text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Managing a dealership group? Contact us at{" "}
          <a href="mailto:hello@autolabels.io" className="text-[#1E90FF] hover:underline">
            hello@autolabels.io
          </a>{" "}
          to get added as the owner.
        </p>
      </div>
    </div>
  );
};

export default NoTenantScreen;
