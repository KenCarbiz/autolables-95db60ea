-- ──────────────────────────────────────────────────────────────────────
-- Wave 1.1 — DealerSettings to Supabase.
--
-- Up until now every feature toggle, addendum paper size, doc-fee
-- config, compliance setting, and brand color lived in the browser's
-- localStorage only. That meant: (a) settings evaporated when the
-- dealer cleared cache or switched devices, (b) multi-store tenants
-- couldn't carry consistent settings across sales / F&I desks, and
-- (c) the admin platform had no way to audit or override a dealer's
-- compliance posture.
--
-- dealer_profiles is the tenant-scoped source of truth. The settings
-- JSONB mirrors the existing DealerSettings TypeScript shape 1:1 so
-- the context can hydrate directly without a mapping layer.
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dealer_profiles (
  tenant_id  UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_profiles_updated_at
  ON public.dealer_profiles (updated_at DESC);

ALTER TABLE public.dealer_profiles ENABLE ROW LEVEL SECURITY;

-- Any accepted tenant member can read their dealership's settings.
CREATE POLICY "Tenant members read dealer profile"
  ON public.dealer_profiles FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Owners + admins write. Non-owners use the app UI which reads; they
-- don't need write access directly. Platform admins override via the
-- cross-tenant policy at the bottom.
CREATE POLICY "Owners upsert dealer profile"
  ON public.dealer_profiles FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = dealer_profiles.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
        AND m.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Owners update dealer profile"
  ON public.dealer_profiles FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_members m
      WHERE m.tenant_id = dealer_profiles.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
        AND m.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Platform admins (user_roles.role = 'admin') read/write everything.
CREATE POLICY "Platform admins read all dealer profiles"
  ON public.dealer_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins write all dealer profiles"
  ON public.dealer_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keep updated_at fresh via the existing helper trigger.
CREATE TRIGGER update_dealer_profiles_updated_at
  BEFORE UPDATE ON public.dealer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
