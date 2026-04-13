import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Tenant, Store } from "@/types/tenant";
import { useTenantIntegration, IntegrationMode } from "@/hooks/useTenantIntegration";

interface TenantContextType {
  tenant: Tenant | null;
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store) => void;
  addStore: (store: Omit<Store, "id" | "created_at">) => void;
  updateStore: (id: string, updates: Partial<Store>) => void;
  deleteStore: (id: string) => void;
  updateTenant: (updates: Partial<Tenant>) => void;
  loading: boolean;
  // Integration mode
  mode: IntegrationMode;
  isEmbedded: boolean;
  isStandalone: boolean;
  isOnboardingComplete: boolean;
  completeOnboarding: () => void;
  parentOrigin: string | null;
  externalUser: { id: string; email: string; name?: string; role?: string } | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_KEY = "wl_tenant";
const STORES_KEY = "wl_stores";
const CURRENT_STORE_KEY = "wl_current_store";

const DEFAULT_TENANT: Tenant = {
  id: "autolabels",
  name: "AutoLabels.io",
  slug: "autolabels",
  logo_url: "/logo-mark.svg",
  primary_color: "#0F1E3C",
  secondary_color: "#2563EB",
  created_at: new Date().toISOString(),
  is_active: true,
};

const DEFAULT_STORE: Store = {
  id: "store-default",
  tenant_id: "default",
  name: "Your Dealership",
  slug: "your-dealership",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  logo_url: "",
  tagline: "Your Trusted Automotive Partner",
  primary_color: "",
  created_at: new Date().toISOString(),
  is_active: true,
};

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const integration = useTenantIntegration();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial load from localStorage
  useEffect(() => {
    const savedTenant = localStorage.getItem(TENANT_KEY);
    const savedStores = localStorage.getItem(STORES_KEY);
    const savedCurrentId = localStorage.getItem(CURRENT_STORE_KEY);

    const t = savedTenant ? { ...DEFAULT_TENANT, ...JSON.parse(savedTenant) } : DEFAULT_TENANT;
    const s = savedStores ? JSON.parse(savedStores) : [DEFAULT_STORE];

    setTenant(t);
    setStores(s);
    setCurrentStoreState(s.find((st: Store) => st.id === savedCurrentId) || s[0] || null);
    setLoading(false);
  }, []);

  // Sync from external tenant (embedded mode)
  useEffect(() => {
    if (!integration.externalTenant) return;

    const ext = integration.externalTenant;

    const nextTenant: Tenant = {
      id: ext.tenant.id,
      name: ext.tenant.name,
      slug: ext.tenant.slug,
      logo_url: ext.tenant.logo_url,
      primary_color: ext.tenant.primary_color,
      secondary_color: ext.tenant.secondary_color,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    setTenant(nextTenant);

    if (ext.stores && ext.stores.length > 0) {
      const mapped: Store[] = ext.stores.map(s => ({
        id: s.id,
        tenant_id: nextTenant.id,
        name: s.name,
        slug: s.id,
        address: s.address || "",
        city: s.city || "",
        state: s.state || "",
        zip: s.zip || "",
        phone: s.phone || "",
        logo_url: s.logo_url || "",
        tagline: s.tagline || "",
        primary_color: ext.tenant.primary_color,
        created_at: new Date().toISOString(),
        is_active: true,
      }));
      setStores(mapped);
      setCurrentStoreState(mapped[0]);
    }
  }, [integration.externalTenant]);

  const persist = (t: Tenant, s: Store[]) => {
    // Don't persist when embedded — parent owns the data
    if (integration.mode === "embedded") return;
    localStorage.setItem(TENANT_KEY, JSON.stringify(t));
    localStorage.setItem(STORES_KEY, JSON.stringify(s));
  };

  const setCurrentStore = (store: Store) => {
    setCurrentStoreState(store);
    localStorage.setItem(CURRENT_STORE_KEY, store.id);
    // Notify parent when running embedded
    integration.sendToParent("store_change", { storeId: store.id });
  };

  const addStore = (data: Omit<Store, "id" | "created_at">) => {
    const newStore: Store = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const next = [...stores, newStore];
    setStores(next);
    if (tenant) persist(tenant, next);
  };

  const updateStore = (id: string, updates: Partial<Store>) => {
    const next = stores.map(s => s.id === id ? { ...s, ...updates } : s);
    setStores(next);
    if (currentStore?.id === id) setCurrentStoreState({ ...currentStore, ...updates });
    if (tenant) persist(tenant, next);
  };

  const deleteStore = (id: string) => {
    const next = stores.filter(s => s.id !== id);
    setStores(next);
    if (currentStore?.id === id) {
      const fallback = next[0] || null;
      setCurrentStoreState(fallback);
      if (fallback) localStorage.setItem(CURRENT_STORE_KEY, fallback.id);
    }
    if (tenant) persist(tenant, next);
  };

  const updateTenant = (updates: Partial<Tenant>) => {
    const next = { ...tenant!, ...updates };
    setTenant(next);
    persist(next, stores);
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        stores,
        currentStore,
        setCurrentStore,
        addStore,
        updateStore,
        deleteStore,
        updateTenant,
        loading,
        mode: integration.mode,
        isEmbedded: integration.mode === "embedded",
        isStandalone: integration.mode === "standalone",
        isOnboardingComplete: integration.isOnboardingComplete,
        completeOnboarding: integration.completeOnboarding,
        parentOrigin: integration.parentOrigin,
        externalUser: integration.externalTenant?.user || null,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
};
