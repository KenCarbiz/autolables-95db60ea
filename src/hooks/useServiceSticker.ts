import { useState } from "react";

export interface ServiceSticker {
  id: string;
  vin: string;
  vehicleYmm: string;
  customerName: string;
  lastServiceDate: string;
  lastServiceMileage: number;
  nextServiceDue: string;
  nextServiceMileage: number;
  serviceType: string;
  bookingUrl: string;
  qrUrl: string;
  dealerName: string;
  dealerPhone: string;
  printedAt: string;
  printedBy: string;
}

const STORAGE_KEY = "service_stickers";

export const useServiceSticker = () => {
  const [stickers, setStickers] = useState<ServiceSticker[]>([]);

  const getAll = (): ServiceSticker[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const create = (data: Omit<ServiceSticker, "id" | "printedAt">): ServiceSticker => {
    const sticker: ServiceSticker = { ...data, id: crypto.randomUUID(), printedAt: new Date().toISOString() };
    const all = [...getAll(), sticker];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setStickers(all);
    return sticker;
  };

  const getByVin = (vin: string): ServiceSticker[] => getAll().filter(s => s.vin === vin);

  return { stickers, create, getByVin };
};
