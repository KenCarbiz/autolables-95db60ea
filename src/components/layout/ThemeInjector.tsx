import { useLayoutEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";

// Converts a hex color like "#dc2626" to HSL components "0 72% 51%"
// that match the format Tailwind CSS variables expect.
function hexToHsl(hex: string): string | null {
  const cleaned = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;

  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Default Autocurb brand colors — when tenant uses these, the CSS stylesheet
// defaults are already correct so we must NOT override them inline
// (hex→HSL rounding produces a slightly-off washed-out look).
const DEFAULT_PRIMARY = "#0f1e3c";
const DEFAULT_SECONDARY = "#2563eb";

function isDefault(hex: string, def: string): boolean {
  return !hex || hex.toLowerCase() === def;
}

/**
 * ThemeInjector watches the current tenant and applies primary/secondary
 * colors as CSS variables on :root. This lets embedded mode instantly
 * re-theme the entire UI from the parent app's postMessage payload.
 */
const ThemeInjector = () => {
  const { tenant, currentStore } = useTenant();

  useLayoutEffect(() => {
    const root = document.documentElement;

    const primary = currentStore?.primary_color || tenant?.primary_color || "";
    const secondary = tenant?.secondary_color || "";

    if (primary && !isDefault(primary, DEFAULT_PRIMARY)) {
      const hsl = hexToHsl(primary);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--navy", hsl);
        root.style.setProperty("--ring", hsl);
        root.style.setProperty("--sidebar-ring", hsl);
      }
    } else {
      ["--primary", "--navy", "--ring", "--sidebar-ring"].forEach(v =>
        root.style.removeProperty(v)
      );
    }

    if (secondary && !isDefault(secondary, DEFAULT_SECONDARY)) {
      const hsl = hexToHsl(secondary);
      if (hsl) {
        root.style.setProperty("--blue", hsl);
        root.style.setProperty("--action", hsl);
        root.style.setProperty("--sidebar-primary", hsl);
      }
    } else {
      ["--blue", "--action", "--sidebar-primary"].forEach(v =>
        root.style.removeProperty(v)
      );
    }

    // Update tab title + favicon hint based on tenant
    if (tenant?.name) {
      document.title = `${tenant.name} · Addendum Platform`;
    }
  }, [tenant, currentStore]);

  return null;
};

export default ThemeInjector;
