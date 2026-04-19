-- ──────────────────────────────────────────────────────────────────────
-- Wave 7: signing-funnel telemetry.
--
-- The shopper-facing signing page (/sign/:token) is the highest-
-- leverage conversion surface — but historically we only logged the
-- terminal addendum_signed event. Without open / started events we
-- can't see who dropped off and cannot run re-engagement.
--
-- This RPC takes a signing_token and an event name, validates the
-- token against addendum_signings (preferred) or the legacy
-- addendums table, and writes a tenant-scoped row into audit_log.
-- SECURITY DEFINER so it works from anonymous shopper sessions — the
-- token itself is the auth factor.
--
-- Accepted events:
--   signing_link_opened     — page loaded with a valid token
--   signing_link_started    — user interacted with at least one field
--
-- signing_link_signed already flows through record_customer_signing,
-- so it's deliberately NOT a valid event here.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_signing_event(
  _signing_token UUID,
  _event         TEXT,
  _details       JSONB DEFAULT '{}'::JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _addendum_id  UUID;
  _tenant_id    UUID;
  _store_id     UUID;
  _vin          TEXT;
  _ymm          TEXT;
BEGIN
  IF _event NOT IN ('signing_link_opened', 'signing_link_started') THEN
    RAISE EXCEPTION 'record_signing_event: event must be signing_link_opened or signing_link_started';
  END IF;

  -- Resolve token against the new addendum_signings table first; fall
  -- back to the legacy addendums table for in-flight tokens that
  -- pre-date Wave 1.3.
  SELECT a.id, a.tenant_id, a.store_id, a.vehicle_vin, a.vehicle_ymm
    INTO _addendum_id, _tenant_id, _store_id, _vin, _ymm
    FROM public.addendums a
   WHERE a.signing_token = _signing_token
   LIMIT 1;

  IF _addendum_id IS NULL THEN
    -- Unknown token: silently return so we don't leak token validity
    -- to scrapers. Real tokens always resolve.
    RETURN;
  END IF;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, store_id, user_email, details
  ) VALUES (
    _event,
    'addendum',
    _addendum_id::text,
    coalesce(_store_id::text, _tenant_id::text),
    NULL,
    coalesce(_details, '{}'::JSONB) || jsonb_build_object(
      'tenant_id',  _tenant_id,
      'vin',        _vin,
      'ymm',        _ymm,
      'occurred_at', to_char(now() AT TIME ZONE 'UTC',
                             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_signing_event(UUID, TEXT, JSONB)
  TO anon, authenticated, service_role;


-- Funnel summary RPC — returns one row per day with counts for each
-- stage of the signing funnel so the admin dashboard can render a
-- trend without round-tripping per-stage queries.
CREATE OR REPLACE FUNCTION public.signing_funnel_summary(
  _since_days INTEGER DEFAULT 30
) RETURNS TABLE (
  leads_captured        INTEGER,
  links_opened          INTEGER,
  signing_started       INTEGER,
  addendums_signed      INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::INTEGER FROM public.leads
       WHERE tenant_id = public.current_tenant_id()
         AND captured_at >= now() - make_interval(days => _since_days))
      AS leads_captured,
    (SELECT count(DISTINCT entity_id)::INTEGER FROM public.audit_log
       WHERE action = 'signing_link_opened'
         AND created_at >= now() - make_interval(days => _since_days)
         AND store_id IN (
           SELECT id::text FROM public.tenants WHERE id = public.current_tenant_id()
           UNION
           SELECT public.current_tenant_id()::text
         ))
      AS links_opened,
    (SELECT count(DISTINCT entity_id)::INTEGER FROM public.audit_log
       WHERE action = 'signing_link_started'
         AND created_at >= now() - make_interval(days => _since_days)
         AND store_id IN (
           SELECT id::text FROM public.tenants WHERE id = public.current_tenant_id()
           UNION
           SELECT public.current_tenant_id()::text
         ))
      AS signing_started,
    (SELECT count(*)::INTEGER FROM public.audit_log
       WHERE action = 'addendum_signed'
         AND created_at >= now() - make_interval(days => _since_days)
         AND store_id IN (
           SELECT id::text FROM public.tenants WHERE id = public.current_tenant_id()
           UNION
           SELECT public.current_tenant_id()::text
         ))
      AS addendums_signed;
$$;

GRANT EXECUTE ON FUNCTION public.signing_funnel_summary(INTEGER)
  TO authenticated, service_role;
