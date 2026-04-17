-- ──────────────────────────────────────────────────────────────────────
-- Super-admin bootstrap
--
-- Goal: the super-admin account (ken@ken.cc) is always granted the
-- 'admin' role as soon as it exists in auth.users. We don't hardcode
-- a password anywhere; the user signs up through the normal flow, and
-- the moment their auth.users row appears, this logic attaches the
-- admin role idempotently.
--
-- Works in two ways so the ordering is safe:
--
--   1. If ken@ken.cc ALREADY exists at migration time, attach the
--      role immediately (backfill).
--
--   2. A trigger on auth.users ensures any new insert with
--      email='ken@ken.cc' gets the admin role. So if the user signs
--      up after this migration runs, they're elevated automatically.
--
-- Swap or append additional super-admin emails by adding to the
-- SUPER_ADMIN_EMAILS set below. Rotating an account out is a one-line
-- UPDATE on user_roles.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Backfill for any super-admin email that already exists.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('ken@ken.cc')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = u.id AND r.role = 'admin'
  );

-- 2. Ensure future sign-ups get elevated automatically.
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) IN ('ken@ken.cc') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_super_admin ON auth.users;
CREATE TRIGGER bootstrap_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_super_admin();
