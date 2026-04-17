import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, LogOut, ShieldAlert, Rocket } from "lucide-react";

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
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // First-run detection: if zero admins exist on this deployment,
  // the signed-in user can claim it. We check via a lightweight read
  // of user_roles. If the table doesn't exist the check fails silently
  // and the claim button stays hidden.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { count, error } = await (supabase as any)
          .from("user_roles")
          .select("*", { head: true, count: "exact" })
          .eq("role", "admin");
        if (cancelled) return;
        if (!error && (count ?? 0) === 0) setCanClaim(true);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.functions.invoke("claim-platform", {
      body: {},
    });
    setClaiming(false);
    if (error) {
      toast.error(
        (error as { message?: string })?.message ||
          "Claim failed — check the claim-platform function logs."
      );
      return;
    }
    if ((data as { ok?: boolean })?.ok) {
      toast.success("Platform claimed — you're the admin. Reloading…");
      setTimeout(() => (window.location.href = "/admin"), 800);
      return;
    }
    toast.error((data as { error?: string })?.error || "Claim failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-5">
        <Logo variant="full" size={42} />

        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mt-6">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-foreground">
          {canClaim
            ? "This deployment isn't claimed yet"
            : "You're signed in, but not linked to a dealership yet"}
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {canClaim ? (
            <>
              No admin exists on this AutoLabels.io install yet. Since you're the first
              person signed in, you can claim the platform — you'll become the owner of
              the AutoLabels house tenant with the full admin panel unlocked. This
              one-click setup only works on a fresh deployment and locks itself after.
            </>
          ) : (
            <>
              We don't allow open self-registration right now. To activate your account on
              AutoLabels.io, your AutoLabels admin needs to add your email to your
              dealership's team. If you already sent a request, this page will update as
              soon as they finish — just refresh.
            </>
          )}
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
          {canClaim ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-md bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white text-sm font-bold shadow-premium disabled:opacity-60"
            >
              <Rocket className="w-4 h-4" />
              {claiming ? "Claiming…" : "Claim this platform as admin"}
            </button>
          ) : (
            <a
              href="mailto:hello@autolabels.io?subject=AutoLabels.io%20access%20request"
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
            >
              <Mail className="w-4 h-4" />
              Request access from AutoLabels
            </a>
          )}
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
