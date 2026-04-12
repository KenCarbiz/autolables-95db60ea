import { useState } from "react";

// ──────────────────────────────────────────────────────────────
// Vehicle Photo Capture + Background Removal
//
// Captures vehicle photos on the lot and optionally removes
// the background for professional listing images.
//
// Phase 1: Capture + store as base64/blob URLs
// Phase 2: Send to background removal API (remove.bg, photoroom)
//          via Supabase Edge Function
// ──────────────────────────────────────────────────────────────

export interface VehiclePhoto {
  id: string;
  vin: string;
  angle: "front" | "rear" | "driver_side" | "passenger_side" | "interior" | "dashboard" | "engine" | "other";
  originalUrl: string;
  processedUrl?: string;    // Background removed version
  capturedAt: string;
  capturedBy: string;
  status: "captured" | "processing" | "processed" | "failed";
}

const STORAGE_KEY = "vehicle_photos";

export const usePhotoCapture = () => {
  const [processing, setProcessing] = useState(false);

  const getAll = (): VehiclePhoto[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const addPhoto = (data: {
    vin: string;
    angle: VehiclePhoto["angle"];
    imageDataUrl: string;
    capturedBy: string;
  }): VehiclePhoto => {
    const photo: VehiclePhoto = {
      id: crypto.randomUUID(),
      vin: data.vin,
      angle: data.angle,
      originalUrl: data.imageDataUrl,
      capturedAt: new Date().toISOString(),
      capturedBy: data.capturedBy,
      status: "captured",
    };
    const all = [...getAll(), photo];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return photo;
  };

  const removeBackground = async (photoId: string): Promise<boolean> => {
    setProcessing(true);
    // In production:
    // const { data } = await supabase.functions.invoke("remove-background", { body: { photoId } });
    // Update photo with processedUrl
    const all = getAll().map(p => p.id === photoId ? { ...p, status: "processed" as const, processedUrl: p.originalUrl } : p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setProcessing(false);
    return true;
  };

  const getByVin = (vin: string): VehiclePhoto[] => getAll().filter(p => p.vin === vin);
  const deletePhoto = (id: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getAll().filter(p => p.id !== id)));
  };

  return { addPhoto, removeBackground, getByVin, deletePhoto, processing };
};
