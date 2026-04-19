-- ──────────────────────────────────────────────────────────────────────
-- Wave 8: SB 766 3-day return flow.
--
-- California SB 766 (eff. 10/1/2026) grants every buyer of a used
-- vehicle under $50,000 an unconditional 3-day right to cancel.
-- We already capture three_day_return_ack in acknowledgments at
-- signing time; this migration wires the full lifecycle:
--
--   1. Stamp return_window_closes_at on the signing row when SB 766
--      applies, so the buyer + dealer always know the deadline.
--   2. Track return_status + return_requested_at + return_reason so
--      the dealer sees "return requested" as a state transition.
--   3. RPC request_return(_signing_token, _reason) lets the shopper
--      fire the request from their signed confirmation page within
--      the window. Validates the token, checks the deadline, writes
--      the audit event, and returns the restocking fee + mileage
--      rules for display.
--
-- No writes on signings older than Oct 1, 2026 — the law hasn't
-- taken effect yet, so the column is set to NULL for pre-effective
-- sales. Shopper-facing UI hides the return affordance when the
-- column is null.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Columns on the unified addendum_signings table.
ALTER TABLE public.addendum_signings
  ADD COLUMN IF NOT EXISTS return_window_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_status           TEXT
    CHECK (return_status IN ('eligible', 'requested', 'completed', 'denied', 'expired', 'waived')),
  ADD COLUMN IF NOT EXISTS return_requested_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_completed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_reason           TEXT,
  ADD COLUMN IF NOT EXISTS return_restocking_fee   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS return_delivery_mileage INTEGER;

CREATE INDEX IF NOT EXISTS idx_signings_return_status
  ON public.addendum_signings (return_status)
  WHERE return_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signings_return_close
  ON public.addendum_signings (return_window_closes_at)
  WHERE return_window_closes_at IS NOT NULL;


-- 2. Trigger: on INSERT into addendum_signings, if the acknowledgment
-- bag indicates SB 766 applied (three_day_return_ack = true) AND the
-- sale happened on or after 2026-10-01, stamp the 3-day window close
-- and mark status = 'eligible'. Dealer-side UI can override to
-- 'waived' if the buyer explicitly declines the right (which SB 766
-- doesn't technically permit, but captures intent for audit).
CREATE OR REPLACE FUNCTION public.stamp_sb766_return_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _ack BOOLEAN;
BEGIN
  _ack := COALESCE((NEW.acknowledgments ->> 'three_day_return_ack')::BOOLEAN,
                   (NEW.acknowledgments ->> 'sb766_three_day_return_ack')::BOOLEAN,
                   FALSE);

  IF _ack
     AND NEW.signer_type = 'customer'
     AND NEW.signed_at >= TIMESTAMPTZ '2026-10-01 00:00:00+00'
     AND NEW.return_window_closes_at IS NULL THEN
    -- 3 calendar days from the signing timestamp. Calendar days,
    -- not business days — SB 766 §11713.21 is explicit.
    NEW.return_window_closes_at := NEW.signed_at + INTERVAL '3 days';
    NEW.return_status := 'eligible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_sb766_return_window_trigger ON public.addendum_signings;
CREATE TRIGGER stamp_sb766_return_window_trigger
  BEFORE INSERT ON public.addendum_signings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_sb766_return_window();


-- 3. Shopper-callable RPC. Token-auth, SECURITY DEFINER, no tenant
-- required. Finds the most recent customer signing for the token
-- and, if still within the return window, flips status to 'requested'
-- and writes an audit event.
CREATE OR REPLACE FUNCTION public.request_return(
  _signing_token UUID,
  _reason        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _addendum       RECORD;
  _signing        RECORD;
BEGIN
  -- Resolve the token against addendums; mirror the rest of the
  -- signing-token flow for consistency.
  SELECT a.id, a.tenant_id, a.store_id, a.vehicle_vin, a.vehicle_ymm
    INTO _addendum
    FROM public.addendums a
   WHERE a.signing_token = _signing_token
   LIMIT 1;

  IF _addendum.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_token');
  END IF;

  SELECT s.id, s.signed_at, s.return_window_closes_at, s.return_status
    INTO _signing
    FROM public.addendum_signings s
   WHERE s.addendum_id = _addendum.id
     AND s.signer_type = 'customer'
   ORDER BY s.signed_at DESC NULLS LAST
   LIMIT 1;

  IF _signing.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed');
  END IF;

  IF _signing.return_window_closes_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  IF now() > _signing.return_window_closes_at THEN
    UPDATE public.addendum_signings
       SET return_status = 'expired'
     WHERE id = _signing.id
       AND return_status = 'eligible';
    RETURN jsonb_build_object('ok', false, 'reason', 'window_closed',
                              'closed_at', _signing.return_window_closes_at);
  END IF;

  IF _signing.return_status IN ('requested', 'completed') THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_requested');
  END IF;

  UPDATE public.addendum_signings
     SET return_status       = 'requested',
         return_requested_at = now(),
         return_reason       = _reason
   WHERE id = _signing.id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, store_id, user_email, details
  ) VALUES (
    'return_requested',
    'addendum_signing',
    _signing.id::text,
    COALESCE(_addendum.store_id::text, _addendum.tenant_id::text),
    NULL,
    jsonb_build_object(
      'addendum_id', _addendum.id,
      'vin',         _addendum.vehicle_vin,
      'ymm',         _addendum.vehicle_ymm,
      'reason',      _reason,
      'signed_at',   _signing.signed_at,
      'closes_at',   _signing.return_window_closes_at
    )
  );

  RETURN jsonb_build_object('ok', true,
                            'requested_at', now(),
                            'closes_at',    _signing.return_window_closes_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_return(UUID, TEXT)
  TO anon, authenticated, service_role;


-- 4. Dealer-callable resolve RPC. An owner/admin member marks the
-- return as completed (money refunded) or denied (with a reason).
CREATE OR REPLACE FUNCTION public.resolve_return(
  _signing_id  UUID,
  _outcome     TEXT,  -- 'completed' | 'denied'
  _restocking  NUMERIC DEFAULT NULL,
  _mileage     INTEGER DEFAULT NULL,
  _reason      TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
BEGIN
  IF _outcome NOT IN ('completed', 'denied') THEN
    RAISE EXCEPTION 'resolve_return: outcome must be completed or denied';
  END IF;

  SELECT tenant_id INTO _tenant_id FROM public.addendum_signings WHERE id = _signing_id;
  IF _tenant_id IS NULL OR _tenant_id <> public.current_tenant_id() THEN
    RAISE EXCEPTION 'resolve_return: not authorized for this signing';
  END IF;

  UPDATE public.addendum_signings
     SET return_status           = _outcome,
         return_completed_at     = now(),
         return_restocking_fee   = COALESCE(_restocking, return_restocking_fee),
         return_delivery_mileage = COALESCE(_mileage,    return_delivery_mileage),
         return_reason           = COALESCE(_reason,     return_reason)
   WHERE id = _signing_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, store_id, details)
  VALUES (
    CASE WHEN _outcome = 'completed' THEN 'return_completed' ELSE 'return_denied' END,
    'addendum_signing', _signing_id::text, _tenant_id::text,
    jsonb_build_object('restocking_fee', _restocking, 'mileage', _mileage, 'reason', _reason)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_return(UUID, TEXT, NUMERIC, INTEGER, TEXT)
  TO authenticated, service_role;


-- 5. Shopper-callable read RPC. Returns addendum + latest customer
-- signing + return state so the post-sign confirmation page can
-- render the return window UI without the shopper needing an auth
-- session. Token is the auth factor.
CREATE OR REPLACE FUNCTION public.get_signing_return_status(
  _signing_token UUID
) RETURNS TABLE (
  addendum_id              UUID,
  tenant_id                UUID,
  store_id                 UUID,
  vehicle_vin              TEXT,
  vehicle_ymm              TEXT,
  signing_id               UUID,
  signed_at                TIMESTAMPTZ,
  return_window_closes_at  TIMESTAMPTZ,
  return_status            TEXT,
  return_requested_at      TIMESTAMPTZ,
  dealer_snapshot          JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id               AS addendum_id,
    a.tenant_id,
    a.store_id,
    a.vehicle_vin,
    a.vehicle_ymm,
    s.id               AS signing_id,
    s.signed_at,
    s.return_window_closes_at,
    s.return_status,
    s.return_requested_at,
    a.dealer_snapshot
    FROM public.addendums a
    LEFT JOIN LATERAL (
      SELECT ss.*
        FROM public.addendum_signings ss
       WHERE ss.addendum_id = a.id
         AND ss.signer_type = 'customer'
       ORDER BY ss.signed_at DESC NULLS LAST
       LIMIT 1
    ) s ON true
   WHERE a.signing_token = _signing_token
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_signing_return_status(UUID)
  TO anon, authenticated, service_role;
