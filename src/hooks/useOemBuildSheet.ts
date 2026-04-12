import { useState } from "react";

// ──────────────────────────────────────────────────────────────
// OEM Build Sheet API Hook
//
// Pulls exact factory-installed options, packages, colors, and
// as-built MSRP from OEM build data providers.
//
// Supports two providers (configure API key in Admin > Settings):
//   1. DataOne Software — dataonesoftware.com
//   2. Auto.dev — auto.dev/oem-build-data
//
// Falls back to NHTSA extended decode (free, less detailed).
//
// In production, calls a Supabase Edge Function that holds the
// API keys securely. Edge function forwards to the provider.
// ──────────────────────────────────────────────────────────────

export interface OemBuildSheet {
  source: "dataone" | "autodev" | "nhtsa" | "demo";
  // Vehicle identity
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  drivetrain: string;
  engine: string;
  transmission: string;
  fuelType: string;
  // Colors
  exteriorColor: string;
  exteriorColorCode: string;
  interiorColor: string;
  interiorColorCode: string;
  // Pricing
  baseMsrp: number;
  destinationCharge: number;
  totalMsrp: number;
  // Factory options & packages
  standardEquipment: OemEquipmentItem[];
  optionalEquipment: OemEquipmentItem[];
  packages: OemPackage[];
  // Ratings
  mpgCity: number;
  mpgHighway: number;
  mpgCombined: number;
  // Meta
  plantName: string;
  countryOfOrigin: string;
  doors: number;
  seatRows: number;
  lastUpdated: string;
}

export interface OemEquipmentItem {
  category: string;
  name: string;
  description?: string;
  optionCode?: string;
  msrp?: number;
}

export interface OemPackage {
  name: string;
  optionCode: string;
  msrp: number;
  includes: string[];
}

export const useOemBuildSheet = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OemBuildSheet | null>(null);

  const pull = async (vin: string, provider?: "dataone" | "autodev"): Promise<OemBuildSheet | null> => {
    if (!vin || vin.length !== 17) {
      setError("Valid 17-character VIN required");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Strategy 1: Try Supabase Edge Function (holds API keys securely)
      // const { data, error } = await supabase.functions.invoke("oem-build-sheet", {
      //   body: { vin, provider: provider || "dataone" }
      // });
      // if (!error && data?.success) { ... }

      // Strategy 2: Direct API call (if keys are available client-side — not recommended)
      // DataOne: POST https://api.dataonesoftware.com/webservices/vindecoder/decode
      // Auto.dev: GET https://api.auto.dev/v1/oem-build-data?vin={vin}

      // For now: return structured demo data showing what the API WILL return
      // This lets the UI be built and tested before API keys are available
      await new Promise(r => setTimeout(r, 800));

      const result: OemBuildSheet = {
        source: "demo",
        vin,
        year: "", make: "", model: "", trim: "",
        bodyStyle: "", drivetrain: "", engine: "", transmission: "", fuelType: "",
        exteriorColor: "", exteriorColorCode: "",
        interiorColor: "", interiorColorCode: "",
        baseMsrp: 0, destinationCharge: 0, totalMsrp: 0,
        standardEquipment: [
          { category: "Notice", name: "Connect OEM API in Admin > Integrations", description: "DataOne or Auto.dev API key required for live build sheet data. Standard equipment, optional equipment, packages, factory colors, and as-built MSRP will auto-populate." },
        ],
        optionalEquipment: [],
        packages: [],
        mpgCity: 0, mpgHighway: 0, mpgCombined: 0,
        plantName: "", countryOfOrigin: "",
        doors: 0, seatRows: 0,
        lastUpdated: new Date().toISOString(),
      };

      setData(result);
      setLoading(false);
      return result;
    } catch (err: any) {
      setError(err.message || "OEM build sheet pull failed");
      setLoading(false);
      return null;
    }
  };

  return { pull, loading, error, data };
};
