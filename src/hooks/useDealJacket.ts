import { useState } from "react";

export interface DealJacketDocument {
  id: string;
  type: "addendum" | "buyers_guide" | "window_sticker" | "trade_up" | "video" | "carfax" | "cpo_checklist" | "financing" | "contract" | "other";
  label: string;
  url: string;
  addedAt: string;
  addedBy: string;
}

export interface DealJacket {
  id: string;
  vehicleFileId: string;
  vin: string;
  customerName: string;
  documents: DealJacketDocument[];
  shareToken: string;
  shareUrl: string;
  status: "open" | "complete" | "archived";
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "deal_jackets";

export const useDealJacket = () => {
  const [jackets, setJackets] = useState<DealJacket[]>([]);

  const getAll = (): DealJacket[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const createJacket = (data: { vehicleFileId: string; vin: string; customerName: string; createdBy: string }): DealJacket => {
    const token = crypto.randomUUID();
    const jacket: DealJacket = {
      id: crypto.randomUUID(),
      vehicleFileId: data.vehicleFileId,
      vin: data.vin,
      customerName: data.customerName,
      documents: [],
      shareToken: token,
      shareUrl: `${window.location.origin}/deal/${token}`,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const all = [...getAll(), jacket];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setJackets(all);
    return jacket;
  };

  const addDocument = (jacketId: string, doc: Omit<DealJacketDocument, "id" | "addedAt">) => {
    const all = getAll();
    const jacket = all.find(j => j.id === jacketId);
    if (!jacket) return;
    jacket.documents.push({ ...doc, id: crypto.randomUUID(), addedAt: new Date().toISOString() });
    jacket.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setJackets(all);
  };

  const getByVin = (vin: string): DealJacket | null => getAll().find(j => j.vin === vin) || null;

  return { jackets, createJacket, addDocument, getByVin };
};
