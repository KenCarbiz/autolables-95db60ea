-- ──────────────────────────────────────────────────────────────────────
-- AutoLabels.io — Security & Integrity Hardening
--
-- 1. Multi-tenant RLS on vehicle_listings + prep_sign_offs
-- 2. Backend prep-gate: you cannot flip a listing to "published" unless
--    the VIN has a signed prep_sign_off in the same tenant.
-- 3. Seat-limit enforcement on tenant_members.
-- 4. Persisted, expiring deal_signing_tokens (replaces localStorage).
-- 5. CA SB 766 disclosure columns on addendums (eff Oct 1, 2026).
-- ──────────────────────────────────────────────────────────────────────

-- 1A. Add tenant_id to vehicle_listings + prep_sign_offs ────────────
ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_tenant ON public.vehicle_listings (tenant_id);

ALTER TABLE public.prep_sign_offs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_prep_sign_offs_tenant ON public.prep_sign_offs (tenant_id);

-- Auto-fill tenant_id on INSERT from the current user's tenant.
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_id_vehicle_listings ON public.vehicle_listings;
CREATE TRIGGER set_tenant_id_vehicle_listings
  BEFORE INSERT ON public.vehicle_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_tenant_id_prep_sign_offs ON public.prep_sign_offs;
CREATE TRIGGER set_tenant_id_prep_sign_offs
  BEFORE INSERT ON public.prep_sign_offs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();


-- 1B. Tighten RLS on vehicle_listings ──────────────────────────────
-- Replace the loose USING (true) with tenant-scoped policies.
DROP POLICY IF EXISTS "Auth users can view listings" ON public.vehicle_listings;
DROP POLICY IF EXISTS "Auth users can insert listings" ON public.vehicle_listings;
DROP POLICY IF EXISTS "Auth users can update listings" ON public.vehicle_listings;

CREATE POLICY "Tenant members view listings"
  ON public.vehicle_listings FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL  -- legacy rows, visible only to creator
      AND created_by = auth.uid()
    OR tenant_id = public.current_tenant_id()
  );

CREATE POLICY "Tenant members insert listings"
  ON public.vehicle_listings FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant members update listings"
  ON public.vehicle_listings FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 1C. Tighten RLS on prep_sign_offs ────────────────────────────────
DROP POLICY IF EXISTS "Auth users can view prep sign-offs" ON public.prep_sign_offs;
DROP POLICY IF EXISTS "Auth users can create prep sign-offs" ON public.prep_sign_offs;
DROP POLICY IF EXISTS "Creator or admin can update prep sign-offs" ON public.prep_sign_offs;

CREATE POLICY "Tenant members view prep sign-offs"
  ON public.prep_sign_offs FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL AND created_by = auth.uid()
    OR tenant_id = public.current_tenant_id()
  );

CREATE POLICY "Tenant members create prep sign-offs"
  ON public.prep_sign_offs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant members update prep sign-offs"
  ON public.prep_sign_offs FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );


-- 2. Backend prep-gate trigger ─────────────────────────────────────
-- Cannot transition a listing to "published" unless the matching
-- VIN in the same tenant has a prep_sign_off row with
-- listing_unlocked = true. An admin override bypasses.
CREATE OR REPLACE FUNCTION public.enforce_prep_gate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unlocked BOOLEAN;
BEGIN
  -- Only fire when transitioning into "published"
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN

    IF public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;

    SELECT listing_unlocked INTO v_unlocked
      FROM public.prep_sign_offs
      WHERE vin = NEW.vin
        AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
        AND listing_unlocked = true
      ORDER BY signed_at DESC NULLS LAST, created_at DESC
      LIMIT 1;

    IF v_unlocked IS NOT TRUE THEN
      RAISE EXCEPTION 'prep_gate_blocked: vehicle % has no signed prep_sign_off with listing_unlocked=true',
        NEW.vin
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_prep_gate_vehicle_listings ON public.vehicle_listings;
CREATE TRIGGER enforce_prep_gate_vehicle_listings
  BEFORE INSERT OR UPDATE OF status ON public.vehicle_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prep_gate();


-- 3. Seat-limit enforcement on tenant_members ──────────────────────
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seat_limit INTEGER;
  v_current_seats INTEGER;
BEGIN
  SELECT MAX(seat_limit) INTO v_seat_limit
    FROM public.app_entitlements
    WHERE tenant_id = NEW.tenant_id
      AND status IN ('trial', 'active');

  IF v_seat_limit IS NULL THEN
    RETURN NEW;  -- no cap configured → unlimited
  END IF;

  SELECT COUNT(*) INTO v_current_seats
    FROM public.tenant_members
    WHERE tenant_id = NEW.tenant_id
      AND (user_id IS NOT NULL OR invited_email IS NOT NULL);

  IF v_current_seats >= v_seat_limit THEN
    RAISE EXCEPTION 'seat_limit_exceeded: tenant has reached % seats; upgrade plan to invite more',
      v_seat_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_seat_limit_tenant_members ON public.tenant_members;
CREATE TRIGGER enforce_seat_limit_tenant_members
  BEFORE INSERT ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();


-- 4. DEAL_SIGNING_TOKENS — persisted, expiring tokens ──────────────
-- Replaces localStorage-based deal_qr_token lookup.
CREATE TABLE IF NOT EXISTS public.deal_signing_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  vehicle_file_id TEXT NOT NULL,         -- matches VEHICLE_FILES_KEY id from localStorage
  vehicle_payload JSONB NOT NULL DEFAULT '{}',
                                         -- full snapshot: vin, ymm, buyer, coBuyer,
                                         -- accessories, pricing, buyersGuide, etc.
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'signed', 'expired', 'revoked')),
  signed_payload  JSONB,                 -- returned after customer signs
  content_hash    TEXT,                  -- SHA-256 of the exact payload signed
  customer_ip     TEXT,
  user_agent      TEXT,
  esign_consent   JSONB,
  created_by      UUID REFERENCES auth.users(id),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  signed_at       TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_signing_tokens_token ON public.deal_signing_tokens (token);
CREATE INDEX IF NOT EXISTS idx_deal_signing_tokens_tenant ON public.deal_signing_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_signing_tokens_status ON public.deal_signing_tokens (status);

ALTER TABLE public.deal_signing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view deal tokens"
  ON public.deal_signing_tokens FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members create deal tokens"
  ON public.deal_signing_tokens FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Creator can revoke deal tokens"
  ON public.deal_signing_tokens FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Anon signer reads its own token by token string, via SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.get_deal_token(_token TEXT)
RETURNS SETOF public.deal_signing_tokens
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.deal_signing_tokens
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;
$$;

-- Anon signer flips the token to 'signed' with full audit data.
CREATE OR REPLACE FUNCTION public.sign_deal_token(
  _token TEXT,
  _signed_payload JSONB,
  _content_hash TEXT,
  _customer_ip TEXT,
  _user_agent TEXT,
  _esign_consent JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.deal_signing_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.deal_signing_tokens
    WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.status <> 'pending' OR v_row.expires_at <= now() THEN
    RETURN false;
  END IF;

  UPDATE public.deal_signing_tokens SET
    status = 'signed',
    signed_payload = _signed_payload,
    content_hash = _content_hash,
    customer_ip = _customer_ip,
    user_agent = _user_agent,
    esign_consent = _esign_consent,
    signed_at = now(),
    updated_at = now()
  WHERE id = v_row.id;

  -- Mirror into audit_log
  INSERT INTO public.audit_log (
    action, entity_type, entity_id, content_hash, ip_address, user_agent, details
  ) VALUES (
    'deal_signed', 'deal_signing_token', v_row.id::text,
    _content_hash, _customer_ip, _user_agent,
    jsonb_build_object(
      'vehicle_file_id', v_row.vehicle_file_id,
      'tenant_id', v_row.tenant_id
    )
  );
  RETURN true;
END;
$$;

CREATE TRIGGER update_deal_signing_tokens_updated_at
  BEFORE UPDATE ON public.deal_signing_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 5. CA SB 766 disclosure columns on addendums ─────────────────────
-- Effective Oct 1, 2026. Requires upfront cost-of-financing disclosure,
-- 3-day right-to-cancel form, and add-on precontract consent for
-- vehicles under $50,000.
ALTER TABLE public.addendums
  ADD COLUMN IF NOT EXISTS sb766_financing_disclosure JSONB,
                                  -- { apr, term_months, total_interest, monthly_payment,
                                  --   lifetime_cost, presented_at, vehicle_state }
  ADD COLUMN IF NOT EXISTS sb766_three_day_return_ack BOOLEAN,
  ADD COLUMN IF NOT EXISTS sb766_add_on_precontract   JSONB,
                                  -- { add_ons: [{ name, price, precontract_ack_at }] }
  ADD COLUMN IF NOT EXISTS price_overrides            JSONB,
                                  -- { [product_id]: override_amount }
  ADD COLUMN IF NOT EXISTS vehicle_state              TEXT,
                                  -- 2-letter state used for state-rule selection
  ADD COLUMN IF NOT EXISTS vehicle_price              NUMERIC(10,2),
                                  -- negotiated vehicle price (pre-add-ons),
                                  -- used for SB 766 $50k threshold check
  ADD COLUMN IF NOT EXISTS financing_input            JSONB;
                                  -- { amount_financed, apr_percent, term_months,
                                  --   down_payment, trade_in_credit, add_ons_total }

CREATE INDEX IF NOT EXISTS idx_addendums_sb766_return
  ON public.addendums (sb766_three_day_return_ack)
  WHERE sb766_three_day_return_ack IS NOT NULL;

COMMENT ON COLUMN public.addendums.sb766_financing_disclosure IS
  'CA SB 766 (eff 10/1/2026): upfront cost-of-financing disclosure for loans';
COMMENT ON COLUMN public.addendums.sb766_three_day_return_ack IS
  'CA SB 766: 3-day return form acknowledgment for used vehicles under $50k';
COMMENT ON COLUMN public.addendums.sb766_add_on_precontract IS
  'CA SB 766: precontract add-on disclosure and buyer acknowledgment';
