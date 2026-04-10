import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface DealerSettings {
  // Branding
  dealer_name: string;
  dealer_tagline: string;
  dealer_logo_url: string;
  primary_color: string;
  // Feature toggles — what shows on the employee-facing addendum
  feature_vin_decode: boolean;
  feature_buyers_guide: boolean;
  feature_product_rules: boolean;
  feature_product_icons: boolean;
  feature_vin_barcode: boolean;
  feature_lead_capture: boolean;
  feature_cobuyer_signature: boolean;
  feature_custom_branding: boolean;
  feature_ink_saving: boolean;
  feature_spanish_buyers_guide: boolean;
}

export const DEFAULT_SETTINGS: DealerSettings = {
  dealer_name: "Harte Auto Group",
  dealer_tagline: "Connecticut's Premier Family-Owned Dealer Group Since 1995",
  dealer_logo_url: "",
  primary_color: "",
  feature_vin_decode: true,
  feature_buyers_guide: true,
  feature_product_rules: true,
  feature_product_icons: true,
  feature_vin_barcode: true,
  feature_lead_capture: true,
  feature_cobuyer_signature: true,
  feature_custom_branding: false,
  feature_ink_saving: true,
  feature_spanish_buyers_guide: false,
};

interface DealerSettingsContextType {
  settings: DealerSettings;
  loading: boolean;
  updateSettings: (updates: Partial<DealerSettings>) => Promise<void>;
}

const DealerSettingsContext = createContext<DealerSettingsContextType | undefined>(undefined);

const STORAGE_KEY = "dealer_settings";

export const DealerSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<DealerSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage (Supabase table can be added later for multi-store)
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch {
        // ignore parse errors
      }
    }
    setLoading(false);
  }, []);

  const updateSettings = async (updates: Partial<DealerSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <DealerSettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </DealerSettingsContext.Provider>
  );
};

export const useDealerSettings = () => {
  const ctx = useContext(DealerSettingsContext);
  if (!ctx) throw new Error("useDealerSettings must be used within DealerSettingsProvider");
  return ctx;
};
