// ──────────────────────────────────────────────────────────────
// Plan Tier Presets
//
// Each tier enables a specific set of features. When a dealer
// picks a tier during onboarding (or upgrades later), all the
// right feature flags flip automatically.
// ──────────────────────────────────────────────────────────────

import type { DealerSettings } from "@/contexts/DealerSettingsContext";

export type PlanTier = "sticker" | "compliance" | "enterprise";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  features: string[];
  notIncluded?: string[];
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    tier: "sticker",
    name: "Sticker",
    tagline: "Window stickers + labels. No signing, no compliance trail.",
    price: "Free",
    priceNote: "Free with AutoLabels.io subscription",
    features: [
      "Used car window sticker",
      "New car addendum sticker",
      "FTC Buyers Guide (print only)",
      "CPO info sheet",
      "Trade-up promotional stickers (28 templates)",
      "VIN decode (NHTSA free)",
      "Stock number labels (Zebra-ready)",
      "Product icons on stickers",
      "VIN barcode on stickers",
      "URL import from dealer website",
      "Ink-saving print mode",
      "Basic inventory (print queue)",
      "Mobile lot scanner",
      "Scalable paper sizes",
      "SEO description writer",
    ],
    notIncluded: [
      "Digital signing",
      "Compliance audit trail",
      "State compliance engine",
      "Vehicle file system",
      "Get-ready tracker",
      "Financing impact disclosure",
      "Customer transparency portal",
      "Leads + analytics",
      "Deal jacket",
      "Email distribution",
    ],
  },
  {
    tier: "compliance",
    name: "Compliance Suite",
    tagline: "Full FTC + state compliance with digital signing and audit trail.",
    price: "$495",
    priceNote: "per location / month",
    features: [
      "Everything in Sticker, PLUS:",
      "Digital signing (customer + co-buyer + employee)",
      "FTC compliance audit trail (immutable, timestamped)",
      "State compliance engine (50 states auto-applied)",
      "CA CARS Act compliance (SB 766)",
      "Vehicle file system with tracking codes (UPC)",
      "Get-ready tracker with timeline validation",
      "Financing impact disclosure",
      "Customer transparency portal",
      "Mobile signing with FTC warranty + mileage sign-off",
      "Price override at signing (doc fee locked)",
      "Privacy notice inclusion",
      "Buyer + co-buyer info capture",
      "Lead capture + CSV export",
      "Analytics dashboard",
      "Deal jacket",
      "Email distribution (PDF to F&I, GSM, GM, customer)",
      "Compliance knowledge center",
      "Dealer legal sign-off agreement",
      "Multi-language disclosures (EN/ES/ZH/TL/VI/KO)",
    ],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "Multi-store, DMS integration, AI, and dedicated support.",
    price: "Custom",
    priceNote: "Contact sales",
    features: [
      "Everything in Compliance Suite, PLUS:",
      "Multi-store management",
      "OEM build sheet API (DataOne)",
      "Black Book live market data",
      "DMS integration (CDK, Reynolds, Dealertrack)",
      "AI vehicle descriptions (Claude)",
      "Website syndication feed",
      "SMS delivery (Twilio)",
      "Zebra CloudPrint integration",
      "GPS lot tracking",
      "Video walkarounds",
      "Photo capture + background removal",
      "Predictive product acceptance AI",
      "Trade-in lifecycle automation",
      "Post-sale review request automation",
      "Service drive stickers",
      "White-label / custom branding",
      "Dedicated account manager",
      "Custom API access",
    ],
  },
];

// Feature flag presets for each tier
export const TIER_FEATURE_FLAGS: Record<PlanTier, Partial<DealerSettings>> = {
  sticker: {
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
  compliance: {
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
    feature_invoicing: false,
    feature_warranty: false,
    feature_payroll: false,
    feature_analytics: true,
    feature_sms: false,
    feature_ai_descriptions: false,
    feature_blackbook: false,
    privacy_notice_enabled: true,
  },
  enterprise: {
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
