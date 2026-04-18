-- ──────────────────────────────────────────────────────────────────────
-- Wave 1.3A — Unified addendum_signings table + SECURITY DEFINER RPC
--
-- Today signing lives in three partially-overlapping places:
--   1. addendums.customer_signature_data / employee_signature_data
--      (Index.tsx — employee-built, customer-signed)
--   2. deal_signing_tokens.signed_payload (DealSigning.tsx — customer
--      deal-jacket flow)
--   3. prep_sign_offs.foreman_signature_data (PrepSignOff.tsx)
--
-- Three different columns shapes, three different audit paths, no
-- single query answers "every signature for VIN X". This table is
-- the single destination for signer events. The existing rows stay
-- as legacy backups; new code writes here.
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.addendum_signings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Context links (all nullable; at least one should be set)
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  addendum_id         UUID REFERENCES public.addendums(id) ON DELETE SET NULL,
  deal_token_id      UUID REFERENCES public.deal_signing_tokens(id) ON DELETE SET NULL,
  vehicle_listing_id  UUID REFERENCES public.vehicle_listings(id) ON DELETE SET NULL,
  prep_sign_off_id   UUID REFERENCES public.prep_sign_offs(id) ON DELETE SET NULL,
  vin                 TEXT,

  -- Who signed
  signer_type         TEXT NOT NULL
                        CHECK (signer_type IN (
                          'customer', 'cobuyer',
                          'employee', 'salesperson', 'finance_manager',
                          'foreman', 'service_writer',
                          'dealer_principal', 'other'
                        )),
  signer_name         TEXT,
  signer_email        TEXT,
  signer_phone        TEXT,

  -- The signature payload
  signature_data      TEXT,                     -- base64 PNG OR typed name
  signature_type      TEXT CHECK (signature_type IN ('draw', 'type')),

  -- Provenance & non-repudiation
  ip_address          TEXT,
  user_agent          TEXT,
  signing_location    JSONB,                    -- { lat, lon, accuracy }
  content_hash        TEXT,                     -- SHA-256 canonical payload hash
  esign_consent       JSONB,                    -- version + disclosures shown
  canonical_payload   JSONB,                    -- snapshot of everything signed

  -- Acknowledgments (flex bag so new state rules don't require DDL)
  acknowledgments     JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                -- { warranty_ack, sticker_match_ack,
                                                --   buyers_guide_ack, k208_ack,
                                                --   three_day_return_ack, ... }

  -- Delivery-time values
  delivery_mileage    INTEGER,
  price_overrides     JSONB,

  -- Timestamps are server-authoritative (NTP-anchored); client ISO
  -- strings are stored in canonical_payload for reference only.
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signings_tenant   ON public.addendum_signings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_signings_addendum ON public.addendum_signings (addendum_id);
CREATE INDEX IF NOT EXISTS idx_signings_deal     ON public.addendum_signings (deal_token_id);
CREATE INDEX IF NOT EXISTS idx_signings_vehicle  ON public.addendum_signings (vehicle_listing_id);
CREATE INDEX IF NOT EXISTS idx_signings_prep     ON public.addendum_signings (prep_sign_off_id);
CREATE INDEX IF NOT EXISTS idx_signings_vin      ON public.addendum_signings (vin);
CREATE INDEX IF NOT EXISTS idx_signings_signer   ON public.addendum_signings (signer_type);
CREATE INDEX IF NOT EXISTS idx_signings_time     ON public.addendum_signings (signed_at DESC);

ALTER TABLE public.addendum_signings ENABLE ROW LEVEL SECURITY;

-- Authenticated tenant members read their tenant's signings.
CREATE POLICY "Tenant members read signings"
  ON public.addendum_signings FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND EXISTS (
      -- Legacy rows from before tenant_id was enforced — only visible
      -- to an admin or the linked entity's creator.
      SELECT 1 FROM public.addendums a
      WHERE a.id = addendum_signings.addendum_id
        AND a.created_by = auth.uid()
    ))
  );

-- Authenticated members insert employee / salesperson / finance / foreman
-- signings for their own tenant.
CREATE POLICY "Tenant members insert employee signings"
  ON public.addendum_signings FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
    AND signer_type IN (
      'employee', 'salesperson', 'finance_manager', 'foreman',
      'service_writer', 'dealer_principal', 'other'
    )
  );

-- Admins read + write across tenants.
CREATE POLICY "Platform admins read all signings"
  ON public.addendum_signings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins write all signings"
  ON public.addendum_signings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-fill tenant_id from the caller's current tenant so the
-- signing UIs don't need to pass it in explicitly.
CREATE TRIGGER set_tenant_id_signings
  BEFORE INSERT ON public.addendum_signings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();


-- ──────────────────────────────────────────────────────────────
-- record_customer_signing — anon-callable RPC that validates the
-- signing token before writing the customer's signature row.
--
-- The anon Supabase client has no tenant context, so a direct INSERT
-- policy for anon users would be easy to abuse (anyone with a token
-- could spray rows). Instead anon callers go through this RPC which:
--   1. Resolves the addendum by signing_token (addendums) or by
--      deal token (deal_signing_tokens).
--   2. Refuses if the record is already signed or the token has
--      expired.
--   3. Writes one addendum_signings row scoped to the correct tenant.
--
-- Returns the new signing id.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_customer_signing(
  _signing_token      TEXT,
  _signer_type        TEXT,
  _signer_name        TEXT,
  _signer_email       TEXT,
  _signer_phone       TEXT,
  _signature_data     TEXT,
  _signature_type     TEXT,
  _ip_address         TEXT,
  _user_agent         TEXT,
  _signing_location   JSONB,
  _content_hash       TEXT,
  _esign_consent      JSONB,
  _canonical_payload  JSONB,
  _acknowledgments    JSONB,
  _delivery_mileage   INTEGER,
  _price_overrides    JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addendum   public.addendums%ROWTYPE;
  v_deal       public.deal_signing_tokens%ROWTYPE;
  v_tenant_id  UUID;
  v_vehicle_id UUID;
  v_vin        TEXT;
  v_id         UUID;
BEGIN
  IF _signer_type NOT IN ('customer','cobuyer') THEN
    RAISE EXCEPTION 'only customer/cobuyer signings accepted via this RPC';
  END IF;

  -- Try addendum token first
  SELECT * INTO v_addendum FROM public.addendums
    WHERE signing_token = _signing_token AND status <> 'signed'
    LIMIT 1;

  IF FOUND THEN
    v_tenant_id := v_addendum.tenant_id;
    v_vin       := v_addendum.vehicle_vin;
    -- Legacy fields on addendums get mirrored for backward compat
    UPDATE public.addendums SET
      status = CASE WHEN _signer_type = 'customer' THEN 'signed' ELSE status END,
      customer_name = COALESCE(_signer_name, customer_name),
      customer_signature_data = CASE WHEN _signer_type = 'customer' THEN _signature_data ELSE customer_signature_data END,
      customer_signature_type = CASE WHEN _signer_type = 'customer' THEN _signature_type ELSE customer_signature_type END,
      customer_signed_at = CASE WHEN _signer_type = 'customer' THEN now() ELSE customer_signed_at END,
      content_hash = _content_hash,
      esign_consent = _esign_consent,
      user_agent = _user_agent,
      customer_ip = _ip_address,
      signing_location = _signing_location
    WHERE id = v_addendum.id;

    INSERT INTO public.addendum_signings (
      tenant_id, addendum_id, vin, signer_type,
      signer_name, signer_email, signer_phone,
      signature_data, signature_type,
      ip_address, user_agent, signing_location,
      content_hash, esign_consent, canonical_payload, acknowledgments,
      delivery_mileage, price_overrides
    ) VALUES (
      v_tenant_id, v_addendum.id, v_vin, _signer_type,
      _signer_name, _signer_email, _signer_phone,
      _signature_data, _signature_type,
      _ip_address, _user_agent, _signing_location,
      _content_hash, _esign_consent, _canonical_payload, COALESCE(_acknowledgments, '{}'::jsonb),
      _delivery_mileage, _price_overrides
    ) RETURNING id INTO v_id;

    INSERT INTO public.audit_log (
      action, entity_type, entity_id, store_id, content_hash,
      ip_address, user_agent, details
    ) VALUES (
      'addendum_signed', 'addendum', v_addendum.id::text, v_tenant_id::text, _content_hash,
      _ip_address, _user_agent,
      jsonb_build_object('signer_type', _signer_type, 'signing_id', v_id, 'vin', v_vin)
    );

    RETURN v_id;
  END IF;

  -- Fall back to deal_signing_tokens
  SELECT * INTO v_deal FROM public.deal_signing_tokens
    WHERE token = _signing_token AND status = 'pending' AND expires_at > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid or expired signing token';
  END IF;

  v_tenant_id := v_deal.tenant_id;
  v_vin       := (v_deal.vehicle_payload->>'vin');

  UPDATE public.deal_signing_tokens SET
    status = 'signed',
    signed_payload = _canonical_payload,
    content_hash = _content_hash,
    customer_ip = _ip_address,
    user_agent = _user_agent,
    esign_consent = _esign_consent,
    signed_at = now(),
    updated_at = now()
  WHERE id = v_deal.id;

  INSERT INTO public.addendum_signings (
    tenant_id, deal_token_id, vin, signer_type,
    signer_name, signer_email, signer_phone,
    signature_data, signature_type,
    ip_address, user_agent, signing_location,
    content_hash, esign_consent, canonical_payload, acknowledgments,
    delivery_mileage, price_overrides
  ) VALUES (
    v_tenant_id, v_deal.id, v_vin, _signer_type,
    _signer_name, _signer_email, _signer_phone,
    _signature_data, _signature_type,
    _ip_address, _user_agent, _signing_location,
    _content_hash, _esign_consent, _canonical_payload, COALESCE(_acknowledgments, '{}'::jsonb),
    _delivery_mileage, _price_overrides
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, store_id, content_hash,
    ip_address, user_agent, details
  ) VALUES (
    'deal_signed', 'deal_signing_token', v_deal.id::text, v_tenant_id::text, _content_hash,
    _ip_address, _user_agent,
    jsonb_build_object('signer_type', _signer_type, 'signing_id', v_id, 'vin', v_vin)
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_customer_signing(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT,
  JSONB, JSONB, JSONB, INTEGER, JSONB
) TO anon, authenticated;


-- ──────────────────────────────────────────────────────────────
-- addendum_signings_full — convenience view that joins each signing
-- to its vehicle, tenant, and tenant name so the ComplianceCenter
-- packet + Platform Audit tab can render a one-row-per-signature
-- answer to "what got signed for this VIN" without five joins.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.addendum_signings_full AS
SELECT
  s.id,
  s.tenant_id,
  t.name AS tenant_name,
  s.addendum_id,
  s.deal_token_id,
  s.vehicle_listing_id,
  s.prep_sign_off_id,
  s.vin,
  s.signer_type,
  s.signer_name,
  s.signer_email,
  s.signer_phone,
  s.signature_type,
  s.ip_address,
  s.content_hash,
  s.signed_at,
  s.acknowledgments,
  s.delivery_mileage
FROM public.addendum_signings s
LEFT JOIN public.tenants t ON t.id = s.tenant_id;

GRANT SELECT ON public.addendum_signings_full TO authenticated;
