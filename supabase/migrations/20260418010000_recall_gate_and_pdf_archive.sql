-- ──────────────────────────────────────────────────────────────────────
-- AutoLabels.io — Recall stop-sale gate + PDF archival + billing events
--
-- 1. Recall/stop-sale check is now enforced in the prep-gate trigger.
--    A vehicle flagged do_not_drive=true cannot be published unless
--    an admin explicitly records an override.
-- 2. signed_document_archive: append-only PDF retention (2-7 yrs).
-- 3. billing_events: Stripe webhook ledger to audit entitlement
--    state transitions without trusting client mutations.
-- ──────────────────────────────────────────────────────────────────────

-- 1. RECALL STOP-SALE GATE ─────────────────────────────────────────
ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS recall_check          JSONB,
                                 -- { checked_at, has_open, do_not_drive,
                                 --   campaigns: [{ id, summary, remedy_status }] }
  ADD COLUMN IF NOT EXISTS recall_override_by    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recall_override_notes TEXT,
  ADD COLUMN IF NOT EXISTS recall_override_at    TIMESTAMPTZ;

-- Replace the prep-gate trigger with one that also enforces recalls.
CREATE OR REPLACE FUNCTION public.enforce_prep_gate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unlocked      BOOLEAN;
  v_do_not_drive  BOOLEAN;
  v_checked_at    TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN

    -- Admins bypass both gates (they are responsible for overrides).
    IF public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;

    -- a) prep-gate: VIN must have a signed prep_sign_off with listing_unlocked=true
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

    -- b) recall-gate: if recall_check marks do_not_drive, require an
    --    override. Also require recall_check freshness within 30 days.
    v_do_not_drive := COALESCE((NEW.recall_check ->> 'do_not_drive')::BOOLEAN, false);
    v_checked_at   := (NEW.recall_check ->> 'checked_at')::TIMESTAMPTZ;

    IF v_do_not_drive AND NEW.recall_override_by IS NULL THEN
      RAISE EXCEPTION 'recall_gate_blocked: vehicle % has an active do-not-drive recall; admin override required',
        NEW.vin
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_checked_at IS NULL OR v_checked_at < now() - INTERVAL '30 days' THEN
      RAISE EXCEPTION 'recall_gate_blocked: NHTSA recall check missing or stale for vehicle %; refresh before publish',
        NEW.vin
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- 2. SIGNED_DOCUMENT_ARCHIVE — immutable 2–7 year retention ────────
-- Every signed addendum, deal, or disclosure lands here as a
-- hash-sealed archive record. Content lives in Supabase Storage;
-- this table holds the cryptographic receipt.
CREATE TABLE IF NOT EXISTS public.signed_document_archive (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
  doc_type       TEXT NOT NULL
                   CHECK (doc_type IN
                     ('addendum', 'deal', 'sticker', 'buyers_guide',
                      'prep_signoff', 'disclosure')),
  entity_id      TEXT NOT NULL,
  vin            TEXT,
  storage_path   TEXT NOT NULL,            -- path in Supabase Storage
  storage_bucket TEXT NOT NULL DEFAULT 'signed-archives',
  content_hash   TEXT NOT NULL,            -- SHA-256 of stored file
  mime_type      TEXT NOT NULL DEFAULT 'application/pdf',
  byte_size      INTEGER,
  retained_until TIMESTAMPTZ,              -- per-state retention deadline
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_tenant ON public.signed_document_archive (tenant_id);
CREATE INDEX IF NOT EXISTS idx_archive_entity ON public.signed_document_archive (doc_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_archive_vin    ON public.signed_document_archive (vin);

ALTER TABLE public.signed_document_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view archive"
  ON public.signed_document_archive FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Inserts happen via the archive-pdf Edge Function (service role),
-- so no INSERT policy for authenticated users. Updates/deletes are
-- deliberately absent — archive is append-only.


-- 3. BILLING_EVENTS — Stripe webhook ledger ────────────────────────
-- Append-only record of every Stripe event that affects entitlement
-- state. The webhook handler applies state transitions to
-- app_entitlements; this table is the immutable source of truth.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  stripe_event_id TEXT UNIQUE,
  event_type      TEXT NOT NULL,          -- e.g. checkout.session.completed
  payload         JSONB NOT NULL,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON public.billing_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type   ON public.billing_events (event_type);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view billing events"
  ON public.billing_events FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = billing_events.tenant_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND accepted_at IS NOT NULL
    )
  );
-- Inserts are made by the stripe-webhook Edge Function (service role).
