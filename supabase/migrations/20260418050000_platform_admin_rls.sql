-- ──────────────────────────────────────────────────────────────────────
-- Platform-admin RLS: let users with the 'admin' role read/write across
-- every tenant. Without this, the new /admin Tenants/Members/Billing
-- tabs return empty because every shared_tenant table's RLS restricts
-- reads to the caller's own tenant.
--
-- Policies are additive — existing tenant-scoped policies still apply
-- for non-admin users.
-- ──────────────────────────────────────────────────────────────────────

-- 1. tenants ───────────────────────────────────────────────────────
CREATE POLICY "Admins read all tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all tenants"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tenants"
  ON public.tenants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- 2. tenant_members ────────────────────────────────────────────────
CREATE POLICY "Admins read all members"
  ON public.tenant_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all members"
  ON public.tenant_members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete members"
  ON public.tenant_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert members"
  ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 3. onboarding_profiles ───────────────────────────────────────────
CREATE POLICY "Admins read all profiles"
  ON public.onboarding_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write all profiles"
  ON public.onboarding_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 4. app_entitlements ──────────────────────────────────────────────
CREATE POLICY "Admins read all entitlements"
  ON public.app_entitlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write all entitlements"
  ON public.app_entitlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 5. Helper view: tenant_summary — one row per tenant with rolled-up
--    member count, entitlement count, active apps, and last activity.
--    Read via RLS inherited from the base tables.
CREATE OR REPLACE VIEW public.tenant_summary AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.domain,
  t.source,
  t.is_active,
  t.created_at,
  t.updated_at,
  (SELECT COUNT(*) FROM public.tenant_members m WHERE m.tenant_id = t.id AND m.accepted_at IS NOT NULL) AS member_count,
  (SELECT COUNT(*) FROM public.app_entitlements e WHERE e.tenant_id = t.id AND e.status IN ('trial','active')) AS active_apps,
  ARRAY(
    SELECT e.app_slug
    FROM public.app_entitlements e
    WHERE e.tenant_id = t.id AND e.status IN ('trial','active')
    ORDER BY e.app_slug
  ) AS app_slugs,
  (SELECT MAX(al.created_at) FROM public.audit_log al WHERE al.store_id = t.id::text OR al.entity_id = t.id::text) AS last_activity
FROM public.tenants t;

-- Grant select to authenticated so admin UI can read it. RLS on the
-- underlying tables still applies.
GRANT SELECT ON public.tenant_summary TO authenticated;


-- 6. Admin RPC: suspend / reactivate a tenant. Wraps the is_active
--    toggle in a SECURITY DEFINER so audit_log writes happen even
--    when the admin user doesn't have a direct INSERT policy.
CREATE OR REPLACE FUNCTION public.admin_set_tenant_active(
  _tenant_id UUID,
  _active BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.tenants SET is_active = _active WHERE id = _tenant_id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, details
  ) VALUES (
    CASE WHEN _active THEN 'tenant_reactivated' ELSE 'tenant_suspended' END,
    'tenant', _tenant_id::text, auth.uid(),
    jsonb_build_object('active', _active)
  );
  RETURN true;
END;
$$;


-- 7. Admin RPC: manually override an entitlement. Useful for giving
--    out free trials, extending expirations, or cancelling for cause.
CREATE OR REPLACE FUNCTION public.admin_override_entitlement(
  _tenant_id   UUID,
  _app_slug    TEXT,
  _plan_tier   TEXT,
  _status      TEXT,
  _expires_at  TIMESTAMPTZ DEFAULT NULL,
  _seat_limit  INTEGER     DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.app_entitlements (
    tenant_id, app_slug, plan_tier, status, expires_at, seat_limit, metadata
  ) VALUES (
    _tenant_id, _app_slug, _plan_tier, _status, _expires_at, _seat_limit,
    jsonb_build_object('source', 'admin_override', 'by', auth.uid())
  )
  ON CONFLICT (tenant_id, app_slug) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    seat_limit = COALESCE(EXCLUDED.seat_limit, public.app_entitlements.seat_limit),
    metadata = public.app_entitlements.metadata ||
               jsonb_build_object('last_override_by', auth.uid(),
                                  'last_override_at', now())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, details
  ) VALUES (
    'entitlement_overridden', 'app_entitlement', v_id::text, auth.uid(),
    jsonb_build_object(
      'tenant_id', _tenant_id,
      'app_slug', _app_slug,
      'plan_tier', _plan_tier,
      'status', _status,
      'expires_at', _expires_at
    )
  );

  RETURN v_id;
END;
$$;


-- 8. Admin RPC: change a member's role. Idempotent; audit-logged.
CREATE OR REPLACE FUNCTION public.admin_set_member_role(
  _member_id UUID,
  _role      TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _role NOT IN ('owner','admin','manager','staff') THEN
    RAISE EXCEPTION 'invalid role %', _role;
  END IF;

  UPDATE public.tenant_members SET role = _role WHERE id = _member_id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, details
  ) VALUES (
    'member_role_changed', 'tenant_member', _member_id::text, auth.uid(),
    jsonb_build_object('new_role', _role)
  );
  RETURN true;
END;
$$;
