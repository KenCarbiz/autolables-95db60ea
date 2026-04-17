import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// ──────────────────────────────────────────────────────────────
// useEntitlements — single source of truth for:
//   1. Which tenant the signed-in user belongs to.
//   2. What apps their tenant has paid for (and at what tier).
//   3. The shared onboarding profile (name, logo, stores, etc.).
//
// Any app in the Autocurb/AutoLabels family reads the same tables
// (migration 20260417030000), so this hook is portable.
// ──────────────────────────────────────────────────────────────

export type AppSlug = "autolabels" | "autocurb" | "autoframe" | "autovideo";
export type EntitlementStatus = "trial" | "active" | "canceled" | "past_due" | "paused";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  source: "autocurb" | "autolabels" | "manual";
  autocurb_tenant_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantMemberRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  role: "owner" | "admin" | "manager" | "staff";
  accepted_at: string | null;
  invited_at: string;
}

export interface OnboardingProfileRow {
  tenant_id: string;
  display_name: string | null;
  tagline: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  stores: Array<Record<string, unknown>>;
  billing: Record<string, unknown>;
  lead_preferences: Record<string, unknown>;
  completed_at: string | null;
  source: "autocurb" | "autolabels" | "manual";
  last_synced_at: string | null;
}

export interface EntitlementRow {
  id: string;
  tenant_id: string;
  app_slug: AppSlug;
  plan_tier: string;
  status: EntitlementStatus;
  activated_at: string;
  trial_ends_at: string | null;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  seat_limit: number | null;
}

export interface EntitlementsState {
  tenant: TenantRow | null;
  member: TenantMemberRow | null;
  profile: OnboardingProfileRow | null;
  entitlements: EntitlementRow[];
  loading: boolean;
  error: string | null;
}

export const useEntitlements = () => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<EntitlementsState>({
    tenant: null,
    member: null,
    profile: null,
    entitlements: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!user) {
      setState({
        tenant: null, member: null, profile: null, entitlements: [],
        loading: false, error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    // Wrap the whole thing in a try/catch so a thrown query never
    // leaves the gate stuck on `loading=true`. Tables that don't exist
    // yet (un-applied migration, fresh project) become `error` not a
    // hung spinner.
    try {
      const { data: membership, error: memberErr } = await (supabase as any)
        .from("tenant_members")
        .select("*")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .limit(1)
        .maybeSingle();

      if (memberErr) {
        setState({
          tenant: null, member: null, profile: null, entitlements: [],
          loading: false, error: memberErr.message,
        });
        return;
      }

      if (!membership) {
        setState({
          tenant: null, member: null, profile: null, entitlements: [],
          loading: false, error: null,
        });
        return;
      }

      const [tenantRes, profileRes, entRes] = await Promise.all([
        (supabase as any).from("tenants").select("*").eq("id", membership.tenant_id).single(),
        (supabase as any).from("onboarding_profiles").select("*").eq("tenant_id", membership.tenant_id).maybeSingle(),
        (supabase as any).from("app_entitlements").select("*").eq("tenant_id", membership.tenant_id),
      ]);

      setState({
        tenant: (tenantRes.data as TenantRow) || null,
        member: membership as TenantMemberRow,
        profile: (profileRes.data as OnboardingProfileRow) || null,
        entitlements: (entRes.data as EntitlementRow[]) || [],
        loading: false,
        error: tenantRes.error?.message || entRes.error?.message || null,
      });
    } catch (err) {
      setState({
        tenant: null, member: null, profile: null, entitlements: [],
        loading: false,
        error: err instanceof Error ? err.message : "load failed",
      });
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const hasApp = useCallback(
    (slug: AppSlug): boolean => {
      const ent = state.entitlements.find((e) => e.app_slug === slug);
      if (!ent) return false;
      if (ent.status !== "trial" && ent.status !== "active") return false;
      if (ent.expires_at && new Date(ent.expires_at) < new Date()) return false;
      return true;
    },
    [state.entitlements]
  );

  const tier = useCallback(
    (slug: AppSlug): string | null => {
      const ent = state.entitlements.find((e) => e.app_slug === slug);
      return ent?.plan_tier ?? null;
    },
    [state.entitlements]
  );

  const entitlementFor = useCallback(
    (slug: AppSlug): EntitlementRow | null =>
      state.entitlements.find((e) => e.app_slug === slug) ?? null,
    [state.entitlements]
  );

  // Provision or re-activate the autolabels entitlement for the current tenant.
  // Used by the "Activate AutoLabels" paywall for users who came from autocurb.
  const activateApp = useCallback(
    async (slug: AppSlug, planTier: string = "essential"): Promise<boolean> => {
      if (!state.tenant) return false;
      const existing = state.entitlements.find((e) => e.app_slug === slug);
      if (existing) {
        const { error } = await (supabase as any)
          .from("app_entitlements")
          .update({
            status: "trial",
            plan_tier: planTier,
            trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
          })
          .eq("id", existing.id);
        if (error) return false;
      } else {
        const { error } = await (supabase as any).from("app_entitlements").insert({
          tenant_id: state.tenant.id,
          app_slug: slug,
          plan_tier: planTier,
          status: "trial",
          trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
        });
        if (error) return false;
      }
      await load();
      return true;
    },
    [state.tenant, state.entitlements, load]
  );

  // For a direct-signup user with no tenant yet.
  const bootstrapTenant = useCallback(
    async (input: {
      name: string;
      slug?: string;
      source?: "autolabels" | "autocurb" | "manual";
      app: AppSlug;
      tier?: string;
    }): Promise<{ tenantId: string | null; error: string | null }> => {
      const slug =
        input.slug ||
        input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
          "-" + Math.random().toString(36).slice(2, 6);
      const { data, error } = await (supabase as any).rpc("bootstrap_tenant", {
        _name: input.name,
        _slug: slug,
        _source: input.source || "autolabels",
        _app_slug: input.app,
        _plan_tier: input.tier || "essential",
      });
      if (error) return { tenantId: null, error: error.message };
      await load();
      return { tenantId: data as string, error: null };
    },
    [load]
  );

  return {
    ...state,
    hasApp,
    tier,
    entitlementFor,
    activateApp,
    bootstrapTenant,
    reload: load,
    isProvisioned: state.entitlements.length > 0,
    needsOnboarding: !state.loading && !!user && !state.tenant,
  };
};
