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
  const [claiming, setClaiming] = useState(false);

  // We always expose the Claim button. On a fresh deployment the
  // server-side check in claim-platform accepts it; on an already-
  // claimed deployment the server returns 'already_claimed' so a
  // second person can't self-elevate. This avoids an RLS-blind spot
  // where the client can't see global admin state.
  const handleClaim = async () => {
    setClaiming(true);
    // Primary path: Postgres RPC claim_platform(). Ships with the
    // SQL migration pipeline so it's reachable as soon as the DB
    // is up to date. Avoids the Edge Function deploy step that
    // Lovable doesn't always run automatically.
    const rpc = await (supabase as any).rpc("claim_platform");
    if (!rpc.error) {
      const res = rpc.data as { ok?: boolean; message?: string } | null;
      if (res?.ok) {
        toast.success(res.message || "You're the admin. Reloading…");
        setTimeout(() => (window.location.href = "/admin"), 800);
        setClaiming(false);
        return;
      }
    } else {
      const msg = String(rpc.error.message || "");
      if (msg.includes("already_claimed")) {
        toast.error("An admin already exists. Ask them to add your email.");
        setClaiming(false);
        return;
      }
      // Fall through to the Edge Function if the RPC isn't deployed yet.
      if (!/function.*does not exist|schema.*public/i.test(msg)) {
        toast.error(msg || "Claim RPC failed. Trying Edge Function…");
      }
    }

    // Fallback path: Edge Function (only runs if the RPC path errored).
    const fn = await supabase.functions.invoke("claim-platform", { body: {} });
    setClaiming(false);
    if (fn.error) {
      toast.error(
        (fn.error as { message?: string })?.message ||
          "Claim failed. Ensure Supabase migrations are applied."
      );
      return;
    }
    const res = fn.data as { ok?: boolean; error?: string; message?: string };
    if (res?.ok) {
      toast.success(res.message || "You're the admin. Reloading…");
      setTimeout(() => (window.location.href = "/admin"), 800);
      return;
    }
    toast.error(res?.error || "Claim failed");
  };

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
          Either your AutoLabels admin hasn't added your email to a dealership team
          yet, or this is a brand-new deployment with no admin. If you're the
          deployment operator, tap <strong>Claim platform as admin</strong> below —
          it only works on an un-claimed install and is a no-op after that.
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
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="inline-flex items-center justify-center gap-2 w-full h-14 rounded-xl bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white text-base font-bold shadow-premium disabled:opacity-60 hover:brightness-110 transition-all"
          >
            <Rocket className="w-5 h-5" />
            {claiming ? "Claiming…" : "Claim platform as admin"}
          </button>
          <p className="text-[11px] text-muted-foreground">
            First-time setup. Takes ~2 seconds. Creates the AutoLabels.io house tenant
            and makes you the owner with full admin access.
          </p>
          <div className="flex items-center gap-2 pt-2">
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

        <p className="text-[11px] text-muted-foreground pt-2">
          Not the platform operator? <a href="mailto:hello@autolabels.io?subject=AutoLabels.io%20access%20request" className="text-[#1E90FF] hover:underline">Email for access</a>.
        </p>
      </div>
    </div>
  );
};

export default NoTenantScreen;
