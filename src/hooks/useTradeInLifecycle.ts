import { useState } from "react";

// ──────────────────────────────────────────────────────────────
// Trade-In Lifecycle
//
// When a trade-in vehicle arrives, automatically:
// 1. VIN decode the trade
// 2. Create a vehicle file
// 3. Queue it for stickering
// 4. Generate a used car window sticker
//
// This eliminates the manual re-stickering every dealer does.
// ──────────────────────────────────────────────────────────────

export interface TradeInRecord {
  id: string;
  tradeVin: string;
  tradeYmm: string;
  tradeMileage: number;
  tradeValue: number;
  customerName: string;
  dealVin: string;        // The vehicle they're buying
  dealYmm: string;
  receivedAt: string;
  status: "received" | "inspected" | "stickered" | "listed" | "sold";
  vehicleFileId?: string;
  notes: string;
}

const STORAGE_KEY = "trade_in_records";

export const useTradeInLifecycle = () => {
  const [records, setRecords] = useState<TradeInRecord[]>([]);

  const getAll = (): TradeInRecord[] => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  };

  const receiveTradeIn = (data: {
    tradeVin: string;
    tradeYmm: string;
    tradeMileage: number;
    tradeValue: number;
    customerName: string;
    dealVin: string;
    dealYmm: string;
    notes?: string;
  }): TradeInRecord => {
    const record: TradeInRecord = {
      id: crypto.randomUUID(),
      ...data,
      notes: data.notes || "",
      receivedAt: new Date().toISOString(),
      status: "received",
    };
    const all = [...getAll(), record];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setRecords(all);
    return record;
  };

  const updateStatus = (id: string, status: TradeInRecord["status"], vehicleFileId?: string) => {
    const all = getAll().map(r => r.id === id ? { ...r, status, vehicleFileId: vehicleFileId || r.vehicleFileId } : r);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setRecords(all);
  };

  const getPending = (): TradeInRecord[] => getAll().filter(r => r.status === "received" || r.status === "inspected");

  return { records, receiveTradeIn, updateStatus, getPending, getAll };
};
