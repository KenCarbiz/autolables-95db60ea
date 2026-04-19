import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ──────────────────────────────────────────────────────────────
// Trade-In Lifecycle — Supabase-backed (public.trade_in_records).
//
// When a trade-in vehicle arrives, automatically:
// 1. VIN decode the trade
// 2. Create a vehicle file
// 3. Queue it for stickering
// 4. Generate a used-car window sticker
//
// Row shape mirrors the table (snake_case in DB, camelCase out via
// explicit mapping so existing consumers keep working).
// ──────────────────────────────────────────────────────────────

export interface TradeInRecord {
  id: string;
  tradeVin: string;
  tradeYmm: string;
  tradeMileage: number;
  tradeValue: number;
  customerName: string;
  dealVin: string;
  dealYmm: string;
  receivedAt: string;
  status: "received" | "inspected" | "stickered" | "listed" | "sold";
  vehicleFileId?: string;
  notes: string;
}

interface TradeInRow {
  id: string;
  trade_vin: string;
  trade_ymm: string;
  trade_mileage: number;
  trade_value: number;
  customer_name: string;
  deal_vin: string;
  deal_ymm: string;
  received_at: string;
  status: TradeInRecord["status"];
  vehicle_file_id: string | null;
  notes: string;
}

const fromRow = (r: TradeInRow): TradeInRecord => ({
  id: r.id,
  tradeVin: r.trade_vin,
  tradeYmm: r.trade_ymm,
  tradeMileage: r.trade_mileage,
  tradeValue: Number(r.trade_value),
  customerName: r.customer_name,
  dealVin: r.deal_vin,
  dealYmm: r.deal_ymm,
  receivedAt: r.received_at,
  status: r.status,
  vehicleFileId: r.vehicle_file_id || undefined,
  notes: r.notes || "",
});

export const useTradeInLifecycle = () => {
  const [records, setRecords] = useState<TradeInRecord[]>([]);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("trade_in_records")
      .select("*")
      .order("received_at", { ascending: false });
    setRecords(((data as TradeInRow[]) || []).map(fromRow));
  }, []);

  useEffect(() => { load(); }, [load]);

  const receiveTradeIn = useCallback(async (data: {
    tradeVin: string;
    tradeYmm: string;
    tradeMileage: number;
    tradeValue: number;
    customerName: string;
    dealVin: string;
    dealYmm: string;
    notes?: string;
  }): Promise<TradeInRecord | null> => {
    const { data: row, error } = await (supabase as any)
      .from("trade_in_records")
      .insert({
        trade_vin: data.tradeVin,
        trade_ymm: data.tradeYmm,
        trade_mileage: data.tradeMileage,
        trade_value: data.tradeValue,
        customer_name: data.customerName,
        deal_vin: data.dealVin,
        deal_ymm: data.dealYmm,
        notes: data.notes || "",
        status: "received",
      })
      .select()
      .single();
    if (error || !row) return null;
    await load();
    return fromRow(row as TradeInRow);
  }, [load]);

  const updateStatus = useCallback(async (id: string, status: TradeInRecord["status"], vehicleFileId?: string) => {
    const patch: Record<string, unknown> = { status };
    if (vehicleFileId) patch.vehicle_file_id = vehicleFileId;
    await (supabase as any).from("trade_in_records").update(patch).eq("id", id);
    await load();
  }, [load]);

  const getPending = (): TradeInRecord[] =>
    records.filter(r => r.status === "received" || r.status === "inspected");

  return { records, receiveTradeIn, updateStatus, getPending, getAll: () => records };
};
