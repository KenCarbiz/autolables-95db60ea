-- ──────────────────────────────────────────────────────────────────────
-- addendums: add tenant_id and tighten RLS
--
-- The addendums table was created before the shared tenant primitives.
-- Its RLS policy is USING (true), meaning any authenticated user can
-- read every other tenant's addendums. Closing that gap.
--
-- Strategy matches vehicle_listings / prep_sign_offs:
--   1. Add nullable tenant_id with an FK to tenants.
--   2. Auto-fill tenant_id on INSERT via a trigger reading
--      public.current_tenant_id().
--   3. Replace the SELECT/UPDATE policies with tenant-scoped versions,
--      while keeping the anonymous signing-token read path intact.
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.addendums
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_addendums_tenant ON public.addendums (tenant_id);

-- Trigger: auto-fill tenant_id on insert from current_tenant_id().
-- Reuses the helper added in the hardening migration.
DROP TRIGGER IF EXISTS set_tenant_id_addendums ON public.addendums;
CREATE TRIGGER set_tenant_id_addendums
  BEFORE INSERT ON public.addendums
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Swap out the old permissive policies. Anonymous token-based access
-- (signed from MobileSigning.tsx) still works because the RPC
-- get_addendum_by_token runs SECURITY DEFINER.
DROP POLICY IF EXISTS "Auth users can view addendums" ON public.addendums;
DROP POLICY IF EXISTS "Auth users can insert addendums" ON public.addendums;
DROP POLICY IF EXISTS "Auth users can update addendums" ON public.addendums;

CREATE POLICY "Tenant members view addendums"
  ON public.addendums FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL  -- legacy rows, only the creator can see
      AND created_by = auth.uid()
    OR tenant_id = public.current_tenant_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Tenant members insert addendums"
  ON public.addendums FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR tenant_id = public.current_tenant_id())
  );

CREATE POLICY "Tenant members update addendums"
  ON public.addendums FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
