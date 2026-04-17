import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Recall {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportReceivedDate: string;
  manufacturer: string;
}

export interface RecallResult {
  recalls: Recall[];
  hasOpenRecall: boolean;
  hasStopSale: boolean;
  hasTakata: boolean;
  lastChecked: string;
}

export const useRecallLookup = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, { at: number; data: RecallResult }>>({});

  const lookup = useCallback(
    async (input: {
      vin?: string;
      make: string;
      model: string;
      year: string;
    }): Promise<RecallResult | null> => {
      const cacheKey = `${input.year}-${input.make}-${input.model}-${input.vin || ""}`;
      const cached = cacheRef.current[cacheKey];
      const now = Date.now();
      const ttl = 24 * 60 * 60 * 1000; // 24 hours

      if (cached && now - cached.at < ttl) {
        return cached.data;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "nhtsa-recall",
          { body: input }
        );

        if (invokeError) {
          setError(invokeError.message || "Failed to fetch recalls");
          return null;
        }

        const result = data as RecallResult;
        cacheRef.current[cacheKey] = { at: now, data: result };
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { lookup, loading, error };
};
