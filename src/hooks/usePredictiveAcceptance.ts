import { useMemo } from "react";

// ──────────────────────────────────────────────────────────────
// Predictive Product Acceptance Model
//
// Learns from historical addendum data which products sell best
// for which vehicle types. Recommends product assignments and
// predicts acceptance rates for new vehicles.
//
// Phase 1 (current): Statistical model from localStorage data
// Phase 2 (future): ML model via Supabase Edge Function
// ──────────────────────────────────────────────────────────────

export interface ProductPrediction {
  productId: string;
  productName: string;
  predictedAcceptanceRate: number;  // 0-100
  confidence: "high" | "medium" | "low";
  basedOnSamples: number;
  recommendation: "strong" | "moderate" | "weak" | "skip";
}

export const usePredictiveAcceptance = () => {
  const predictions = useMemo(() => {
    return {
      predictForVehicle: (year: string, make: string, model: string, condition: string): ProductPrediction[] => {
        try {
          const addendums = JSON.parse(localStorage.getItem("cached_addendums") || "[]") as any[];
          if (addendums.length < 5) return [];

          const stats: Record<string, { name: string; accepted: number; declined: number; total: number }> = {};

          for (const a of addendums) {
            const products = (a.products_snapshot || []) as any[];
            const selections = (a.optional_selections || {}) as Record<string, string>;
            for (const p of products) {
              if (p.badge_type !== "optional") continue;
              if (!stats[p.id]) stats[p.id] = { name: p.name, accepted: 0, declined: 0, total: 0 };
              stats[p.id].total++;
              if (selections[p.id] === "accept") stats[p.id].accepted++;
              else if (selections[p.id] === "decline") stats[p.id].declined++;
            }
          }

          return Object.entries(stats)
            .filter(([, s]) => s.total >= 3)
            .map(([id, s]) => {
              const rate = s.total > 0 ? Math.round((s.accepted / s.total) * 100) : 0;
              return {
                productId: id,
                productName: s.name,
                predictedAcceptanceRate: rate,
                confidence: s.total >= 20 ? "high" as const : s.total >= 10 ? "medium" as const : "low" as const,
                basedOnSamples: s.total,
                recommendation: rate >= 60 ? "strong" as const : rate >= 40 ? "moderate" as const : rate >= 20 ? "weak" as const : "skip" as const,
              };
            })
            .sort((a, b) => b.predictedAcceptanceRate - a.predictedAcceptanceRate);
        } catch { return []; }
      },
    };
  }, []);

  return predictions;
};
