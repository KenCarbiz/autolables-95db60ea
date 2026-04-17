-- ──────────────────────────────────────────────────────────────────────
-- Invite-only sign-up: link auth.users to pending tenant_members by email.
--
-- Flow:
--   1. Super-admin creates a tenant via /admin → Tenants → New Tenant.
--      That action inserts a tenants row, an onboarding_profiles row,
--      an app_entitlements row, AND a tenant_members row carrying
--      (tenant_id, invited_email, role='owner', user_id=NULL,
--      accepted_at=NULL).
--
--   2. The dealer signs up on /login with the invited email.
--      auth.users row is created.
--
--   3. This trigger fires AFTER INSERT, finds every tenant_members
--      row whose invited_email matches the new user's email, and
--      attaches the user_id + accepted_at. The dealer now has a
--      tenant context without running the onboarding wizard.
--
-- Idempotent — safe to re-run migration. Co-exists with the two
-- existing super_admin_bootstrap triggers on auth.users.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_invited_member_to_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tenant_members
  SET user_id = NEW.id,
      accepted_at = COALESCE(accepted_at, now())
  WHERE lower(invited_email) = lower(NEW.email)
    AND (user_id IS NULL OR user_id = NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_invited_member_to_user ON auth.users;
CREATE TRIGGER link_invited_member_to_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_invited_member_to_user();

-- Admin RPC: create a full tenant in one shot. Called from the new
-- /admin → Tenants → New Tenant form. Returns the new tenant_id.
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  _name           TEXT,
  _slug           TEXT,
  _domain         TEXT,
  _owner_email    TEXT,
  _app_slug       TEXT DEFAULT 'autolabels',
  _plan_tier      TEXT DEFAULT 'essential',
  _trial_days     INTEGER DEFAULT 14
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_existing_user UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  IF _owner_email IS NULL OR _owner_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'valid owner_email required';
  END IF;

  INSERT INTO public.tenants (name, slug, domain, primary_email, source, is_active)
  VALUES (
    _name,
    COALESCE(_slug, lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' ||
             substring(md5(random()::text) for 4)),
    _domain,
    _owner_email,
    'manual',
    true
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.onboarding_profiles (
    tenant_id, display_name, source, completed_at
  ) VALUES (
    v_tenant_id, _name, 'manual', now()
  );

  INSERT INTO public.app_entitlements (
    tenant_id, app_slug, plan_tier, status, trial_ends_at, metadata
  ) VALUES (
    v_tenant_id, _app_slug, _plan_tier,
    CASE WHEN _trial_days > 0 THEN 'trial' ELSE 'active' END,
    CASE WHEN _trial_days > 0 THEN now() + (_trial_days || ' days')::INTERVAL ELSE NULL END,
    jsonb_build_object('created_by_admin', auth.uid(), 'source', 'admin_create_tenant')
  );

  -- If the owner already has an auth.users row, link directly.
  -- Otherwise insert a pending membership that the invite trigger
  -- will attach when they sign up.
  SELECT id INTO v_existing_user
  FROM auth.users
  WHERE lower(email) = lower(_owner_email)
  LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    INSERT INTO public.tenant_members (
      tenant_id, user_id, invited_email, role, accepted_at, invited_by
    ) VALUES (
      v_tenant_id, v_existing_user, _owner_email, 'owner', now(), auth.uid()
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
  ELSE
    INSERT INTO public.tenant_members (
      tenant_id, invited_email, role, invited_by
    ) VALUES (
      v_tenant_id, _owner_email, 'owner', auth.uid()
    )
    ON CONFLICT (tenant_id, invited_email) DO NOTHING;
  END IF;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, details
  ) VALUES (
    'tenant_created', 'tenant', v_tenant_id::text, auth.uid(),
    jsonb_build_object('name', _name, 'owner_email', _owner_email,
                       'app_slug', _app_slug, 'plan_tier', _plan_tier)
  );

  RETURN v_tenant_id;
END;
$$;

-- Admin RPC: invite an additional member to an existing tenant.
CREATE OR REPLACE FUNCTION public.admin_invite_member(
  _tenant_id UUID,
  _email     TEXT,
  _role      TEXT DEFAULT 'staff'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_existing_user UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'valid email required';
  END IF;
  IF _role NOT IN ('owner','admin','manager','staff') THEN
    RAISE EXCEPTION 'invalid role %', _role;
  END IF;

  SELECT id INTO v_existing_user
  FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    INSERT INTO public.tenant_members (
      tenant_id, user_id, invited_email, role, accepted_at, invited_by
    ) VALUES (
      _tenant_id, v_existing_user, _email, _role, now(), auth.uid()
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = _role
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.tenant_members (
      tenant_id, invited_email, role, invited_by
    ) VALUES (
      _tenant_id, _email, _role, auth.uid()
    )
    ON CONFLICT (tenant_id, invited_email) DO UPDATE SET role = _role
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, details
  ) VALUES (
    'member_invited', 'tenant_member', v_id::text, auth.uid(),
    jsonb_build_object('tenant_id', _tenant_id, 'email', _email, 'role', _role)
  );

  RETURN v_id;
END;
$$;
