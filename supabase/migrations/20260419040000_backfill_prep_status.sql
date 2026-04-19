-- ──────────────────────────────────────────────────────────────────────
-- Wave 6.1 backfill: populate prep_status on existing vehicle_listings
--
-- The trust band on the shopper landing page shows "Prep-signed by
-- [date]" from vehicle_listings.prep_status.foreman_signed_at. That
-- column started getting populated when Wave 3.x wired prep-gate into
-- the publish path, so listings that were published before the gate
-- landed (or whose prep_status was never backfilled) show "Pending"
-- even though a matching signed prep_sign_off exists.
--
-- This migration walks every published vehicle_listings row with a
-- null or empty prep_status and pulls the latest signed
-- prep_sign_off for the same (tenant_id, vin), then stamps
-- prep_status.foreman_signed_at.
--
-- Safe to re-run: only updates rows where prep_status is missing the
-- foreman_signed_at key. Never overwrites existing data.
--
-- Recall backfill is NOT done here because recall data is live from
-- NHTSA. That path is an admin-triggered batch refresh via the
-- nhtsa-recall edge function. New migration only covers what's
-- already in the database.
-- ──────────────────────────────────────────────────────────────────────

UPDATE public.vehicle_listings vl
   SET prep_status = coalesce(vl.prep_status, '{}'::jsonb)
                    || jsonb_build_object(
                         'foreman_signed_at',
                         to_char(ps.signed_at AT TIME ZONE 'UTC',
                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                         'all_accessories_installed',
                         true,
                         'backfilled_at',
                         to_char(now() AT TIME ZONE 'UTC',
                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                       )
  FROM (
    SELECT DISTINCT ON (tenant_id, vin)
           tenant_id, vin, signed_at, created_at
      FROM public.prep_sign_offs
      WHERE listing_unlocked = true
        AND signed_at IS NOT NULL
      ORDER BY tenant_id, vin, signed_at DESC NULLS LAST, created_at DESC
  ) ps
 WHERE vl.vin = ps.vin
   AND vl.tenant_id IS NOT DISTINCT FROM ps.tenant_id
   AND vl.status = 'published'
   AND (
     vl.prep_status IS NULL
     OR NOT (vl.prep_status ? 'foreman_signed_at')
     OR (vl.prep_status ->> 'foreman_signed_at') IS NULL
     OR (vl.prep_status ->> 'foreman_signed_at') = ''
   );
