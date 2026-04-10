import { useState, useEffect } from "react";
import { Product } from "./useProducts";

export interface ProductRule {
  id: string;
  product_id: string;
  year_min: string;
  year_max: string;
  makes: string[];       // empty = all makes
  models: string[];      // empty = all models
  trims: string[];       // empty = all trims
  body_styles: string[]; // empty = all
  condition: "new" | "used" | "all";
  mileage_max: number;   // 0 = no limit
}

export interface VehicleContext {
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  condition?: "new" | "used";
  mileage?: number;
}

const STORAGE_KEY = "product_rules";

export const useProductRules = () => {
  const [rules, setRules] = useState<ProductRule[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setRules(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const saveRules = (next: ProductRule[]) => {
    setRules(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addRule = (rule: Omit<ProductRule, "id">) => {
    const newRule: ProductRule = { ...rule, id: crypto.randomUUID() };
    saveRules([...rules, newRule]);
    return newRule;
  };

  const updateRule = (id: string, updates: Partial<ProductRule>) => {
    saveRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  };

  const getMatchingProducts = (vehicle: VehicleContext, allProducts: Product[]): Product[] => {
    if (!vehicle.year && !vehicle.make && !vehicle.model) return allProducts;

    const matchedProductIds = new Set<string>();

    // Products with no rules always show
    const productsWithRules = new Set(rules.map(r => r.product_id));

    allProducts.forEach(p => {
      if (!productsWithRules.has(p.id)) {
        matchedProductIds.add(p.id);
      }
    });

    // Check each rule
    for (const rule of rules) {
      if (matchesRule(rule, vehicle)) {
        matchedProductIds.add(rule.product_id);
      }
    }

    return allProducts.filter(p => matchedProductIds.has(p.id));
  };

  return { rules, addRule, updateRule, deleteRule, getMatchingProducts };
};

function matchesRule(rule: ProductRule, vehicle: VehicleContext): boolean {
  const vYear = parseInt(vehicle.year) || 0;
  const rMin = parseInt(rule.year_min) || 0;
  const rMax = parseInt(rule.year_max) || 9999;

  if (vYear && (vYear < rMin || vYear > rMax)) return false;

  if (rule.makes.length > 0 && vehicle.make) {
    const vmake = vehicle.make.toLowerCase();
    if (!rule.makes.some(m => m.toLowerCase() === vmake)) return false;
  }

  if (rule.models.length > 0 && vehicle.model) {
    const vmodel = vehicle.model.toLowerCase();
    if (!rule.models.some(m => m.toLowerCase() === vmodel)) return false;
  }

  if (rule.trims.length > 0 && vehicle.trim) {
    const vtrim = vehicle.trim.toLowerCase();
    if (!rule.trims.some(t => t.toLowerCase() === vtrim)) return false;
  }

  if (rule.body_styles.length > 0 && vehicle.bodyStyle) {
    const vbody = vehicle.bodyStyle.toLowerCase();
    if (!rule.body_styles.some(b => b.toLowerCase() === vbody)) return false;
  }

  if (rule.condition !== "all" && vehicle.condition && rule.condition !== vehicle.condition) {
    return false;
  }

  if (rule.mileage_max > 0 && vehicle.mileage && vehicle.mileage > rule.mileage_max) {
    return false;
  }

  return true;
}
