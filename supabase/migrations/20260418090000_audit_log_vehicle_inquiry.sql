-- ──────────────────────────────────────────────────────────────────────
-- Allow anonymous vehicle inquiry submissions from the public /v/:slug
-- shopper page. Extends the existing anon-insert whitelist on audit_log
-- with the 'vehicle_inquiry' action so a shopper can say "I'm
-- interested in this car" without signing in.
-- ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert signing audit events" ON public.audit_log;

CREATE POLICY "Anon can insert shopper audit events"
  ON public.audit_log FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND action IN (
      'addendum_viewed',
      'addendum_consent_given',
      'addendum_signed',
      'listing_viewed',
      'vehicle_inquiry'
    )
  );
