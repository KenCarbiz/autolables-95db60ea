-- ──────────────────────────────────────────────────────────────────────
-- AutoLabels.io — Platform Expansion
-- 1. vehicle_listings: Supabase-backed public shopper portal (/v/:slug)
-- 2. prep_sign_offs:   Shop-foreman sign-off on prep & accessory install
-- 3. audit_log:        Server-persisted audit trail (replaces localStorage)
-- 4. addendums:        Hardened disclosure sign-off (hash, consent, UA)
-- ──────────────────────────────────────────────────────────────────────

-- 1. VEHICLE_LISTINGS — the public shopper-facing addendum ───────────
CREATE TABLE IF NOT EXISTS public.vehicle_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        TEXT NOT NULL,                 -- tenant/store scope
  vin             TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,          -- short, URL-safe, e.g. "koons-lx-9k2a"
  ymm             TEXT,                          -- "2024 Lexus RX 350"
  trim            TEXT,
  mileage         INTEGER,
  condition       TEXT CHECK (condition IN ('new', 'used', 'cpo')),
  price           NUMERIC(10,2),
  sticker_snapshot JSONB NOT NULL DEFAULT '{}',  -- { products: [], totals: {}, tracking_code }
  dealer_snapshot  JSONB NOT NULL DEFAULT '{}',  -- { name, phone, tagline, logo_url, address }
  value_props      JSONB NOT NULL DEFAULT '[]',  -- [{title, description, price}]
  documents        JSONB NOT NULL DEFAULT '[]',  -- [{name, url, type}]
  videos           JSONB NOT NULL DEFAULT '[]',  -- [{id, url, caption}]
  prep_status      JSONB,                        -- { all_accessories_installed, foreman_signed_at }
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

-- Public (anon) can read only PUBLISHED listings — the shopper-facing portal
CREATE POLICY "Anyone can view published listings"
  ON public.vehicle_listings FOR SELECT TO anon
  USING (status = 'published');

-- Authenticated dealers can read/write their own (later: tighten with store_id scope)
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

-- Safe public lookup by slug (bumps view_count too — via separate RPC)
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


-- 2. PREP_SIGN_OFFS — shop foreman sign-off on prep & install ────────
CREATE TABLE IF NOT EXISTS public.prep_sign_offs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL,
  vin                   TEXT NOT NULL,
  stock_number          TEXT,
  ymm                   TEXT,
  get_ready_record_id   TEXT,                    -- matches useGetReady local UUID
  accessories_installed JSONB NOT NULL DEFAULT '[]',
                                                 -- [{product_id, product_name, installed_date,
                                                 --   installed_by, photo_urls[]}]
  inspection_passed     BOOLEAN NOT NULL DEFAULT false,
  inspection_form_type  TEXT,                    -- e.g. "CT-K208"
  install_photos        JSONB NOT NULL DEFAULT '[]',
                                                 -- [{url, caption, category: 'before|after|defect'}]
  foreman_name          TEXT NOT NULL,
  foreman_signature_data TEXT,
  foreman_ip            TEXT,
  signed_at             TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'signed', 'rejected', 'overridden')),
  rejection_reason      TEXT,
  listing_unlocked      BOOLEAN NOT NULL DEFAULT false,
                        -- true once foreman signs: unlocks ability to publish/list
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


-- 3. AUDIT_LOG — server-persisted compliance audit trail ─────────────
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
  content_hash  TEXT,                    -- SHA-256 of canonical payload at action time
  details       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_store ON public.audit_log (store_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view audit log"
  ON public.audit_log FOR SELECT TO authenticated USING (true);

-- Allow anonymous inserts from signing flow (customer can write their own signature event),
-- but the row's user_id must be null and action must be a whitelisted signing action.
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

-- audit_log is append-only: no update or delete policies granted.


-- 4. ADDENDUM SIGN-OFF HARDENING ─────────────────────────────────────
-- Add tamper-evident hash, E-SIGN consent record, user-agent, and geolocation
-- to the existing addendums table. IDEMPOTENT via IF NOT EXISTS (Postgres 9.6+).
ALTER TABLE public.addendums
  ADD COLUMN IF NOT EXISTS content_hash      TEXT,
  ADD COLUMN IF NOT EXISTS esign_consent     JSONB,
  ADD COLUMN IF NOT EXISTS user_agent        TEXT,
  ADD COLUMN IF NOT EXISTS signing_location  JSONB,
  ADD COLUMN IF NOT EXISTS delivery_mileage  INTEGER,
  ADD COLUMN IF NOT EXISTS sticker_match_ack BOOLEAN,
  ADD COLUMN IF NOT EXISTS warranty_ack      BOOLEAN,
  ADD COLUMN IF NOT EXISTS listing_slug      TEXT;  -- link back to public /v/:slug

CREATE INDEX IF NOT EXISTS idx_addendums_listing_slug ON public.addendums (listing_slug);
