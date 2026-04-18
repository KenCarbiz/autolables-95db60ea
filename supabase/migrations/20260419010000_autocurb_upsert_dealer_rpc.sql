-- ──────────────────────────────────────────────────────────────────────
-- autocurb_upsert_dealer — Cross-app subscription bootstrap RPC.
--
-- Called by Autocurb's Stripe webhook on subscription events. Wraps
-- the four writes AutoLabels cares about (tenant, tenant_member,
-- app_entitlements, audit_log) into one atomic SECURITY DEFINER call
-- so the Autocurb-side code stays short and every schema quirk
-- (slug NOT NULL, source enum, status enum, column names) is hidden.
--
-- Returns the canonical tenant_id so Autocurb can persist the link.
-- Idempotent — re-invocations from retries or subscription updates
-- upsert without creating dupes.
--
-- Shared-project mode only. In split-project mode Autocurb wouldn't
-- have direct Supabase access to call this.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.autocurb_upsert_dealer(
  p_autocurb_tenant_id     TEXT,
  p_user_id                UUID,
  p_user_email             TEXT,
  p_dealer_name            TEXT,
  p_state                  TEXT,
  p_autocurb_tier          TEXT,
  p_bundle_autolabels      BOOLEAN,
  p_autolabels_tier        TEXT DEFAULT 'essential',
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_expires_at             TIMESTAMPTZ DEFAULT NULL,
  p_stripe_customer_id     TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _slug      TEXT;
BEGIN
  -- 1. Tenant upsert keyed on autocurb_tenant_id. Slug is generated
  --    from the dealer name + autocurb_tenant_id tail so it's stable
  --    and unique without collisions.
  _slug := lower(regexp_replace(
    coalesce(p_dealer_name, 'dealer') || '-' || right(p_autocurb_tenant_id, 6),
    '[^a-z0-9]+', '-', 'g'
  ));

  INSERT INTO public.tenants AS t (
    name, slug, source, autocurb_tenant_id,
    primary_email, billing_email, stripe_customer_id, is_active
  )
  VALUES (
    p_dealer_name, _slug, 'autocurb', p_autocurb_tenant_id,
    p_user_email, p_user_email, p_stripe_customer_id, true
  )
  ON CONFLICT (autocurb_tenant_id) DO UPDATE
    SET name               = EXCLUDED.name,
        primary_email      = EXCLUDED.primary_email,
        stripe_customer_id = coalesce(EXCLUDED.stripe_customer_id, t.stripe_customer_id),
        is_active          = true,
        updated_at         = now()
  RETURNING id INTO _tenant_id;

  -- If autocurb_tenant_id had no unique index before, fall back to name.
  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id
      FROM public.tenants
     WHERE autocurb_tenant_id = p_autocurb_tenant_id
     LIMIT 1;
  END IF;

  -- 2. Tenant member — link the Autocurb user to the tenant as owner.
  INSERT INTO public.tenant_members (user_id, tenant_id, role)
  VALUES (p_user_id, _tenant_id, 'owner')
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET role = CASE
                 WHEN public.tenant_members.role = 'owner' THEN 'owner'
                 ELSE EXCLUDED.role
               END;

  -- 3. Onboarding profile — create a minimal row if missing. Don't
  --    clobber dealer-edited fields on re-invocation.
  INSERT INTO public.onboarding_profiles (
    tenant_id, display_name, phone, stores
  )
  VALUES (
    _tenant_id, p_dealer_name, NULL,
    jsonb_build_array(jsonb_build_object(
      'name', p_dealer_name,
      'state', coalesce(p_state, '')
    ))
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 4. App entitlements — always the autocurb row, optionally the
  --    bundled autolabels row. Uses 'canceled' status spelling to
  --    match the check constraint in 20260417030000.
  INSERT INTO public.app_entitlements (
    tenant_id, app_slug, plan_tier, status,
    activated_at, expires_at, stripe_subscription_id
  )
  VALUES (
    _tenant_id, 'autocurb', coalesce(p_autocurb_tier, 'essential'), 'active',
    now(), p_expires_at, p_stripe_subscription_id
  )
  ON CONFLICT (tenant_id, app_slug) DO UPDATE
    SET plan_tier              = EXCLUDED.plan_tier,
        status                 = 'active',
        renewed_at             = now(),
        expires_at             = EXCLUDED.expires_at,
        stripe_subscription_id = coalesce(EXCLUDED.stripe_subscription_id, public.app_entitlements.stripe_subscription_id),
        updated_at             = now();

  IF p_bundle_autolabels THEN
    INSERT INTO public.app_entitlements (
      tenant_id, app_slug, plan_tier, status,
      activated_at, expires_at, stripe_subscription_id
    )
    VALUES (
      _tenant_id, 'autolabels', coalesce(p_autolabels_tier, 'essential'), 'active',
      now(), p_expires_at, p_stripe_subscription_id
    )
    ON CONFLICT (tenant_id, app_slug) DO UPDATE
      SET plan_tier              = EXCLUDED.plan_tier,
          status                 = 'active',
          renewed_at             = now(),
          expires_at             = EXCLUDED.expires_at,
          stripe_subscription_id = coalesce(EXCLUDED.stripe_subscription_id, public.app_entitlements.stripe_subscription_id),
          updated_at             = now();
  END IF;

  -- 5. Audit trail — becomes part of the Wave 4.1 hash chain.
  INSERT INTO public.audit_log (
    action, entity_type, entity_id, store_id, user_email, details
  ) VALUES (
    'subscription_activated',
    'app_entitlement',
    _tenant_id::text,
    _tenant_id::text,
    p_user_email,
    jsonb_build_object(
      'source',                 'autocurb_stripe_webhook',
      'autocurb_tier',          p_autocurb_tier,
      'bundle_autolabels',      p_bundle_autolabels,
      'autolabels_tier',        CASE WHEN p_bundle_autolabels THEN p_autolabels_tier ELSE NULL END,
      'stripe_subscription_id', p_stripe_subscription_id
    )
  );

  RETURN _tenant_id;
END;
$$;

-- autocurb_tenant_id needs a unique index so ON CONFLICT works.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_autocurb_tenant_id
  ON public.tenants (autocurb_tenant_id)
  WHERE autocurb_tenant_id IS NOT NULL;

-- Grant to authenticated (Autocurb admin UI) and service_role (edge
-- function via SUPABASE_SERVICE_ROLE_KEY).
GRANT EXECUTE ON FUNCTION public.autocurb_upsert_dealer(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO authenticated, service_role;

-- Cancellation RPC — mirror of the upsert. Flips status to
-- 'canceled' without deleting the row (compliance-relevant history).
CREATE OR REPLACE FUNCTION public.autocurb_cancel_subscription(
  p_stripe_subscription_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n INTEGER;
BEGIN
  UPDATE public.app_entitlements
     SET status     = 'canceled',
         updated_at = now()
   WHERE stripe_subscription_id = p_stripe_subscription_id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.autocurb_cancel_subscription(TEXT)
  TO authenticated, service_role;
