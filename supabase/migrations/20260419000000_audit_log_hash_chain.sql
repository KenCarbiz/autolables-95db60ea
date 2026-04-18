-- ──────────────────────────────────────────────────────────────────────
-- Wave 4.1: Tamper-evident hash chain on audit_log
--
-- Every new audit_log row carries:
--   * prev_hash — the row_hash of the previous row in the same tenant's
--     chain (or NULL / GENESIS for the first row)
--   * row_hash  — SHA-256 of (prev_hash || canonical_payload)
--
-- The canonical_payload is a stable-order concatenation of the columns
-- a regulator or investor would care about: action, entity_type,
-- entity_id, user_email, created_at, and the details JSONB rendered as
-- text. Changing any of those after the fact breaks the chain at that
-- row and every row after it.
--
-- Verification: public.verify_audit_chain(_tenant_id) walks the chain
-- and returns (total, verified, first_break). If first_break is NULL
-- the whole chain is intact.
-- ──────────────────────────────────────────────────────────────────────

-- pgcrypto powers digest(). Supabase has this extension available by
-- default; CREATE IF NOT EXISTS keeps it idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS row_hash  TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_row_hash
  ON public.audit_log (row_hash);

-- Chain payload: deterministic string built from the row's audit-relevant
-- columns. JSONB keys are rendered in a canonical order by jsonb_build_object
-- because we pick them explicitly, not by key enumeration.
CREATE OR REPLACE FUNCTION public._audit_chain_payload(
  _prev_hash   TEXT,
  _action      TEXT,
  _entity_type TEXT,
  _entity_id   TEXT,
  _store_id    TEXT,
  _user_email  TEXT,
  _details     JSONB,
  _created_at  TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      coalesce(_prev_hash, 'GENESIS') || '|'
        || coalesce(_action, '') || '|'
        || coalesce(_entity_type, '') || '|'
        || coalesce(_entity_id, '') || '|'
        || coalesce(_store_id, '') || '|'
        || coalesce(_user_email, '') || '|'
        || coalesce(_details::text, '{}') || '|'
        || to_char(_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public._audit_chain_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev TEXT;
BEGIN
  -- Latest hash within the tenant's chain (store_id scope). We take a
  -- lock on the tenant's latest row so two concurrent inserts can't
  -- both read the same prev_hash — the second insert serializes after
  -- the first writes row_hash.
  SELECT row_hash INTO _prev
  FROM public.audit_log
  WHERE coalesce(store_id, '') = coalesce(NEW.store_id, '')
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  NEW.prev_hash := _prev;
  NEW.created_at := coalesce(NEW.created_at, now());
  NEW.row_hash := public._audit_chain_payload(
    _prev,
    NEW.action,
    NEW.entity_type,
    NEW.entity_id,
    NEW.store_id,
    NEW.user_email,
    NEW.details,
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_chain_before_insert ON public.audit_log;
CREATE TRIGGER audit_log_chain_before_insert
BEFORE INSERT ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public._audit_chain_before_insert();

-- ──────────────────────────────────────────────────────────────────────
-- Backfill: compute hashes for every existing row in creation order,
-- chained within the same store_id. One-shot. Uses a recursive CTE so
-- it works regardless of how many rows exist.
-- ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  _processed INT;
BEGIN
  -- Only backfill rows that are still missing a row_hash. Safe to re-run.
  WITH ordered AS (
    SELECT
      id,
      store_id,
      action,
      entity_type,
      entity_id,
      user_email,
      details,
      created_at,
      row_number() OVER (
        PARTITION BY coalesce(store_id, '')
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.audit_log
  ),
  chained AS (
    -- First row in each tenant's chain
    SELECT
      id,
      store_id,
      action,
      entity_type,
      entity_id,
      user_email,
      details,
      created_at,
      rn,
      NULL::TEXT AS prev_hash,
      public._audit_chain_payload(
        NULL, action, entity_type, entity_id, store_id, user_email, details, created_at
      ) AS row_hash
    FROM ordered
    WHERE rn = 1
    UNION ALL
    -- Walk the chain
    SELECT
      o.id,
      o.store_id,
      o.action,
      o.entity_type,
      o.entity_id,
      o.user_email,
      o.details,
      o.created_at,
      o.rn,
      c.row_hash AS prev_hash,
      public._audit_chain_payload(
        c.row_hash, o.action, o.entity_type, o.entity_id, o.store_id, o.user_email, o.details, o.created_at
      ) AS row_hash
    FROM ordered o
    JOIN chained c
      ON coalesce(o.store_id, '') = coalesce(c.store_id, '')
     AND o.rn = c.rn + 1
  )
  UPDATE public.audit_log a
     SET prev_hash = c.prev_hash,
         row_hash  = c.row_hash
    FROM chained c
   WHERE a.id = c.id
     AND a.row_hash IS NULL;

  GET DIAGNOSTICS _processed = ROW_COUNT;
  RAISE NOTICE 'audit_log hash chain backfilled: % rows', _processed;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- Verification RPC: walk the chain for a store and return the integrity
-- summary. first_break_id is the id of the row whose row_hash doesn't
-- match its recomputed payload, or NULL if every row verifies.
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_audit_chain(_store_id TEXT)
RETURNS TABLE (
  total          INT,
  verified       INT,
  first_break_id UUID,
  first_break_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row       RECORD;
  _prev      TEXT := NULL;
  _expected  TEXT;
  _total     INT := 0;
  _verified  INT := 0;
  _break_id  UUID := NULL;
  _break_at  TIMESTAMPTZ := NULL;
BEGIN
  FOR _row IN
    SELECT id, action, entity_type, entity_id, store_id,
           user_email, details, created_at, prev_hash, row_hash
      FROM public.audit_log
     WHERE coalesce(store_id, '') = coalesce(_store_id, '')
     ORDER BY created_at ASC, id ASC
  LOOP
    _total := _total + 1;
    _expected := public._audit_chain_payload(
      _prev,
      _row.action, _row.entity_type, _row.entity_id, _row.store_id,
      _row.user_email, _row.details, _row.created_at
    );
    IF _row.row_hash = _expected AND coalesce(_row.prev_hash, '') = coalesce(_prev, '') THEN
      _verified := _verified + 1;
      _prev := _row.row_hash;
    ELSE
      IF _break_id IS NULL THEN
        _break_id := _row.id;
        _break_at := _row.created_at;
      END IF;
      -- Reset chain to the stored row_hash so later rows that correctly
      -- chain from it still verify. This is forensic, not repair.
      _prev := _row.row_hash;
    END IF;
  END LOOP;

  total := _total;
  verified := _verified;
  first_break_id := _break_id;
  first_break_at := _break_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_audit_chain(TEXT)
  TO authenticated, anon;
