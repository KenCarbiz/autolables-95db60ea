-- ──────────────────────────────────────────────────────────────────────
-- Wave 11.2: helpers for scheduling the abandoned-signing re-engagement
-- edge function via Supabase pg_cron + pg_net.
--
-- The Wave 11 edge fn (reengage-abandoned-signings) is service-role
-- gated and does the actual work. To run it on a cadence we use
-- Supabase's pg_cron extension and pg_net for HTTP. Both ship with
-- managed Supabase but must be enabled per project.
--
-- This migration is INERT on apply. It creates two helpers:
--   public.schedule_reengage_abandoned_signings(_cron_expr, _supabase_url, _service_key)
--   public.unschedule_reengage_abandoned_signings()
--
-- Ops calls the schedule helper exactly once per environment, after
-- storing the service key in Supabase Vault (or passing it directly
-- in dev). That keeps the cron secret out of git.
--
-- Default cadence is every hour at minute 17 to spread load across
-- the cluster. Adjust at scheduling time, not here.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Make sure the extensions exist. CREATE EXTENSION IF NOT EXISTS
--    is idempotent and safe.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- 2. Schedule helper. Returns the cron jobid so ops can verify or
--    later cancel.
--
-- Example call (ops, one time per env):
--   SELECT public.schedule_reengage_abandoned_signings(
--     '17 * * * *',
--     'https://abc123.supabase.co',
--     'eyJhbGciOiJI...service-role-key...'
--   );
CREATE OR REPLACE FUNCTION public.schedule_reengage_abandoned_signings(
  _cron_expr     TEXT DEFAULT '17 * * * *',
  _supabase_url  TEXT DEFAULT NULL,
  _service_key   TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _jobid BIGINT;
  _url   TEXT;
  _key   TEXT;
  _sql   TEXT;
BEGIN
  -- Resolve URL + key. Caller can pass them, otherwise we look in
  -- vault.decrypted_secrets. Vault is preferred so the key never
  -- shows up in pg_cron job definitions.
  _url := COALESCE(_supabase_url,
    (SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name = 'supabase_url' LIMIT 1));
  _key := COALESCE(_service_key,
    (SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name = 'service_role_key' LIMIT 1));

  IF _url IS NULL OR _key IS NULL THEN
    RAISE EXCEPTION 'schedule_reengage_abandoned_signings: pass _supabase_url + _service_key, or store them in vault as supabase_url / service_role_key';
  END IF;

  -- Cancel any prior schedule before creating a new one so callers
  -- can re-run this helper to bump the cron expression without
  -- ending up with duplicate jobs.
  PERFORM public.unschedule_reengage_abandoned_signings();

  _sql := format(
    $cron$
      SELECT extensions.http_post(
        url     := %L,
        headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || %L
                  ),
        body    := jsonb_build_object(
                    'min_hours_since_open', 24,
                    'min_hours_since_retry', 72,
                    'limit', 100
                  )::text
      );
    $cron$,
    rtrim(_url, '/') || '/functions/v1/reengage-abandoned-signings',
    _key
  );

  SELECT cron.schedule(
    'autolabels_reengage_abandoned_signings',
    _cron_expr,
    _sql
  ) INTO _jobid;

  RETURN _jobid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_reengage_abandoned_signings(TEXT, TEXT, TEXT)
  TO service_role;


-- 3. Unschedule helper. Idempotent — safe to call when nothing is
--    scheduled.
CREATE OR REPLACE FUNCTION public.unschedule_reengage_abandoned_signings()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM cron.job
   WHERE jobname = 'autolabels_reengage_abandoned_signings';
END;
$$;

GRANT EXECUTE ON FUNCTION public.unschedule_reengage_abandoned_signings()
  TO service_role;


-- 4. Read-only inspection helper. Returns the current schedule (if
--    any) so the diagnostic UI can render a "scheduled" / "not
--    scheduled" indicator without elevating privileges.
CREATE OR REPLACE FUNCTION public.get_reengage_schedule()
RETURNS TABLE (
  jobid    BIGINT,
  schedule TEXT,
  active   BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT j.jobid, j.schedule, j.active
    FROM cron.job j
   WHERE j.jobname = 'autolabels_reengage_abandoned_signings'
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_reengage_schedule()
  TO authenticated, service_role;
