import { useState } from "react";

export interface VehicleLocation {
  vin: string;
  lat: number;
  lng: number;
  accuracy: number;
  lot: string;
  row?: string;
  space?: string;
  updatedAt: string;
  updatedBy: string;
}

const STORAGE_KEY = "vehicle_locations";

export const useGpsTracking = () => {
  const [tracking, setTracking] = useState(false);

  const getAll = (): VehicleLocation[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const pinLocation = async (vin: string, userId: string, lot?: string, row?: string, space?: string): Promise<VehicleLocation | null> => {
    setTracking(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const loc: VehicleLocation = {
        vin, lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, lot: lot || "Main",
        row, space, updatedAt: new Date().toISOString(), updatedBy: userId,
      };
      const all = getAll().filter(l => l.vin !== vin);
      all.push(loc);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setTracking(false);
      return loc;
    } catch {
      setTracking(false);
      return null;
    }
  };

  const getByVin = (vin: string): VehicleLocation | null => getAll().find(l => l.vin === vin) || null;

  return { pinLocation, getByVin, tracking, getAll };
};
