-- ──────────────────────────────────────────────────────────────────────
-- Premium shopper-facing VDP + VDP ingest
--
-- Adds fields to vehicle_listings that power the Apple-grade public
-- /v/<slug> experience: ordered photo gallery, long-form description,
-- marketing feature highlights, a scrape-source URL we can refresh
-- from, and trust-cue fields (Carfax dealer deep-link, factory sticker
-- URL, certification label). Also adds a carfax_dealer_id on the
-- tenant so the Carfax badge/link works across every vehicle.
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]',
  -- [{ url, alt, width, height, kind: 'hero'|'exterior'|'interior'|'detail' }]
  ADD COLUMN IF NOT EXISTS description TEXT,
  -- long-form marketing copy, dealer-edited or AI-drafted
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]',
  -- [{ icon: 'shield'|'sparkles'|'gauge'|..., title, subtitle? }]
  ADD COLUMN IF NOT EXISTS key_specs JSONB NOT NULL DEFAULT '{}',
  -- { drivetrain, transmission, mpg_city, mpg_hwy, engine, fuel, exterior_color, interior_color }
  ADD COLUMN IF NOT EXISTS certification JSONB,
  -- { program_name, coverage_miles, coverage_months, inspection_points, url }
  ADD COLUMN IF NOT EXISTS factory_sticker_url TEXT,
  -- public URL to the OEM Monroney PDF (OEM-hosted is ideal)
  ADD COLUMN IF NOT EXISTS scrape_source_url TEXT,
  -- dealer's own VDP URL we ingested from (or plan to refresh from)
  ADD COLUMN IF NOT EXISTS scrape_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_estimate JSONB;
  -- { default_apr, default_down, default_term_months } — dealer tweakable

CREATE INDEX IF NOT EXISTS idx_vehicle_listings_scrape_source
  ON public.vehicle_listings (scrape_source_url);

-- Tenant-level Carfax identification: lets us render the official
-- Carfax dealer-badge link on every vehicle for that tenant without
-- asking per-vehicle.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS carfax_dealer_id TEXT,
  ADD COLUMN IF NOT EXISTS autocheck_dealer_id TEXT;

-- Additive RPC: admins + tenant owners can merge a scraped VDP
-- payload into an existing vehicle_listings row. We do it via a
-- SECURITY DEFINER helper so the client never writes scrape fields
-- directly, which keeps client-fabricated photos/descriptions out
-- of the row.
CREATE OR REPLACE FUNCTION public.merge_scraped_vdp(
  _vehicle_id    UUID,
  _source_url    TEXT,
  _photos        JSONB,
  _description   TEXT,
  _features      JSONB,
  _key_specs     JSONB,
  _price         NUMERIC(10,2) DEFAULT NULL,
  _mileage       INTEGER DEFAULT NULL,
  _options       JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.vehicle_listings WHERE id = _vehicle_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'vehicle not found';
  END IF;

  IF NOT (v_tenant = public.current_tenant_id() OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.vehicle_listings SET
    photos                = COALESCE(_photos, photos),
    description           = COALESCE(_description, description),
    features              = COALESCE(_features, features),
    key_specs             = COALESCE(_key_specs, key_specs),
    price                 = COALESCE(_price, price),
    mileage               = COALESCE(_mileage, mileage),
    scrape_source_url     = _source_url,
    scrape_last_synced_at = now(),
    sticker_snapshot      = sticker_snapshot ||
                            jsonb_build_object('scraped_options', COALESCE(_options, sticker_snapshot->'scraped_options'))
  WHERE id = _vehicle_id;

  INSERT INTO public.audit_log (
    action, entity_type, entity_id, user_id, details
  ) VALUES (
    'vdp_scraped', 'vehicle_listing', _vehicle_id::text, auth.uid(),
    jsonb_build_object('source_url', _source_url,
                       'photo_count', jsonb_array_length(COALESCE(_photos,'[]'::jsonb)))
  );

  RETURN _vehicle_id;
END;
$$;
