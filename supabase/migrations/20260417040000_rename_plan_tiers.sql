-- ──────────────────────────────────────────────────────────────
-- Rename plan tiers to match the productized pricing:
--   sticker     -> essential       ($299/mo, up to 75 VINs)
--   compliance  -> unlimited       ($499/mo, unlimited)
--   enterprise  -> compliance_pro  ($999/mo, full FTC flow)
--
-- Updates the default on app_entitlements + bootstrap_tenant()
-- so new signups land on "essential" instead of the old "sticker".
-- Also migrates any existing rows that used the legacy keys.
-- ──────────────────────────────────────────────────────────────

-- Rename existing rows (idempotent — only runs if old keys exist).
UPDATE public.app_entitlements SET plan_tier = 'essential'      WHERE plan_tier = 'sticker';
UPDATE public.app_entitlements SET plan_tier = 'unlimited'      WHERE plan_tier = 'compliance';
UPDATE public.app_entitlements SET plan_tier = 'compliance_pro' WHERE plan_tier = 'enterprise';

-- Flip the column default.
ALTER TABLE public.app_entitlements ALTER COLUMN plan_tier SET DEFAULT 'essential';

-- Replace bootstrap_tenant() so direct-signup gets the new default.
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
