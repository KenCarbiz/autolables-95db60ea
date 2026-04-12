import { useState } from "react";

// ──────────────────────────────────────────────────────────────
// DMS Feed Integration
//
// Connects to dealer management systems to auto-sync inventory.
// Supports three major DMS providers:
//   1. CDK Drive (formerly ADP) — REST API
//   2. Reynolds & Reynolds — SFTP / API
//   3. Dealertrack — REST API
//
// In production, a Supabase Edge Function handles authentication
// and data transformation. The hook receives normalized inventory.
// ──────────────────────────────────────────────────────────────

export type DmsProvider = "cdk" | "reynolds" | "dealertrack" | "tekion" | "other";

export interface DmsConfig {
  provider: DmsProvider;
  dealerId: string;
  apiKey?: string;
  apiSecret?: string;
  sftpHost?: string;
  sftpUser?: string;
  feedUrl?: string;
  syncFrequency: "hourly" | "daily" | "manual";
  lastSync: string | null;
  status: "connected" | "disconnected" | "error";
}

export interface DmsVehicle {
  vin: string;
  stockNumber: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  condition: "new" | "used" | "cpo";
  mileage: number;
  msrp: number;
  price: number;
  exteriorColor: string;
  interiorColor: string;
  bodyStyle: string;
  status: "in_stock" | "in_transit" | "sold" | "hold";
  daysOnLot: number;
  photos: string[];
  lastUpdated: string;
}

const CONFIG_KEY = "dms_config";
const VEHICLES_KEY = "dms_vehicles";

export const useDmsFeed = () => {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConfig = (): DmsConfig | null => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch { return null; }
  };

  const saveConfig = (config: DmsConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  };

  const getVehicles = (): DmsVehicle[] => {
    try { return JSON.parse(localStorage.getItem(VEHICLES_KEY) || "[]"); } catch { return []; }
  };

  const syncInventory = async (): Promise<{ count: number }> => {
    const config = getConfig();
    if (!config) {
      setError("No DMS configured. Go to Admin > Settings to connect your DMS.");
      return { count: 0 };
    }

    setSyncing(true);
    setError(null);

    try {
      // In production:
      // const { data, error } = await supabase.functions.invoke("dms-sync", {
      //   body: { provider: config.provider, dealerId: config.dealerId, credentials: { ... } }
      // });

      // For now, return demo status
      await new Promise(r => setTimeout(r, 1000));

      config.lastSync = new Date().toISOString();
      config.status = "connected";
      saveConfig(config);

      setSyncing(false);
      return { count: getVehicles().length };
    } catch (err: any) {
      setError(err.message || "DMS sync failed");
      setSyncing(false);
      return { count: 0 };
    }
  };

  return { getConfig, saveConfig, getVehicles, syncInventory, syncing, error };
};
