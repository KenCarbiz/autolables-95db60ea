-- ──────────────────────────────────────────────────────────────────────
-- AutoLabels.io + Autocurb.io — shared tenant & entitlement model
--
-- Primitive idea: one Supabase project backs the whole family. A
-- dealership is a `tenants` row. `tenant_members` ties auth.users to
-- their tenant with a role. `onboarding_profiles` holds the shared
-- dealer info that any app in the family reads. `app_entitlements`
-- declares which apps the tenant has paid for and at what tier.
-- `handoff_tokens` carries a user between autocurb.io and autolabels.io
-- without forcing a re-login (pre-SSO fallback).
-- ──────────────────────────────────────────────────────────────────────

-- 1. TENANTS — the dealer-group customer record.
CREATE TABLE IF NOT EXISTS public.tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  domain              TEXT,                       -- e.g. freemanford.com
  primary_email       TEXT,
  billing_email       TEXT,
  source              TEXT NOT NULL DEFAULT 'autolabels'
                        CHECK (source IN ('autocurb', 'autolabels', 'manual')),
  autocurb_tenant_id  TEXT,                       -- ID in the Autocurb system, if sourced there
  stripe_customer_id  TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants (domain);
CREATE INDEX IF NOT EXISTS idx_tenants_autocurb ON public.tenants (autocurb_tenant_id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;


-- 2. TENANT_MEMBERS — who belongs to the tenant and at what role.
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email       TEXT,                       -- populated before accept
  role                TEXT NOT NULL DEFAULT 'staff'
                        CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  accepted_at         TIMESTAMPTZ,
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by          UUID REFERENCES auth.users(id),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members (user_id);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;


-- 3. ONBOARDING_PROFILES — shared dealer profile for the whole family.
--    Written by whichever app did the onboarding. Read by every app.
CREATE TABLE IF NOT EXISTS public.onboarding_profiles (
  tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name        TEXT,
  tagline             TEXT,
  primary_color       TEXT,
  secondary_color     TEXT,
  logo_url            TEXT,
  website             TEXT,
  phone               TEXT,
  stores              JSONB NOT NULL DEFAULT '[]',
                        -- [{ name, address, city, state, zip, phone, logo_url, tagline }]
  billing             JSONB NOT NULL DEFAULT '{}',
                        -- { plan_tier, billing_contact, address, payment_method }
  lead_preferences    JSONB NOT NULL DEFAULT '{}',
                        -- { bdc_model, email_routing, sms_enabled }
  completed_at        TIMESTAMPTZ,
  source              TEXT NOT NULL DEFAULT 'autolabels'
                        CHECK (source IN ('autocurb', 'autolabels', 'manual')),
  last_synced_at      TIMESTAMPTZ,                -- last time autocurb pushed fresh data
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_profiles ENABLE ROW LEVEL SECURITY;


-- 4. APP_ENTITLEMENTS — per-app, per-tenant subscription record.
CREATE TABLE IF NOT EXISTS public.app_entitlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  app_slug            TEXT NOT NULL CHECK (app_slug IN
                        ('autolabels', 'autocurb', 'autoframe', 'autovideo')),
  plan_tier           TEXT NOT NULL DEFAULT 'sticker',
                        -- free-form so each app can define its own tiers
  status              TEXT NOT NULL DEFAULT 'trial'
                        CHECK (status IN ('trial', 'active', 'canceled', 'past_due', 'paused')),
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at       TIMESTAMPTZ,
  renewed_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  seat_limit          INTEGER,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, app_slug)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_tenant ON public.app_entitlements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_app_status ON public.app_entitlements (app_slug, status);

ALTER TABLE public.app_entitlements ENABLE ROW LEVEL SECURITY;


-- 5. HANDOFF_TOKENS — short-lived one-time tokens for cross-app redirect.
--    Autocurb.io generates a token and redirects to
--    https://autolabels.io/onboarding?handoff=<id>. We consume it
--    server-side (Edge function) to obtain the tenant_id, user_id,
--    and a fresh Supabase session for the user.
CREATE TABLE IF NOT EXISTS public.handoff_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_app          TEXT NOT NULL,
  target_app          TEXT NOT NULL,
  intent              TEXT NOT NULL DEFAULT 'open'
                        CHECK (intent IN ('open', 'onboard', 'activate', 'invite')),
  payload             JSONB NOT NULL DEFAULT '{}',
  consumed_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_expires ON public.handoff_tokens (expires_at);

ALTER TABLE public.handoff_tokens ENABLE ROW LEVEL SECURITY;


-- ── Helper function: which tenant does the current auth user belong to?
--    SECURITY DEFINER so we can use it from RLS policies without loops.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  LIMIT 1;
$$;


-- ── Helper function: does the current user have access to this app?
CREATE OR REPLACE FUNCTION public.has_app_access(_app_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_entitlements e
    JOIN public.tenant_members m ON m.tenant_id = e.tenant_id
    WHERE m.user_id = auth.uid()
      AND m.accepted_at IS NOT NULL
      AND e.app_slug = _app_slug
      AND e.status IN ('trial', 'active')
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;


-- ── RLS: tenants ─ user sees only their tenants.
CREATE POLICY "Members see their tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));

CREATE POLICY "Owners can update their tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND accepted_at IS NOT NULL
  ));

CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);


-- ── RLS: tenant_members
CREATE POLICY "Members see their own memberships"
  ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid()
      OR tenant_id IN (
        SELECT tenant_id FROM public.tenant_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
          AND accepted_at IS NOT NULL
      ));

CREATE POLICY "Users can accept their own membership"
  ON public.tenant_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can invite members"
  ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  ) OR invited_by = auth.uid());


-- ── RLS: onboarding_profiles
CREATE POLICY "Members read profile"
  ON public.onboarding_profiles FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));

CREATE POLICY "Admins write profile"
  ON public.onboarding_profiles FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  ));


-- ── RLS: app_entitlements
CREATE POLICY "Members read entitlements"
  ON public.app_entitlements FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  ));

CREATE POLICY "Admins write entitlements"
  ON public.app_entitlements FOR ALL TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  ));


-- ── RLS: handoff_tokens ─ accessed only via edge function (SECURITY DEFINER).
-- Deny everything for authenticated clients. Edge function bypasses RLS
-- via the service role key.
CREATE POLICY "No direct access to handoff tokens"
  ON public.handoff_tokens FOR ALL TO authenticated USING (false) WITH CHECK (false);


-- ── Triggers
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_profiles_updated_at
  BEFORE UPDATE ON public.onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_entitlements_updated_at
  BEFORE UPDATE ON public.app_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── Convenience RPC: start a fresh tenant for a direct-signup user.
-- Called by /onboarding when the user finishes the wizard and has no tenant.
CREATE OR REPLACE FUNCTION public.bootstrap_tenant(
  _name TEXT,
  _slug TEXT,
  _source TEXT DEFAULT 'autolabels',
  _app_slug TEXT DEFAULT 'autolabels',
  _plan_tier TEXT DEFAULT 'sticker'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  -- Create tenant
  INSERT INTO public.tenants (name, slug, source)
  VALUES (_name, _slug, _source)
  RETURNING id INTO v_tenant_id;

  -- Owner membership
  INSERT INTO public.tenant_members (tenant_id, user_id, role, accepted_at, invited_by)
  VALUES (v_tenant_id, v_user, 'owner', now(), v_user);

  -- Empty onboarding profile (wizard will populate it)
  INSERT INTO public.onboarding_profiles (tenant_id, source)
  VALUES (v_tenant_id, _source);

  -- Default trial entitlement for the calling app
  INSERT INTO public.app_entitlements (tenant_id, app_slug, plan_tier, status, trial_ends_at)
  VALUES (v_tenant_id, _app_slug, _plan_tier, 'trial', now() + INTERVAL '14 days');

  RETURN v_tenant_id;
END;
$$;
