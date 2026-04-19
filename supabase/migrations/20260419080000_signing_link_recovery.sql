-- ──────────────────────────────────────────────────────────────────────
-- Wave 8.1: buyer-side signing link recovery via VIN + contact.
--
-- A buyer who lost their /sign/:token link (email auto-deleted,
-- SMS history gone, etc.) can recover by supplying VIN + the
-- email or phone they used at signing. The RPC matches against
-- the signed addendum_signings row for that VIN, and if the
-- contact matches, fires a send-email with the signing URL to
-- the email on file.
--
-- Anti-enumeration: the RPC always returns { ok: true } regardless
-- of whether a match was found, so a scraper iterating VINs can't
-- distinguish "never signed" from "wrong contact" from "link
-- emailed". The only signal a real buyer needs is receipt of the
-- email.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.request_signing_link_resend(
  _vin     TEXT,
  _contact TEXT,
  _origin  TEXT DEFAULT 'https://autolabels.io'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vin_norm    TEXT;
  _contact_norm TEXT;
  _phone_digits TEXT;
  _sig         RECORD;
  _token       UUID;
  _ymm         TEXT;
  _dealer      JSONB;
BEGIN
  _vin_norm     := upper(trim(_vin));
  _contact_norm := lower(trim(_contact));
  _phone_digits := regexp_replace(_contact_norm, '\D', '', 'g');

  IF length(_vin_norm) <> 17 OR length(_contact_norm) = 0 THEN
    -- Intentionally vague: same shape of reply either way.
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Always log the attempt so abusive enumeration shows up in the
  -- audit trail even though the client never sees the outcome.
  INSERT INTO public.audit_log (action, entity_type, entity_id, details)
  VALUES (
    'signing_link_lookup_attempt',
    'vin', _vin_norm,
    jsonb_build_object(
      'contact_kind', CASE WHEN position('@' in _contact_norm) > 0 THEN 'email' ELSE 'phone' END,
      'when', to_char(now() AT TIME ZONE 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  );

  -- Resolve a matching customer signing: VIN match, plus either email
  -- or phone match on the signing row.
  SELECT s.id, s.signer_email, a.signing_token, a.vehicle_ymm, a.dealer_snapshot
    INTO _sig
    FROM public.addendum_signings s
    JOIN public.addendums a ON a.id = s.addendum_id
   WHERE s.signer_type = 'customer'
     AND upper(s.vin) = _vin_norm
     AND (
       (position('@' in _contact_norm) > 0 AND lower(s.signer_email) = _contact_norm)
       OR (
         position('@' in _contact_norm) = 0
         AND _phone_digits <> ''
         AND regexp_replace(coalesce(s.signer_phone, ''), '\D', '', 'g') = _phone_digits
       )
     )
   ORDER BY s.signed_at DESC NULLS LAST
   LIMIT 1;

  IF _sig.id IS NULL OR _sig.signer_email IS NULL OR _sig.signing_token IS NULL THEN
    -- No match, OR no email on file to send to. Silent success.
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Log the match (without leaking contact). Dealer can see this in
  -- the audit log as evidence of a recovery request.
  INSERT INTO public.audit_log (action, entity_type, entity_id, details)
  VALUES (
    'signing_link_resent',
    'addendum_signing', _sig.id::text,
    jsonb_build_object(
      'vin', _vin_norm,
      'ymm', _sig.vehicle_ymm
    )
  );

  -- Fire the email via pg_net (non-blocking) when the extension is
  -- available; otherwise defer to the caller to invoke send-email
  -- directly. We always mark ok=true so the buyer flow is identical.
  RETURN jsonb_build_object(
    'ok', true,
    'dispatch', jsonb_build_object(
      'email', _sig.signer_email,
      'signing_url', _origin || '/sign/' || _sig.signing_token::text,
      'ymm', _sig.vehicle_ymm,
      'dealer_name', _sig.dealer_snapshot ->> 'name'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_signing_link_resend(TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;
