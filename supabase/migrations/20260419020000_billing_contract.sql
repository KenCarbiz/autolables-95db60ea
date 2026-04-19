-- ──────────────────────────────────────────────────────────────────────
-- Wave 5.1: Billing contract — the shared pipe Autocurb.io writes into.
--
-- Autocurb.io is the central billing hub. Its stripe-webhook edge
-- function receives every Stripe event across the family, walks the
-- subscription's items, reads price.metadata.app_slug +
-- price.metadata.includes_apps, and calls this one RPC with the full
-- desired entitlement state for the tenant. The RPC is idempotent:
-- call it with the same arguments twice, get the same state.
--
-- Contract in one sentence: "For this tenant and this subscription,
-- the set of apps that should be active is exactly this array. Make
-- it so." The RPC upserts what's in the array, cancels what isn't.
--
-- Price metadata is the API. The RPC never hard-codes which app is
-- which — it reads app_slug and includes_apps from the JSONB payload
-- the webhook built from Stripe. Add a 5th sister app in the future
-- by adding a Stripe Product + Price with metadata.app_slug set.
-- Zero code changes here.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Extend the app_slug CHECK to cover the planned sister apps.
--    Keep 'autovideo' alongside 'autofilm' so in-flight rows from
--    earlier migrations still validate.
ALTER TABLE public.app_entitlements
  DROP CONSTRAINT IF EXISTS app_entitlements_app_slug_check;
ALTER TABLE public.app_entitlements
  ADD CONSTRAINT app_entitlements_app_slug_check
  CHECK (app_slug IN (
    'autolabels', 'autocurb', 'autoframe', 'autofilm', 'autovideo'
  ));

-- 2. Per-item Stripe id so the webhook can update one line without
--    touching the others.
ALTER TABLE public.app_entitlements
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_entitlements_stripe_item
  ON public.app_entitlements (stripe_subscription_item_id)
  WHERE stripe_subscription_item_id IS NOT NULL;

-- 3. The sync RPC. Called by Autocurb's stripe-webhook on every
--    customer.subscription.* event. Input shape:
--
--    p_items = [
--      {
--        "app_slug": "autolabels",              -- from price.metadata
--        "plan_tier": "essential",              -- from price.metadata
--        "status": "active",                    -- from subscription.status
--        "stripe_subscription_id": "sub_xxx",
--        "stripe_subscription_item_id": "si_xxx",
--        "expires_at": "2026-05-19T00:00:00Z",  -- current_period_end
--        "includes_apps": ["autolabels"]        -- normally 1 slug,
--                                               -- bundles list all 4
--      },
--      ...
--    ]
--
--    For each included app the RPC upserts a row. Any existing row
--    on the SAME subscription whose app_slug isn't in the active set
--    is marked 'canceled' (dealer removed an à-la-carte app). Rows
--    attached to a different subscription or a non-Stripe grant are
--    never touched.
CREATE OR REPLACE FUNCTION public.autocurb_sync_entitlements(
  p_tenant_id UUID,
  p_items     JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item         JSONB;
  _app          TEXT;
  _sub_id       TEXT;
  _active_apps  TEXT[] := '{}';
  _item_count   INT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSONB array';
  END IF;

  _item_count := jsonb_array_length(p_items);
  IF _item_count = 0 THEN
    RETURN;
  END IF;

  -- Pull subscription id from the first item. All items in one sync
  -- call share a subscription (they're the items of one subscription
  -- object, per Stripe webhook semantics).
  _sub_id := p_items->0->>'stripe_subscription_id';

  FOR _item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Each item may include 1..N app slugs (bundles fan out). If
    -- includes_apps isn't set, fall back to the item's own app_slug.
    FOR _app IN
      SELECT jsonb_array_elements_text(
        coalesce(
          _item->'includes_apps',
          jsonb_build_array(_item->>'app_slug')
        )
      )
    LOOP
      _active_apps := array_append(_active_apps, _app);

      INSERT INTO public.app_entitlements AS e (
        tenant_id, app_slug, plan_tier, status,
        stripe_subscription_id, stripe_subscription_item_id,
        expires_at, activated_at, updated_at
      ) VALUES (
        p_tenant_id,
        _app,
        coalesce(_item->>'plan_tier', 'essential'),
        coalesce(_item->>'status',    'active'),
        _item->>'stripe_subscription_id',
        _item->>'stripe_subscription_item_id',
        NULLIF(_item->>'expires_at', '')::TIMESTAMPTZ,
        now(),
        now()
      )
      ON CONFLICT (tenant_id, app_slug) DO UPDATE
        SET plan_tier                   = EXCLUDED.plan_tier,
            status                      = EXCLUDED.status,
            stripe_subscription_id      = EXCLUDED.stripe_subscription_id,
            stripe_subscription_item_id = EXCLUDED.stripe_subscription_item_id,
            expires_at                  = EXCLUDED.expires_at,
            renewed_at                  = CASE
                                            WHEN EXCLUDED.status = 'active'
                                              AND e.status <> 'active'
                                            THEN now()
                                            ELSE e.renewed_at
                                          END,
            updated_at                  = now();
    END LOOP;
  END LOOP;

  -- Cancel entitlements on THIS subscription that weren't in the
  -- active set (dealer removed an à-la-carte app, or the bundle
  -- dropped its roll-up of one of the sister apps).
  UPDATE public.app_entitlements
     SET status     = 'canceled',
         updated_at = now()
   WHERE tenant_id = p_tenant_id
     AND stripe_subscription_id = _sub_id
     AND NOT (app_slug = ANY(_active_apps));

  -- Audit trail — flows into the Wave 4.1 hash chain.
  INSERT INTO public.audit_log (
    action, entity_type, entity_id, store_id, user_email, details
  ) VALUES (
    'entitlements_synced',
    'app_entitlements',
    p_tenant_id::text,
    p_tenant_id::text,
    NULL,
    jsonb_build_object(
      'source',                 'autocurb_stripe_webhook',
      'stripe_subscription_id', _sub_id,
      'active_apps',            to_jsonb(_active_apps),
      'item_count',             _item_count
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.autocurb_sync_entitlements(UUID, JSONB)
  TO authenticated, service_role;

-- 4. Small companion: a read-side helper for the central billing UI
--    so Autocurb doesn't need to duplicate entitlement-selection SQL.
CREATE OR REPLACE FUNCTION public.get_tenant_billing_summary(
  p_tenant_id UUID
) RETURNS TABLE (
  app_slug                    TEXT,
  plan_tier                   TEXT,
  status                      TEXT,
  stripe_subscription_id      TEXT,
  stripe_subscription_item_id TEXT,
  activated_at                TIMESTAMPTZ,
  expires_at                  TIMESTAMPTZ,
  renewed_at                  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_slug, plan_tier, status,
         stripe_subscription_id, stripe_subscription_item_id,
         activated_at, expires_at, renewed_at
    FROM public.app_entitlements
   WHERE tenant_id = p_tenant_id
   ORDER BY app_slug;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_billing_summary(UUID)
  TO authenticated, service_role;
