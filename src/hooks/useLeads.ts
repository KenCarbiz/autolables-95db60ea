import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/tenant";

// ──────────────────────────────────────────────────────────────
// useLeads — Supabase-backed. Reads the current tenant's rows
// from public.leads (tenant_id auto-filled server-side via
// set_tenant_id_leads trigger).
// ──────────────────────────────────────────────────────────────

export const useLeads = (storeId: string) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) { setLeads([]); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("leads")
      .select("*")
      .eq("store_id", storeId)
      .order("captured_at", { ascending: false });
    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const addLead = useCallback(
    async (data: Omit<Lead, "id" | "captured_at" | "updated_at">): Promise<Lead | null> => {
      const { data: row, error } = await (supabase as any)
        .from("leads")
        .insert({
          store_id: data.store_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          vehicle_interest: data.vehicle_interest,
          vehicle_vin: data.vehicle_vin,
          source: data.source,
          signing_url: data.signing_url,
          status: data.status,
          notes: data.notes,
        })
        .select()
        .single();
      if (error || !row) return null;
      await load();
      return row as Lead;
    },
    [load]
  );

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    await (supabase as any).from("leads").update(updates).eq("id", id);
    await load();
  }, [load]);

  const deleteLead = useCallback(async (id: string) => {
    await (supabase as any).from("leads").delete().eq("id", id);
    await load();
  }, [load]);

  const exportCsv = (): string => {
    const header = "Name,Phone,Email,Vehicle,VIN,Source,Status,Captured At";
    const rows = leads.map(l =>
      `"${l.name}","${l.phone}","${l.email}","${l.vehicle_interest}","${l.vehicle_vin}","${l.source}","${l.status}","${l.captured_at}"`
    );
    return [header, ...rows].join("\n");
  };

  return { leads, loading, addLead, updateLead, deleteLead, exportCsv };
};
