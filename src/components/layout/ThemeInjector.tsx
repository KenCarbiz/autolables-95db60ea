import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
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

const THEME_VARIABLES = [
  "--primary",
  "--navy",
  "--ring",
  "--sidebar-ring",
  "--blue",
  "--action",
  "--sidebar-primary",
] as const;

function resetThemeVariables(root: HTMLElement) {
  THEME_VARIABLES.forEach((variable) => root.style.removeProperty(variable));
}

/**
 * ThemeInjector watches the current tenant and applies primary/secondary
 * colors as CSS variables on :root. This lets embedded mode instantly
 * re-theme the entire UI from the parent app's postMessage payload.
 */
const ThemeInjector = () => {
  const { tenant, currentStore } = useTenant();
  const location = useLocation();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const isOnboardingRoute = location.pathname === "/onboarding";

    if (isOnboardingRoute) {
      resetThemeVariables(root);
    } else {
      // Prefer store-level brand over tenant-level
      const primary = currentStore?.primary_color || tenant?.primary_color || "";
      const secondary = tenant?.secondary_color || "";

      // Only override CSS variables when a custom color is provided.
      // When no custom color is set, leave the defaults from index.css intact.
      if (primary) {
        const hsl = hexToHsl(primary);
        if (hsl) {
          root.style.setProperty("--primary", hsl);
          root.style.setProperty("--navy", hsl);
          root.style.setProperty("--ring", hsl);
          root.style.setProperty("--sidebar-ring", hsl);
        }
      }

      if (secondary) {
        const hsl = hexToHsl(secondary);
        if (hsl) {
          root.style.setProperty("--blue", hsl);
          root.style.setProperty("--action", hsl);
          root.style.setProperty("--sidebar-primary", hsl);
        }
      }
    }

    // Update tab title + favicon hint based on tenant
    if (tenant?.name) {
      document.title = `${tenant.name} · Addendum Platform`;
    }
  }, [tenant, currentStore, location.pathname]);

  return null;
};

export default ThemeInjector;
