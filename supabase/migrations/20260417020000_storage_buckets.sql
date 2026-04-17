-- ──────────────────────────────────────────────────────────────
-- AutoLabels.io — Storage buckets
--
-- prep-photos: shop-foreman install photos per VIN, referenced
-- by prep_sign_offs.install_photos[].url. Public-read so the
-- shopper portal can display the "before/after" gallery when
-- the dealer chooses to expose it.
--
-- listing-photos: vehicle hero / exterior / interior photos
-- used in vehicle_listings. Public-read.
-- ──────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('prep-photos',    'prep-photos',    true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('listing-photos', 'listing-photos', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

-- Public can READ anything in these buckets (public shopper portal).
CREATE POLICY "Public read prep-photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'prep-photos');

CREATE POLICY "Public read listing-photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'listing-photos');

-- Only authenticated users can INSERT/UPDATE/DELETE.
CREATE POLICY "Auth users upload prep-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prep-photos');

CREATE POLICY "Auth users update prep-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'prep-photos');

CREATE POLICY "Auth users delete prep-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prep-photos');

CREATE POLICY "Auth users upload listing-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-photos');

CREATE POLICY "Auth users update listing-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Auth users delete listing-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-photos');
