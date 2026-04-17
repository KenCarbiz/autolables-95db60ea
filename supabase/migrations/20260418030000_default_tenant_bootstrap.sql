-- ──────────────────────────────────────────────────────────────────────
-- Default-tenant bootstrap for the platform-operator account.
--
-- The super-admin (ken@ken.cc) should never be funneled through the
-- dealer onboarding wizard. EntitlementGate already short-circuits for
-- admin role, but we also want a real tenant row to exist so sticker
-- and listing flows that read `currentStore` have something to bind to.
--
-- This migration:
--   1. Creates a house tenant "AutoLabels.io" (source='manual') with a
--      canonical slug, if it doesn't already exist.
--   2. Populates its onboarding_profiles row so the wizard doesn't
--      re-prompt.
--   3. Activates the autolabels app_entitlement on the house tenant.
--   4. Backfills ken@ken.cc's auth.users row as the tenant's owner.
--   5. Adds an AFTER INSERT trigger on auth.users so any future
--      super-admin sign-up is auto-linked as owner of the house tenant.
--
-- Idempotent: re-running is safe.
-- ──────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_tenant_id UUID;
  v_ken UUID;
BEGIN
  -- 1. House tenant
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'autolabels';
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, domain, primary_email, source, is_active)
    VALUES (
      'AutoLabels.io',
      'autolabels',
      'autolabels.io',
      'ken@ken.cc',
      'manual',
      true
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  -- 2. Onboarding profile (mark complete so the wizard never runs)
  INSERT INTO public.onboarding_profiles (
    tenant_id, display_name, tagline, primary_color, secondary_color,
    website, source, completed_at
  ) VALUES (
    v_tenant_id,
    'AutoLabels.io',
    'Clear. Compliant. Consistent.',
    '#1E90FF',
    '#0B2041',
    'https://autolabels.io',
    'manual',
    now()
  ) ON CONFLICT (tenant_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    tagline = EXCLUDED.tagline,
    completed_at = COALESCE(public.onboarding_profiles.completed_at, now());

  -- 3. Activate the autolabels app entitlement on the house tenant.
  INSERT INTO public.app_entitlements (
    tenant_id, app_slug, plan_tier, status
  ) VALUES (
    v_tenant_id, 'autolabels', 'unlimited', 'active'
  ) ON CONFLICT (tenant_id, app_slug) DO UPDATE SET
    plan_tier = 'unlimited',
    status = 'active',
    expires_at = NULL;

  -- 4. Owner membership for ken@ken.cc (backfill if the auth row exists)
  SELECT id INTO v_ken FROM auth.users WHERE lower(email) = 'ken@ken.cc' LIMIT 1;
  IF v_ken IS NOT NULL THEN
    INSERT INTO public.tenant_members (
      tenant_id, user_id, role, accepted_at, invited_by
    ) VALUES (
      v_tenant_id, v_ken, 'owner', now(), v_ken
    ) ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      role = 'owner',
      accepted_at = COALESCE(public.tenant_members.accepted_at, now());
  END IF;
END$$;

-- 5. Trigger for future sign-ups. Any future super-admin email gets
--    auto-attached to the house tenant as owner AND gets the admin
--    role (this overlaps super_admin_bootstrap, but is idempotent so
--    running both is fine).
CREATE OR REPLACE FUNCTION public.attach_super_admin_to_house_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF lower(NEW.email) NOT IN ('ken@ken.cc') THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'autolabels';
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_members (
      tenant_id, user_id, role, accepted_at, invited_by
    ) VALUES (
      v_tenant_id, NEW.id, 'owner', now(), NEW.id
    ) ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attach_super_admin_to_house_tenant ON auth.users;
CREATE TRIGGER attach_super_admin_to_house_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.attach_super_admin_to_house_tenant();
