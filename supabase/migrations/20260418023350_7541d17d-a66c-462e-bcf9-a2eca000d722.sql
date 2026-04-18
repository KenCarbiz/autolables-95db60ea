-- ──────────────────────────────────────────────────────────────────────
-- Hardening: tenant scoping, prep gate, seat limits, deal tokens, SB 766
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_tenant ON public.vehicle_listings (tenant_id);

ALTER TABLE public.prep_sign_offs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_prep_sign_offs_tenant ON public.prep_sign_offs (tenant_id);

CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_id_vehicle_listings ON public.vehicle_listings;
CREATE TRIGGER set_tenant_id_vehicle_listings
  BEFORE INSERT ON public.vehicle_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_tenant_id_prep_sign_offs ON public.prep_sign_offs;
CREATE TRIGGER set_tenant_id_prep_sign_offs
  BEFORE INSERT ON public.prep_sign_offs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP POLICY IF EXISTS "Auth users can view listings" ON public.vehicle_listings;
DROP POLICY IF EXISTS "Auth users can insert listings" ON public.vehicle_listings;
DROP POLICY IF EXISTS "Auth users can update listings" ON public.vehicle_listings;

CREATE POLICY "Tenant members view listings"
  ON public.vehicle_listings FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL AND created_by = auth.uid()
    OR tenant_id = public.current_tenant_id()
  );

CREATE POLICY "Tenant members insert listings"
  ON public.vehicle_listings FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant members update listings"
  ON public.vehicle_listings FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Auth users can view prep sign-offs" ON public.prep_sign_offs;
DROP POLICY IF EXISTS "Auth users can create prep sign-offs" ON public.prep_sign_offs;
DROP POLICY IF EXISTS "Creator or admin can update prep sign-offs" ON public.prep_sign_offs;

CREATE POLICY "Tenant members view prep sign-offs"
  ON public.prep_sign_offs FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL AND created_by = auth.uid()
    OR tenant_id = public.current_tenant_id()
  );

CREATE POLICY "Tenant members create prep sign-offs"
  ON public.prep_sign_offs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant members update prep sign-offs"
  ON public.prep_sign_offs FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Recall columns first so prep_gate trigger can reference them
ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS recall_check          JSONB,
  ADD COLUMN IF NOT EXISTS recall_override_by    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recall_override_notes TEXT,
  ADD COLUMN IF NOT EXISTS recall_override_at    TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.enforce_prep_gate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unlocked      BOOLEAN;
  v_do_not_drive  BOOLEAN;
  v_checked_at    TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN

    IF public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;

    SELECT listing_unlocked INTO v_unlocked
      FROM public.prep_sign_offs
      WHERE vin = NEW.vin
        AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
        AND listing_unlocked = true
      ORDER BY signed_at DESC NULLS LAST, created_at DESC
      LIMIT 1;

    IF v_unlocked IS NOT TRUE THEN
      RAISE EXCEPTION 'prep_gate_blocked: vehicle % has no signed prep_sign_off with listing_unlocked=true',
        NEW.vin USING ERRCODE = 'check_violation';
    END IF;

    v_do_not_drive := COALESCE((NEW.recall_check ->> 'do_not_drive')::BOOLEAN, false);
    v_checked_at   := (NEW.recall_check ->> 'checked_at')::TIMESTAMPTZ;

    IF v_do_not_drive AND NEW.recall_override_by IS NULL THEN
      RAISE EXCEPTION 'recall_gate_blocked: vehicle % has an active do-not-drive recall; admin override required',
        NEW.vin USING ERRCODE = 'check_violation';
    END IF;

    IF v_checked_at IS NULL OR v_checked_at < now() - INTERVAL '30 days' THEN
      RAISE EXCEPTION 'recall_gate_blocked: NHTSA recall check missing or stale for vehicle %; refresh before publish',
        NEW.vin USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_prep_gate_vehicle_listings ON public.vehicle_listings;
CREATE TRIGGER enforce_prep_gate_vehicle_listings
  BEFORE INSERT OR UPDATE OF status ON public.vehicle_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prep_gate();

CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seat_limit INTEGER;
  v_current_seats INTEGER;
BEGIN
  SELECT MAX(seat_limit) INTO v_seat_limit
    FROM public.app_entitlements
    WHERE tenant_id = NEW.tenant_id
      AND status IN ('trial', 'active');

  IF v_seat_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_seats
    FROM public.tenant_members
    WHERE tenant_id = NEW.tenant_id
      AND (user_id IS NOT NULL OR invited_email IS NOT NULL);

  IF v_current_seats >= v_seat_limit THEN
    RAISE EXCEPTION 'seat_limit_exceeded: tenant has reached % seats; upgrade plan to invite more',
      v_seat_limit USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_seat_limit_tenant_members ON public.tenant_members;
CREATE TRIGGER enforce_seat_limit_tenant_members
  BEFORE INSERT ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();

CREATE TABLE IF NOT EXISTS public.deal_signing_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  vehicle_file_id TEXT NOT NULL,
  vehicle_payload JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'signed', 'expired', 'revoked')),
  signed_payload  JSONB,
  content_hash    TEXT,
  customer_ip     TEXT,
  user_agent      TEXT,
  esign_consent   JSONB,
  created_by      UUID REFERENCES auth.users(id),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  signed_at       TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_signing_tokens_token ON public.deal_signing_tokens (token);
CREATE INDEX IF NOT EXISTS idx_deal_signing_tokens_tenant ON public.deal_signing_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_signing_tokens_status ON public.deal_signing_tokens (status);

ALTER TABLE public.deal_signing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view deal tokens"
  ON public.deal_signing_tokens FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members create deal tokens"
  ON public.deal_signing_tokens FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Creator can revoke deal tokens"
  ON public.deal_signing_tokens FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_deal_token(_token TEXT)
RETURNS SETOF public.deal_signing_tokens
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.deal_signing_tokens
  WHERE token = _token AND status = 'pending' AND expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sign_deal_token(
  _token TEXT, _signed_payload JSONB, _content_hash TEXT,
  _customer_ip TEXT, _user_agent TEXT, _esign_consent JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.deal_signing_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.deal_signing_tokens WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.status <> 'pending' OR v_row.expires_at <= now() THEN RETURN false; END IF;

  UPDATE public.deal_signing_tokens SET
    status = 'signed', signed_payload = _signed_payload, content_hash = _content_hash,
    customer_ip = _customer_ip, user_agent = _user_agent, esign_consent = _esign_consent,
    signed_at = now(), updated_at = now()
  WHERE id = v_row.id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, content_hash, ip_address, user_agent, details
  ) VALUES (
    'deal_signed', 'deal_signing_token', v_row.id::text,
    _content_hash, _customer_ip, _user_agent,
    jsonb_build_object('vehicle_file_id', v_row.vehicle_file_id, 'tenant_id', v_row.tenant_id)
  );
  RETURN true;
END;
$$;

CREATE TRIGGER update_deal_signing_tokens_updated_at
  BEFORE UPDATE ON public.deal_signing_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.addendums
  ADD COLUMN IF NOT EXISTS sb766_financing_disclosure JSONB,
  ADD COLUMN IF NOT EXISTS sb766_three_day_return_ack BOOLEAN,
  ADD COLUMN IF NOT EXISTS sb766_add_on_precontract   JSONB,
  ADD COLUMN IF NOT EXISTS price_overrides            JSONB,
  ADD COLUMN IF NOT EXISTS vehicle_state              TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_price              NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS financing_input            JSONB;

CREATE INDEX IF NOT EXISTS idx_addendums_sb766_return
  ON public.addendums (sb766_three_day_return_ack)
  WHERE sb766_three_day_return_ack IS NOT NULL;

-- Signed document archive
CREATE TABLE IF NOT EXISTS public.signed_document_archive (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
  doc_type       TEXT NOT NULL
                   CHECK (doc_type IN
                     ('addendum', 'deal', 'sticker', 'buyers_guide',
                      'prep_signoff', 'disclosure')),
  entity_id      TEXT NOT NULL,
  vin            TEXT,
  storage_path   TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'signed-archives',
  content_hash   TEXT NOT NULL,
  mime_type      TEXT NOT NULL DEFAULT 'application/pdf',
  byte_size      INTEGER,
  retained_until TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_tenant ON public.signed_document_archive (tenant_id);
CREATE INDEX IF NOT EXISTS idx_archive_entity ON public.signed_document_archive (doc_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_archive_vin    ON public.signed_document_archive (vin);

ALTER TABLE public.signed_document_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view archive"
  ON public.signed_document_archive FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Billing events
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  stripe_event_id TEXT UNIQUE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON public.billing_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type   ON public.billing_events (event_type);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view billing events"
  ON public.billing_events FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = billing_events.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND accepted_at IS NOT NULL
    )
  );

-- Super-admin bootstrap
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('ken@ken.cc')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = u.id AND r.role = 'admin'
  );

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) IN ('ken@ken.cc') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_super_admin ON auth.users;
CREATE TRIGGER bootstrap_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_super_admin();

-- Default house tenant for super-admin
DO $$
DECLARE
  v_tenant_id UUID;
  v_ken UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'autolabels';
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, domain, primary_email, source, is_active)
    VALUES ('AutoLabels.io', 'autolabels', 'autolabels.io', 'ken@ken.cc', 'manual', true)
    RETURNING id INTO v_tenant_id;
  END IF;

  INSERT INTO public.onboarding_profiles (
    tenant_id, display_name, tagline, primary_color, secondary_color,
    website, source, completed_at
  ) VALUES (
    v_tenant_id, 'AutoLabels.io', 'Clear. Compliant. Consistent.',
    '#1E90FF', '#0B2041', 'https://autolabels.io', 'manual', now()
  ) ON CONFLICT (tenant_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    tagline = EXCLUDED.tagline,
    completed_at = COALESCE(public.onboarding_profiles.completed_at, now());

  INSERT INTO public.app_entitlements (
    tenant_id, app_slug, plan_tier, status
  ) VALUES (v_tenant_id, 'autolabels', 'unlimited', 'active')
  ON CONFLICT (tenant_id, app_slug) DO UPDATE SET
    plan_tier = 'unlimited', status = 'active', expires_at = NULL;

  SELECT id INTO v_ken FROM auth.users WHERE lower(email) = 'ken@ken.cc' LIMIT 1;
  IF v_ken IS NOT NULL THEN
    INSERT INTO public.tenant_members (
      tenant_id, user_id, role, accepted_at, invited_by
    ) VALUES (v_tenant_id, v_ken, 'owner', now(), v_ken)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      role = 'owner',
      accepted_at = COALESCE(public.tenant_members.accepted_at, now());
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.attach_super_admin_to_house_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF lower(NEW.email) NOT IN ('ken@ken.cc') THEN RETURN NEW; END IF;
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'autolabels';
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_members (
      tenant_id, user_id, role, accepted_at, invited_by
    ) VALUES (v_tenant_id, NEW.id, 'owner', now(), NEW.id)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attach_super_admin_to_house_tenant ON auth.users;
CREATE TRIGGER attach_super_admin_to_house_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.attach_super_admin_to_house_tenant();

-- addendums tenant scoping
ALTER TABLE public.addendums
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_addendums_tenant ON public.addendums (tenant_id);

DROP TRIGGER IF EXISTS set_tenant_id_addendums ON public.addendums;
CREATE TRIGGER set_tenant_id_addendums
  BEFORE INSERT ON public.addendums
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP POLICY IF EXISTS "Auth users can view addendums" ON public.addendums;
DROP POLICY IF EXISTS "Auth users can insert addendums" ON public.addendums;
DROP POLICY IF EXISTS "Auth users can update addendums" ON public.addendums;
DROP POLICY IF EXISTS "Auth users can create addendums" ON public.addendums;
DROP POLICY IF EXISTS "Creator or admin can update addendums" ON public.addendums;

CREATE POLICY "Tenant members view addendums"
  ON public.addendums FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL AND created_by = auth.uid()
    OR tenant_id = public.current_tenant_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant members insert addendums"
  ON public.addendums FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant members update addendums"
  ON public.addendums FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );