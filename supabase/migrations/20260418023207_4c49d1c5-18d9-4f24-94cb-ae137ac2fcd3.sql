-- ──────────────────────────────────────────────────────────────────────
-- AutoLabels.io — Platform Expansion
-- ──────────────────────────────────────────────────────────────────────

-- 1. VEHICLE_LISTINGS
CREATE TABLE IF NOT EXISTS public.vehicle_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        TEXT NOT NULL,
  vin             TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  ymm             TEXT,
  trim            TEXT,
  mileage         INTEGER,
  condition       TEXT CHECK (condition IN ('new', 'used', 'cpo')),
  price           NUMERIC(10,2),
  sticker_snapshot JSONB NOT NULL DEFAULT '{}',
  dealer_snapshot  JSONB NOT NULL DEFAULT '{}',
  value_props      JSONB NOT NULL DEFAULT '[]',
  documents        JSONB NOT NULL DEFAULT '[]',
  videos           JSONB NOT NULL DEFAULT '[]',
  prep_status      JSONB,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at    TIMESTAMPTZ,
  view_count      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_listings_slug ON public.vehicle_listings (slug);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_store ON public.vehicle_listings (store_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_vin ON public.vehicle_listings (vin);

ALTER TABLE public.vehicle_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published listings"
  ON public.vehicle_listings FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "Auth users can view listings"
  ON public.vehicle_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can insert listings"
  ON public.vehicle_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Auth users can update listings"
  ON public.vehicle_listings FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete listings"
  ON public.vehicle_listings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_vehicle_listing_by_slug(_slug TEXT)
RETURNS SETOF public.vehicle_listings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.vehicle_listings
  WHERE slug = _slug AND status = 'published' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.increment_listing_view(_slug TEXT)
RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.vehicle_listings
  SET view_count = view_count + 1
  WHERE slug = _slug AND status = 'published';
$$;

CREATE TRIGGER update_vehicle_listings_updated_at
  BEFORE UPDATE ON public.vehicle_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. PREP_SIGN_OFFS
CREATE TABLE IF NOT EXISTS public.prep_sign_offs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL,
  vin                   TEXT NOT NULL,
  stock_number          TEXT,
  ymm                   TEXT,
  get_ready_record_id   TEXT,
  accessories_installed JSONB NOT NULL DEFAULT '[]',
  inspection_passed     BOOLEAN NOT NULL DEFAULT false,
  inspection_form_type  TEXT,
  install_photos        JSONB NOT NULL DEFAULT '[]',
  foreman_name          TEXT NOT NULL,
  foreman_signature_data TEXT,
  foreman_ip            TEXT,
  signed_at             TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'signed', 'rejected', 'overridden')),
  rejection_reason      TEXT,
  listing_unlocked      BOOLEAN NOT NULL DEFAULT false,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prep_sign_offs_vin ON public.prep_sign_offs (vin);
CREATE INDEX IF NOT EXISTS idx_prep_sign_offs_store ON public.prep_sign_offs (store_id);
CREATE INDEX IF NOT EXISTS idx_prep_sign_offs_status ON public.prep_sign_offs (status);

ALTER TABLE public.prep_sign_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view prep sign-offs"
  ON public.prep_sign_offs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can create prep sign-offs"
  ON public.prep_sign_offs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update prep sign-offs"
  ON public.prep_sign_offs FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_prep_sign_offs_updated_at
  BEFORE UPDATE ON public.prep_sign_offs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. AUDIT_LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  store_id      TEXT,
  user_id       UUID REFERENCES auth.users(id),
  user_email    TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  content_hash  TEXT,
  details       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_store ON public.audit_log (store_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view audit log"
  ON public.audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can insert signing audit events"
  ON public.audit_log FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND action IN (
      'addendum_viewed',
      'addendum_consent_given',
      'addendum_signed',
      'listing_viewed'
    )
  );

CREATE POLICY "Auth users can insert audit events"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. ADDENDUMS HARDENING
ALTER TABLE public.addendums
  ADD COLUMN IF NOT EXISTS content_hash      TEXT,
  ADD COLUMN IF NOT EXISTS esign_consent     JSONB,
  ADD COLUMN IF NOT EXISTS user_agent        TEXT,
  ADD COLUMN IF NOT EXISTS signing_location  JSONB,
  ADD COLUMN IF NOT EXISTS delivery_mileage  INTEGER,
  ADD COLUMN IF NOT EXISTS sticker_match_ack BOOLEAN,
  ADD COLUMN IF NOT EXISTS warranty_ack      BOOLEAN,
  ADD COLUMN IF NOT EXISTS listing_slug      TEXT;

CREATE INDEX IF NOT EXISTS idx_addendums_listing_slug ON public.addendums (listing_slug);

-- 5. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('prep-photos',    'prep-photos',    true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('listing-photos', 'listing-photos', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read prep-photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'prep-photos');

CREATE POLICY "Public read listing-photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Auth users upload prep-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prep-photos');

CREATE POLICY "Auth users update prep-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'prep-photos');

CREATE POLICY "Auth users delete prep-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prep-photos');

CREATE POLICY "Auth users upload listing-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-photos');

CREATE POLICY "Auth users update listing-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Auth users delete listing-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-photos');

-- 6. TENANTS / MEMBERS / PROFILES / ENTITLEMENTS / HANDOFF
CREATE TABLE IF NOT EXISTS public.tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  domain              TEXT,
  primary_email       TEXT,
  billing_email       TEXT,
  source              TEXT NOT NULL DEFAULT 'autolabels'
                        CHECK (source IN ('autocurb', 'autolabels', 'manual')),
  autocurb_tenant_id  TEXT,
  stripe_customer_id  TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants (domain);
CREATE INDEX IF NOT EXISTS idx_tenants_autocurb ON public.tenants (autocurb_tenant_id);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email       TEXT,
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
  billing             JSONB NOT NULL DEFAULT '{}',
  lead_preferences    JSONB NOT NULL DEFAULT '{}',
  completed_at        TIMESTAMPTZ,
  source              TEXT NOT NULL DEFAULT 'autolabels'
                        CHECK (source IN ('autocurb', 'autolabels', 'manual')),
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_entitlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  app_slug            TEXT NOT NULL CHECK (app_slug IN
                        ('autolabels', 'autocurb', 'autoframe', 'autovideo')),
  plan_tier           TEXT NOT NULL DEFAULT 'sticker',
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

-- Helper functions
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  LIMIT 1;
$$;

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

-- RLS
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

CREATE POLICY "No direct access to handoff tokens"
  ON public.handoff_tokens FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_profiles_updated_at
  BEFORE UPDATE ON public.onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_entitlements_updated_at
  BEFORE UPDATE ON public.app_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Plan tier rename + bootstrap_tenant
UPDATE public.app_entitlements SET plan_tier = 'essential'      WHERE plan_tier = 'sticker';
UPDATE public.app_entitlements SET plan_tier = 'unlimited'      WHERE plan_tier = 'compliance';
UPDATE public.app_entitlements SET plan_tier = 'compliance_pro' WHERE plan_tier = 'enterprise';
ALTER TABLE public.app_entitlements ALTER COLUMN plan_tier SET DEFAULT 'essential';

CREATE OR REPLACE FUNCTION public.bootstrap_tenant(
  _name TEXT,
  _slug TEXT,
  _source TEXT DEFAULT 'autolabels',
  _app_slug TEXT DEFAULT 'autolabels',
  _plan_tier TEXT DEFAULT 'essential'
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

  INSERT INTO public.tenants (name, slug, source)
  VALUES (_name, _slug, _source)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, accepted_at, invited_by)
  VALUES (v_tenant_id, v_user, 'owner', now(), v_user);

  INSERT INTO public.onboarding_profiles (tenant_id, source)
  VALUES (v_tenant_id, _source);

  INSERT INTO public.app_entitlements (tenant_id, app_slug, plan_tier, status, trial_ends_at)
  VALUES (v_tenant_id, _app_slug, _plan_tier, 'trial', now() + INTERVAL '14 days');

  RETURN v_tenant_id;
END;
$$;