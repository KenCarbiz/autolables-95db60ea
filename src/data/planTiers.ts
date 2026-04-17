// ──────────────────────────────────────────────────────────────
// Plan Tier Presets
//
// Each tier enables a specific set of features. When a dealer
// picks a tier during onboarding (or upgrades later), all the
// right feature flags flip automatically.
//
// Pricing (per rooftop/month):
//   - essential      $299 — window stickers + addendums, up to 75 VINs/mo
//   - unlimited      $499 — unlimited VINs, product rules, analytics
//   - compliance_pro $999 — full scan-to-signed FTC compliance flow
// ──────────────────────────────────────────────────────────────

import type { DealerSettings } from "@/contexts/DealerSettingsContext";

export type PlanTier = "essential" | "unlimited" | "compliance_pro";

// ── Per-tier monthly VIN ceiling. null = unlimited.
export const TIER_VIN_LIMITS: Record<PlanTier, number | null> = {
  essential: 75,
  unlimited: null,
  compliance_pro: null,
};

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  features: string[];
  notIncluded?: string[];
  // Bundled free with any Autocurb.io subscription — surface this
  // on marketing + in the ActivatePaywall flow for autocurb-sourced tenants.
  includedWithAutocurb?: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    tier: "essential",
    name: "Essential",
    tagline: "Window stickers + addendums, up to 75 VINs/month. Free with any Autocurb.io subscription.",
    price: "$299",
    priceNote: "per rooftop / month — or free with Autocurb.io",
    includedWithAutocurb: true,
    features: [
      "Up to 75 VINs / month",
      "New + used car window stickers",
      "Full addendum builder",
      "VIN decode (NHTSA)",
      "NHTSA recall + Takata stop-sale banner",
      "Shopper-facing public portal (QR + embed)",
      "Zebra / Brother / DYMO / CUPS print",
      "FTC Buyers Guide (English)",
      "Dealer branding + logo",
      "Email support",
    ],
    notIncluded: [
      "Unlimited VINs",
      "Product rules engine",
      "Leads + analytics",
      "Digital signing + audit vault",
      "Prep + install compliance gate",
      "50-state disclosure engine",
      "Multi-language addendums",
      "DMS webhooks",
    ],
  },
  {
    tier: "unlimited",
    name: "Unlimited",
    tagline: "Unlimited vehicles for high-volume dealers.",
    price: "$499",
    priceNote: "per rooftop / month",
    features: [
      "Everything in Essential, plus:",
      "Unlimited VINs",
      "Product rules engine (YMM auto-match)",
      "Custom branding + full logo kit",
      "Leads + analytics dashboard",
      "CSV lead export",
      "Inventory management + CSV import",
      "Mobile lot scanner + GPS",
      "AI vehicle descriptions",
      "Co-buyer signature capture",
      "Priority support",
      "Onboarding assist",
    ],
    notIncluded: [
      "Digital signing + tamper-evident audit vault",
      "Prep + install compliance gate",
      "50-state disclosure engine (CA SB 766, NY, FL, etc.)",
      "Multi-language addendums",
      "DMS webhook integrations",
    ],
  },
  {
    tier: "compliance_pro",
    name: "Compliance Pro",
    tagline: "Full scan-to-signed FTC flow for airtight deals.",
    price: "$999",
    priceNote: "per rooftop / month",
    features: [
      "Everything in Unlimited, plus:",
      "50-state disclosure engine (CA, NY, FL, TX, IL, MA, NJ, +44)",
      "California SB 766 ready (effective Oct 1, 2026)",
      "Prep + install compliance gate (foreman sign-off with photos)",
      "Digital signing (customer + co-buyer + F&I manager)",
      "UETA / E-SIGN tamper-evident content hash",
      "Immutable audit vault with CSV export",
      "Multi-language addendums (en / es / zh / tl / vi / ko)",
      "Financing impact disclosure (TILA-aligned)",
      "Deal jacket + email distribution",
      "DMS webhooks (vAuto / VinSolutions / CDK / Reynolds)",
      "Black Book + OEM factory build sheet",
      "SMS delivery (Twilio)",
      "Dedicated success manager",
    ],
  },
];

// Feature flag presets for each tier
export const TIER_FEATURE_FLAGS: Record<PlanTier, Partial<DealerSettings>> = {
  essential: {
    feature_vin_decode: true,
    feature_buyers_guide: true,
    feature_product_rules: false,
    feature_product_icons: true,
    feature_vin_barcode: true,
    feature_lead_capture: false,
    feature_cobuyer_signature: false,
    feature_custom_branding: false,
    feature_ink_saving: true,
    feature_spanish_buyers_guide: false,
    feature_url_scrape: true,
    feature_inventory: false,
    feature_invoicing: false,
    feature_warranty: false,
    feature_payroll: false,
    feature_analytics: false,
    feature_sms: false,
    feature_ai_descriptions: false,
    feature_blackbook: false,
    privacy_notice_enabled: false,
  },
  unlimited: {
    feature_vin_decode: true,
    feature_buyers_guide: true,
    feature_product_rules: true,
    feature_product_icons: true,
    feature_vin_barcode: true,
    feature_lead_capture: true,
    feature_cobuyer_signature: true,
    feature_custom_branding: true,
    feature_ink_saving: true,
    feature_spanish_buyers_guide: false,
    feature_url_scrape: true,
    feature_inventory: true,
    feature_invoicing: false,
    feature_warranty: false,
    feature_payroll: false,
    feature_analytics: true,
    feature_sms: false,
    feature_ai_descriptions: true,
    feature_blackbook: false,
    privacy_notice_enabled: true,
  },
  compliance_pro: {
    feature_vin_decode: true,
    feature_buyers_guide: true,
    feature_product_rules: true,
    feature_product_icons: true,
    feature_vin_barcode: true,
    feature_lead_capture: true,
    feature_cobuyer_signature: true,
    feature_custom_branding: true,
    feature_ink_saving: true,
    feature_spanish_buyers_guide: true,
    feature_url_scrape: true,
    feature_inventory: true,
    feature_invoicing: true,
    feature_warranty: true,
    feature_payroll: true,
    feature_analytics: true,
    feature_sms: true,
    feature_ai_descriptions: true,
    feature_blackbook: true,
    privacy_notice_enabled: true,
  },
};

export const applyTierPreset = (tier: PlanTier): Partial<DealerSettings> => {
  return TIER_FEATURE_FLAGS[tier];
};
