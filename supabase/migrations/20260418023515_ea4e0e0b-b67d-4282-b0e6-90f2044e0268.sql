-- Platform admin RLS
CREATE POLICY "Admins read all tenants" ON public.tenants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all tenants" ON public.tenants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete tenants" ON public.tenants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all members" ON public.tenant_members FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all members" ON public.tenant_members FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete members" ON public.tenant_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert members" ON public.tenant_members FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all profiles" ON public.onboarding_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write all profiles" ON public.onboarding_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all entitlements" ON public.app_entitlements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write all entitlements" ON public.app_entitlements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.tenant_summary AS
SELECT t.id, t.name, t.slug, t.domain, t.source, t.is_active, t.created_at, t.updated_at,
  (SELECT COUNT(*) FROM public.tenant_members m WHERE m.tenant_id = t.id AND m.accepted_at IS NOT NULL) AS member_count,
  (SELECT COUNT(*) FROM public.app_entitlements e WHERE e.tenant_id = t.id AND e.status IN ('trial','active')) AS active_apps,
  ARRAY(SELECT e.app_slug FROM public.app_entitlements e WHERE e.tenant_id = t.id AND e.status IN ('trial','active') ORDER BY e.app_slug) AS app_slugs,
  (SELECT MAX(al.created_at) FROM public.audit_log al WHERE al.store_id = t.id::text OR al.entity_id = t.id::text) AS last_activity
FROM public.tenants t;
GRANT SELECT ON public.tenant_summary TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_active(_tenant_id UUID, _active BOOLEAN) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.tenants SET is_active = _active WHERE id = _tenant_id;
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, details)
  VALUES (CASE WHEN _active THEN 'tenant_reactivated' ELSE 'tenant_suspended' END, 'tenant', _tenant_id::text, auth.uid(), jsonb_build_object('active', _active));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_entitlement(_tenant_id UUID, _app_slug TEXT, _plan_tier TEXT, _status TEXT, _expires_at TIMESTAMPTZ DEFAULT NULL, _seat_limit INTEGER DEFAULT NULL) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.app_entitlements (tenant_id, app_slug, plan_tier, status, expires_at, seat_limit, metadata)
  VALUES (_tenant_id, _app_slug, _plan_tier, _status, _expires_at, _seat_limit, jsonb_build_object('source', 'admin_override', 'by', auth.uid()))
  ON CONFLICT (tenant_id, app_slug) DO UPDATE SET plan_tier = EXCLUDED.plan_tier, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at,
    seat_limit = COALESCE(EXCLUDED.seat_limit, public.app_entitlements.seat_limit),
    metadata = public.app_entitlements.metadata || jsonb_build_object('last_override_by', auth.uid(), 'last_override_at', now())
  RETURNING id INTO v_id;
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, details)
  VALUES ('entitlement_overridden', 'app_entitlement', v_id::text, auth.uid(),
    jsonb_build_object('tenant_id', _tenant_id, 'app_slug', _app_slug, 'plan_tier', _plan_tier, 'status', _status, 'expires_at', _expires_at));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_member_role(_member_id UUID, _role TEXT) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _role NOT IN ('owner','admin','manager','staff') THEN RAISE EXCEPTION 'invalid role %', _role; END IF;
  UPDATE public.tenant_members SET role = _role WHERE id = _member_id;
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, details)
  VALUES ('member_role_changed', 'tenant_member', _member_id::text, auth.uid(), jsonb_build_object('new_role', _role));
  RETURN true;
END;
$$;

-- Invite-only signup
CREATE OR REPLACE FUNCTION public.link_invited_member_to_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tenant_members SET user_id = NEW.id, accepted_at = COALESCE(accepted_at, now())
  WHERE lower(invited_email) = lower(NEW.email) AND (user_id IS NULL OR user_id = NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS link_invited_member_to_user ON auth.users;
CREATE TRIGGER link_invited_member_to_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.link_invited_member_to_user();

CREATE OR REPLACE FUNCTION public.admin_create_tenant(_name TEXT, _slug TEXT, _domain TEXT, _owner_email TEXT, _app_slug TEXT DEFAULT 'autolabels', _plan_tier TEXT DEFAULT 'essential', _trial_days INTEGER DEFAULT 14) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id UUID; v_existing_user UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _owner_email IS NULL OR _owner_email NOT LIKE '%@%' THEN RAISE EXCEPTION 'valid owner_email required'; END IF;
  INSERT INTO public.tenants (name, slug, domain, primary_email, source, is_active)
  VALUES (_name, COALESCE(_slug, lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(md5(random()::text) for 4)), _domain, _owner_email, 'manual', true)
  RETURNING id INTO v_tenant_id;
  INSERT INTO public.onboarding_profiles (tenant_id, display_name, source, completed_at) VALUES (v_tenant_id, _name, 'manual', now());
  INSERT INTO public.app_entitlements (tenant_id, app_slug, plan_tier, status, trial_ends_at, metadata)
  VALUES (v_tenant_id, _app_slug, _plan_tier,
    CASE WHEN _trial_days > 0 THEN 'trial' ELSE 'active' END,
    CASE WHEN _trial_days > 0 THEN now() + (_trial_days || ' days')::INTERVAL ELSE NULL END,
    jsonb_build_object('created_by_admin', auth.uid(), 'source', 'admin_create_tenant'));
  SELECT id INTO v_existing_user FROM auth.users WHERE lower(email) = lower(_owner_email) LIMIT 1;
  IF v_existing_user IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, invited_email, role, accepted_at, invited_by)
    VALUES (v_tenant_id, v_existing_user, _owner_email, 'owner', now(), auth.uid())
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  ELSE
    INSERT INTO public.tenant_members (tenant_id, invited_email, role, invited_by)
    VALUES (v_tenant_id, _owner_email, 'owner', auth.uid())
    ON CONFLICT (tenant_id, invited_email) DO NOTHING;
  END IF;
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, details)
  VALUES ('tenant_created', 'tenant', v_tenant_id::text, auth.uid(),
    jsonb_build_object('name', _name, 'owner_email', _owner_email, 'app_slug', _app_slug, 'plan_tier', _plan_tier));
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_invite_member(_tenant_id UUID, _email TEXT, _role TEXT DEFAULT 'staff') RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_existing_user UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN RAISE EXCEPTION 'valid email required'; END IF;
  IF _role NOT IN ('owner','admin','manager','staff') THEN RAISE EXCEPTION 'invalid role %', _role; END IF;
  SELECT id INTO v_existing_user FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_existing_user IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, invited_email, role, accepted_at, invited_by)
    VALUES (_tenant_id, v_existing_user, _email, _role, now(), auth.uid())
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = _role
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.tenant_members (tenant_id, invited_email, role, invited_by)
    VALUES (_tenant_id, _email, _role, auth.uid())
    ON CONFLICT (tenant_id, invited_email) DO UPDATE SET role = _role
    RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, details)
  VALUES ('member_invited', 'tenant_member', v_id::text, auth.uid(),
    jsonb_build_object('tenant_id', _tenant_id, 'email', _email, 'role', _role));
  RETURN v_id;
END;
$$;

-- Premium VDP
ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS key_specs JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certification JSONB,
  ADD COLUMN IF NOT EXISTS factory_sticker_url TEXT,
  ADD COLUMN IF NOT EXISTS scrape_source_url TEXT,
  ADD COLUMN IF NOT EXISTS scrape_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_estimate JSONB;

CREATE INDEX IF NOT EXISTS idx_vehicle_listings_scrape_source ON public.vehicle_listings (scrape_source_url);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS carfax_dealer_id TEXT,
  ADD COLUMN IF NOT EXISTS autocheck_dealer_id TEXT;

CREATE OR REPLACE FUNCTION public.merge_scraped_vdp(
  _vehicle_id UUID, _source_url TEXT, _photos JSONB, _description TEXT,
  _features JSONB, _key_specs JSONB, _price NUMERIC(10,2) DEFAULT NULL,
  _mileage INTEGER DEFAULT NULL, _options JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.vehicle_listings WHERE id = _vehicle_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'vehicle not found'; END IF;
  IF NOT (v_tenant = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.vehicle_listings SET
    photos = COALESCE(_photos, photos),
    description = COALESCE(_description, description),
    features = COALESCE(_features, features),
    key_specs = COALESCE(_key_specs, key_specs),
    price = COALESCE(_price, price),
    mileage = COALESCE(_mileage, mileage),
    scrape_source_url = _source_url,
    scrape_last_synced_at = now(),
    sticker_snapshot = sticker_snapshot || jsonb_build_object('scraped_options', COALESCE(_options, sticker_snapshot->'scraped_options'))
  WHERE id = _vehicle_id;
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, details)
  VALUES ('vdp_scraped', 'vehicle_listing', _vehicle_id::text, auth.uid(),
    jsonb_build_object('source_url', _source_url, 'photo_count', jsonb_array_length(COALESCE(_photos,'[]'::jsonb))));
  RETURN _vehicle_id;
END;
$$;

-- claim_platform RPC
CREATE OR REPLACE FUNCTION public.claim_platform()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT;
  v_admins INTEGER;
  v_existing UUID;
  v_tenant_id UUID;
  v_already BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  SELECT COUNT(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  SELECT id INTO v_existing FROM public.user_roles WHERE user_id = v_user AND role = 'admin';
  v_already := v_existing IS NOT NULL;
  IF v_admins > 0 AND NOT v_already THEN RAISE EXCEPTION 'already_claimed'; END IF;
  IF NOT v_already THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'autolabels';
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, domain, primary_email, source, is_active)
    VALUES ('AutoLabels.io', 'autolabels', 'autolabels.io', v_email, 'manual', true)
    RETURNING id INTO v_tenant_id;
  END IF;
  INSERT INTO public.onboarding_profiles (tenant_id, display_name, tagline, source, completed_at)
  VALUES (v_tenant_id, 'AutoLabels.io', 'Clear. Compliant. Consistent.', 'manual', now())
  ON CONFLICT (tenant_id) DO UPDATE SET completed_at = COALESCE(public.onboarding_profiles.completed_at, now());
  INSERT INTO public.app_entitlements (tenant_id, app_slug, plan_tier, status, expires_at, metadata)
  VALUES (v_tenant_id, 'autolabels', 'unlimited', 'active', NULL,
    jsonb_build_object('source', 'claim_platform_rpc', 'claimed_by', v_user))
  ON CONFLICT (tenant_id, app_slug) DO UPDATE SET plan_tier = 'unlimited', status = 'active', expires_at = NULL;
  INSERT INTO public.tenant_members (tenant_id, user_id, invited_email, role, accepted_at, invited_by)
  VALUES (v_tenant_id, v_user, v_email, 'owner', now(), v_user)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner', accepted_at = COALESCE(public.tenant_members.accepted_at, now());
  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, user_email, details)
  VALUES ('platform_claimed_rpc', 'platform', v_tenant_id::text, v_user, v_email,
    jsonb_build_object('already_admin', v_already, 'admin_count_before', v_admins));
  RETURN jsonb_build_object('ok', true, 'already_admin', v_already, 'tenant_id', v_tenant_id,
    'message', CASE WHEN v_already THEN 'You are already the admin. Membership + entitlement refreshed.'
                    ELSE 'Platform claimed. You are now the admin of the AutoLabels.io house tenant.' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_platform() TO authenticated;