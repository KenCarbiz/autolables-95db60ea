-- ──────────────────────────────────────────────────────────────────────
-- claim_platform() — Postgres RPC fallback for the claim-platform flow.
--
-- The Edge Function version of this (supabase/functions/claim-platform)
-- requires a separate deploy step that Lovable's Supabase integration
-- doesn't always run automatically. This RPC does the same work, but
-- it ships with the normal SQL migration pipeline — the moment the
-- migration is applied, the function is callable from
-- supabase.rpc('claim_platform').
--
-- Behavior:
--   1. Caller must be authenticated (auth.uid() present).
--   2. Counts rows in public.user_roles where role='admin'.
--   3. If zero: grant the caller admin, create/find the house tenant,
--      upsert the shared onboarding_profiles row, upsert the autolabels
--      app_entitlements row as unlimited/active, attach the caller as
--      the tenant owner, audit-log.
--   4. If already admin (caller is the original admin): idempotent
--      re-run that refreshes owner membership + entitlement.
--   5. If a different admin already exists: RAISE EXCEPTION
--      'already_claimed' so a second user can't self-elevate.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_platform()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_email      TEXT;
  v_admins     INTEGER;
  v_existing   UUID;
  v_tenant_id  UUID;
  v_already    BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  SELECT COUNT(*) INTO v_admins FROM public.user_roles WHERE role = 'admin';
  SELECT id INTO v_existing FROM public.user_roles
    WHERE user_id = v_user AND role = 'admin';
  v_already := v_existing IS NOT NULL;

  IF v_admins > 0 AND NOT v_already THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  -- Grant admin role if we don't have it yet.
  IF NOT v_already THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- House tenant — reuse if someone's already in the DB.
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'autolabels';
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, domain, primary_email, source, is_active)
    VALUES ('AutoLabels.io', 'autolabels', 'autolabels.io', v_email, 'manual', true)
    RETURNING id INTO v_tenant_id;
  END IF;

  INSERT INTO public.onboarding_profiles (
    tenant_id, display_name, tagline, source, completed_at
  ) VALUES (
    v_tenant_id, 'AutoLabels.io', 'Clear. Compliant. Consistent.', 'manual', now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    completed_at = COALESCE(public.onboarding_profiles.completed_at, now());

  INSERT INTO public.app_entitlements (
    tenant_id, app_slug, plan_tier, status, expires_at, metadata
  ) VALUES (
    v_tenant_id, 'autolabels', 'unlimited', 'active', NULL,
    jsonb_build_object('source', 'claim_platform_rpc', 'claimed_by', v_user)
  )
  ON CONFLICT (tenant_id, app_slug) DO UPDATE SET
    plan_tier  = 'unlimited',
    status     = 'active',
    expires_at = NULL;

  INSERT INTO public.tenant_members (
    tenant_id, user_id, invited_email, role, accepted_at, invited_by
  ) VALUES (
    v_tenant_id, v_user, v_email, 'owner', now(), v_user
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'owner',
    accepted_at = COALESCE(public.tenant_members.accepted_at, now());

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, user_email, details
  ) VALUES (
    'platform_claimed_rpc', 'platform', v_tenant_id::text, v_user, v_email,
    jsonb_build_object(
      'already_admin', v_already,
      'admin_count_before', v_admins
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_admin', v_already,
    'tenant_id', v_tenant_id,
    'message', CASE
      WHEN v_already THEN 'You are already the admin. Membership + entitlement refreshed.'
      ELSE 'Platform claimed. You are now the admin of the AutoLabels.io house tenant.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_platform() TO authenticated;
