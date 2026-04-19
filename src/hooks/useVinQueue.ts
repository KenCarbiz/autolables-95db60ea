import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ──────────────────────────────────────────────────────────────
// useVinQueue — Supabase-backed (Wave 9).
//
// Was localStorage ("vin_queue") with a companion "vin_queue_data"
// side-car for decoded_data. Now one tenant-scoped table holds
// everything: the queue row plus condition + decoded NHTSA /
// factory data as JSONB. tenant_id is auto-filled server-side via
// set_tenant_id_vin_queue.
// ──────────────────────────────────────────────────────────────

export interface QueuedVehicle {
  id: string;
  vin: string;
  stock_number: string;
  mileage: string;
  scanned_at: string;
  status: "queued" | "processing" | "completed" | "error";
  condition?: "new" | "used" | "cpo" | null;
  decoded_data?: Record<string, unknown>;
  notes: string;
}

export const useVinQueue = () => {
  const [queue, setQueue] = useState<QueuedVehicle[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("vin_queue")
      .select("*")
      .order("scanned_at", { ascending: false });
    setQueue(((data as QueuedVehicle[]) || []));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addToQueue = useCallback(async (
    vin: string,
    stockNumber: string,
    mileage: string,
    opts?: {
      notes?: string;
      condition?: QueuedVehicle["condition"];
      decoded_data?: Record<string, unknown>;
    }
  ): Promise<QueuedVehicle | null> => {
    const { data, error } = await (supabase as any)
      .from("vin_queue")
      .insert({
        vin: vin.toUpperCase().trim(),
        stock_number: stockNumber.trim(),
        mileage: mileage.trim(),
        notes: opts?.notes || "",
        condition: opts?.condition || null,
        decoded_data: opts?.decoded_data || {},
        status: "queued",
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as QueuedVehicle;
  }, [load]);

  const updateItem = useCallback(async (id: string, updates: Partial<QueuedVehicle>) => {
    await (supabase as any).from("vin_queue").update(updates).eq("id", id);
    await load();
  }, [load]);

  const removeItem = useCallback(async (id: string) => {
    await (supabase as any).from("vin_queue").delete().eq("id", id);
    await load();
  }, [load]);

  const clearCompleted = useCallback(async () => {
    await (supabase as any).from("vin_queue").delete().eq("status", "completed");
    await load();
  }, [load]);

  const getQueued    = () => queue.filter(q => q.status === "queued");
  const getCompleted = () => queue.filter(q => q.status === "completed");

  return {
    queue,
    loading,
    addToQueue,
    updateItem,
    removeItem,
    clearCompleted,
    getQueued,
    getCompleted,
  };
};
