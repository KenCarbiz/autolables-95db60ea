-- ──────────────────────────────────────────────────────────────────────
-- Wave 10: vehicle_files off localStorage.
--
-- Last of the big shadows. vehicle_files is the per-VIN compliance
-- record that tracks stickers printed, signings captured, aftermarket
-- installs, attached compliance docs (K-208, Buyers Guide, etc.),
-- and the deal lifecycle state.
--
-- Schema shape decision: single parent table with JSONB children.
-- The hook today reads-modifies-writes the whole file — it never
-- queries stickers or signings in isolation. Top-level columns are
-- only the fields actually filtered on (vin, deal_status,
-- deal_qr_token, store_id, tenant_id). Everything else nests in
-- JSONB so new product iterations don't require DDL. If/when
-- tracking_code search becomes hot, normalize the stickers array
-- into its own table.
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicle_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id              UUID,

  vin                   TEXT NOT NULL,
  year                  TEXT NOT NULL DEFAULT '',
  make                  TEXT NOT NULL DEFAULT '',
  model                 TEXT NOT NULL DEFAULT '',
  trim                  TEXT NOT NULL DEFAULT '',
  stock_number          TEXT NOT NULL DEFAULT '',
  condition             TEXT NOT NULL DEFAULT 'used'
                          CHECK (condition IN ('new','used','cpo')),
  mileage               INTEGER NOT NULL DEFAULT 0,

  -- Pricing
  msrp                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  market_value          NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Loose bags. StickerRecord / SigningRecord / AftermarketInstall /
  -- AttachedDocument shapes live in src/types/vehicleFile.ts; JSON
  -- mirrors that without DDL coupling.
  factory_equipment     JSONB NOT NULL DEFAULT '[]'::jsonb,
  aftermarket_installs  JSONB NOT NULL DEFAULT '[]'::jsonb,
  stickers              JSONB NOT NULL DEFAULT '[]'::jsonb,
  signings              JSONB NOT NULL DEFAULT '[]'::jsonb,
  attached_documents    JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Deal lifecycle
  deal_qr_token         UUID NOT NULL DEFAULT gen_random_uuid(),
  deal_status           TEXT NOT NULL DEFAULT 'stickered'
                          CHECK (deal_status IN
                            ('stickered','presented','pending_sign',
                             'signed','delivered','unwound')),
  customer_name         TEXT NOT NULL DEFAULT '',
  customer_phone        TEXT NOT NULL DEFAULT '',
  customer_email        TEXT NOT NULL DEFAULT '',
  cobuyer_name          TEXT NOT NULL DEFAULT '',
  cobuyer_phone         TEXT NOT NULL DEFAULT '',
  cobuyer_email         TEXT NOT NULL DEFAULT '',

  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A VIN is unique within a tenant; different tenants can each own
  -- their own file for the same VIN (e.g. vehicle moves between
  -- dealer groups).
  UNIQUE (tenant_id, vin)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_files_tenant      ON public.vehicle_files (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_files_store       ON public.vehicle_files (store_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_files_vin         ON public.vehicle_files (vin);
CREATE INDEX IF NOT EXISTS idx_vehicle_files_deal_status ON public.vehicle_files (deal_status);
CREATE INDEX IF NOT EXISTS idx_vehicle_files_deal_qr     ON public.vehicle_files (deal_qr_token);
CREATE INDEX IF NOT EXISTS idx_vehicle_files_updated     ON public.vehicle_files (updated_at DESC);

-- Auto-fill tenant_id and stamp updated_at. Matches the pattern used
-- on leads / trade_in_records / vin_queue / vehicle_listings.
CREATE OR REPLACE FUNCTION public.set_tenant_id_vehicle_files()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_id_vehicle_files ON public.vehicle_files;
CREATE TRIGGER set_tenant_id_vehicle_files
  BEFORE INSERT OR UPDATE ON public.vehicle_files
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_vehicle_files();

ALTER TABLE public.vehicle_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view vehicle_files"
  ON public.vehicle_files FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members insert vehicle_files"
  ON public.vehicle_files FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members update vehicle_files"
  ON public.vehicle_files FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members delete vehicle_files"
  ON public.vehicle_files FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());


-- Anonymous shopper lookups by deal_qr_token (QR on the glass)
-- bypass the authenticated RLS — a SECURITY DEFINER RPC returns
-- just the row rather than exposing the table to anon RLS.
CREATE OR REPLACE FUNCTION public.get_vehicle_file_by_deal_token(_token UUID)
RETURNS SETOF public.vehicle_files
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.vehicle_files WHERE deal_qr_token = _token LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_vehicle_file_by_deal_token(UUID)
  TO anon, authenticated, service_role;
