import { useState } from "react";

export interface VinDecodeResult {
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  driveType: string;
  fuelType: string;
  engineDescription: string;
  doors: string;
  ymm: string;
}

const NHTSA_API = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

export const useVinDecode = () => {
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decode = async (vin: string): Promise<VinDecodeResult | null> => {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
      setError("VIN must be exactly 17 characters");
      return null;
    }

    setDecoding(true);
    setError(null);

    try {
      const res = await fetch(`${NHTSA_API}/${cleaned}?format=json`);
      if (!res.ok) throw new Error("NHTSA API request failed");

      const json = await res.json();
      const result = json.Results?.[0];
      if (!result) throw new Error("No results returned");

      const errorCode = result.ErrorCode;
      if (errorCode && errorCode !== "0" && !errorCode.includes("0")) {
        const msg = result.ErrorText || "VIN could not be decoded";
        if (!result.ModelYear && !result.Make) {
          setError(msg);
          setDecoding(false);
          return null;
        }
      }

      const year = result.ModelYear || "";
      const make = result.Make || "";
      const model = result.Model || "";
      const trim = result.Trim || "";
      const bodyStyle = result.BodyClass || "";
      const driveType = result.DriveType || "";
      const fuelType = result.FuelTypePrimary || "";
      const doors = result.Doors || "";
      const displacement = result.DisplacementL ? `${result.DisplacementL}L` : "";
      const cylinders = result.EngineCylinders ? `${result.EngineCylinders}-cyl` : "";
      const engineDescription = [displacement, cylinders].filter(Boolean).join(" ");

      const ymmParts = [year, make, model];
      if (trim) ymmParts.push(trim);
      const ymm = ymmParts.join(" ");

      setDecoding(false);
      return { year, make, model, trim, bodyStyle, driveType, fuelType, engineDescription, doors, ymm };
    } catch (err: any) {
      setError(err.message || "Failed to decode VIN");
      setDecoding(false);
      return null;
    }
  };

  return { decode, decoding, error };
};
