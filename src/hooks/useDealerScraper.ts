import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DealerProfile {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  tagline: string;
  oem_brands: string[];
  value_propositions: string[];
  hours?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
}

const normalizeUrl = (input: string): string => {
  let url = input.trim();
  if (!url) return url;
  url = url.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
};

// CORS proxy fallbacks (used if edge function also fails)
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export const useDealerScraper = () => {
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);

  const scrapeDealer = async (url: string): Promise<DealerProfile | null> => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("Please enter a URL");
      return null;
    }

    try {
      new URL(normalized);
    } catch {
      setError("Invalid URL format");
      return null;
    }

    setScraping(true);
    setError(null);
    setLastSource(null);

    let html = "";
    let sourceUrl = normalized;
    let source: string | null = null;

    // Strategy 1: Edge function (server-side, no CORS issues)
    try {
      const { data, error: fnError } = await supabase.functions.invoke("dealer-scrape", {
        body: { url: normalized },
      });
      if (!fnError && data?.success && data?.html?.length > 500) {
        html = data.html;
        sourceUrl = data.sourceUrl || normalized;
        source = "edge-function";
      }
    } catch {
      // Edge function unavailable, fall through to CORS proxies
    }

    // Strategy 2: CORS proxies
    if (!html) {
      for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxy = CORS_PROXIES[i];
        try {
          const proxyUrl = proxy(normalized);
          const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(15000),
            headers: { Accept: "text/html,application/xhtml+xml,*/*" },
          });
          if (res.ok) {
            const text = await res.text();
            if (text.length > 500) {
              html = text;
              source = ["allorigins", "corsproxy.io", "codetabs"][i];
              break;
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (!html || html.length < 500) {
      setError("Could not fetch dealer website. It may block scrapers or be offline.");
      setScraping(false);
      return null;
    }

    setLastSource(source);
    const profile = parseDealerSite(html, sourceUrl);
    setScraping(false);

    if (!profile.name && !profile.address && !profile.phone) {
      setError("Fetched the page but couldn't extract dealer info. Try a specific dealer website.");
      return null;
    }

    return profile;
  };

  return { scrapeDealer, scraping, error, lastSource };
};

// ───────────────────────────────────────────────────────────
// HTML parser — JSON-LD first, Open Graph second, HTML third
// ───────────────────────────────────────────────────────────

function parseDealerSite(html: string, sourceUrl: string): DealerProfile {
  const profile: DealerProfile = {
    name: "", address: "", city: "", state: "", zip: "", phone: "",
    email: "", website: sourceUrl, logo_url: "", tagline: "",
    oem_brands: [], value_propositions: [],
    hours: "",
    social: {},
  };

  const jsonLdBlocks = extractJsonLd(html);
  for (const block of jsonLdBlocks) applyJsonLd(block, profile);
  applyMetaTags(html, profile);
  applyHtmlPatterns(html, profile);
  detectOemBrands(html, profile);
  extractValueProps(html, profile);
  extractSocialLinks(html, profile);

  if (profile.logo_url && !profile.logo_url.startsWith("http")) {
    try {
      const base = new URL(sourceUrl);
      profile.logo_url = new URL(profile.logo_url, base.origin).href;
    } catch {
      profile.logo_url = "";
    }
  }

  return profile;
}

// ─── JSON-LD ────────────────────────────────────────────────

interface JsonLdValue {
  "@type"?: string | string[];
  "@graph"?: JsonLdValue[];
  name?: string;
  legalName?: string;
  telephone?: string;
  email?: string;
  slogan?: string;
  description?: string;
  logo?: string | { url?: string; "@type"?: string };
  image?: string | { url?: string };
  address?: string | {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  openingHours?: string | string[];
  sameAs?: string | string[];
  url?: string;
}

function extractJsonLd(html: string): JsonLdValue[] {
  const results: JsonLdValue[] = [];
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch { /* skip */ }
  }
  return results;
}

function applyJsonLd(obj: JsonLdValue, profile: DealerProfile) {
  if (!obj || typeof obj !== "object") return;
  if (obj["@graph"]) {
    for (const item of obj["@graph"]) applyJsonLd(item, profile);
    return;
  }

  const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"] || ""];
  const typeStr = types.join(" ").toLowerCase();
  const isDealer = typeStr.includes("autodealer") || typeStr.includes("automotivebusiness") ||
    typeStr.includes("localbusiness") || typeStr.includes("organization") || typeStr.includes("store");

  if (!isDealer && !obj.name) return;

  if (obj.name && !profile.name) profile.name = String(obj.name);
  if (obj.legalName && !profile.name) profile.name = String(obj.legalName);
  if (obj.telephone && !profile.phone) profile.phone = String(obj.telephone);
  if (obj.email && !profile.email) profile.email = String(obj.email);
  if (obj.slogan && !profile.tagline) profile.tagline = String(obj.slogan);
  if (obj.description && !profile.tagline) profile.tagline = String(obj.description).slice(0, 200);

  if (obj.logo && !profile.logo_url) {
    profile.logo_url = typeof obj.logo === "string" ? obj.logo : (obj.logo.url || "");
  }
  if (obj.image && !profile.logo_url) {
    profile.logo_url = typeof obj.image === "string" ? obj.image : (obj.image.url || "");
  }

  if (obj.address && !profile.address) {
    if (typeof obj.address === "object") {
      profile.address = obj.address.streetAddress || "";
      profile.city = obj.address.addressLocality || "";
      profile.state = obj.address.addressRegion || "";
      profile.zip = obj.address.postalCode || "";
    } else {
      profile.address = obj.address;
    }
  }

  if (obj.openingHours && !profile.hours) {
    const hours = Array.isArray(obj.openingHours) ? obj.openingHours.join(", ") : obj.openingHours;
    profile.hours = String(hours);
  }

  if (obj.sameAs) {
    const links = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
    for (const link of links) {
      if (!link || typeof link !== "string") continue;
      if (link.includes("facebook.com") && profile.social) profile.social.facebook = link;
      else if (link.includes("instagram.com") && profile.social) profile.social.instagram = link;
      else if ((link.includes("twitter.com") || link.includes("x.com")) && profile.social) profile.social.twitter = link;
      else if (link.includes("youtube.com") && profile.social) profile.social.youtube = link;
    }
  }
}

// ─── Meta tags ──────────────────────────────────────────────

function applyMetaTags(html: string, profile: DealerProfile) {
  const getMeta = (name: string): string => {
    const patterns = [
      new RegExp(`<meta[^>]*(?:property|name|itemprop)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name|itemprop)\\s*=\\s*["']${name}["']`, "i"),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) return m[1];
    }
    return "";
  };

  const ogTitle = getMeta("og:title");
  const ogDesc = getMeta("og:description");
  const ogImage = getMeta("og:image");
  const ogSiteName = getMeta("og:site_name");
  const metaDesc = getMeta("description");

  if (!profile.name && ogSiteName) profile.name = ogSiteName;
  if (!profile.name && ogTitle) profile.name = ogTitle.split(/[|\-–—]/)[0].trim();
  if (!profile.tagline && ogDesc) profile.tagline = ogDesc.slice(0, 200);
  if (!profile.tagline && metaDesc) profile.tagline = metaDesc.slice(0, 200);
  if (!profile.logo_url && ogImage) profile.logo_url = ogImage;
}

// ─── HTML patterns ──────────────────────────────────────────

function applyHtmlPatterns(html: string, profile: DealerProfile) {
  if (!profile.name) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) profile.name = m[1].split(/[|\-–—]/)[0].trim();
  }

  if (!profile.phone) {
    const telMatch = html.match(/href\s*=\s*["']tel:([\d\-\+\s\(\)\.]+)["']/i);
    if (telMatch) {
      profile.phone = telMatch[1].replace(/[^\d]/g, "").replace(/^1/, "");
      if (profile.phone.length === 10) {
        profile.phone = `(${profile.phone.slice(0, 3)}) ${profile.phone.slice(3, 6)}-${profile.phone.slice(6)}`;
      }
    }
  }
  if (!profile.phone) {
    const m = html.match(/(?:call|phone|tel)[^\d]{0,30}(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i);
    if (m) profile.phone = m[1].trim();
  }

  if (!profile.email) {
    const mailMatch = html.match(/href\s*=\s*["']mailto:([^"'?]+)["']/i);
    if (mailMatch) profile.email = mailMatch[1];
  }
  if (!profile.email) {
    const m = html.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
    if (m && !m[0].includes("@example.") && !m[0].includes("@dealer.com")) profile.email = m[0];
  }

  if (!profile.address) {
    const addrMatch = html.match(/<[^>]*itemprop\s*=\s*["']streetAddress["'][^>]*>([^<]+)</i);
    if (addrMatch) profile.address = addrMatch[1].trim();
  }
  if (!profile.city) {
    const cityMatch = html.match(/<[^>]*itemprop\s*=\s*["']addressLocality["'][^>]*>([^<]+)</i);
    if (cityMatch) profile.city = cityMatch[1].trim();
  }
  if (!profile.state) {
    const stateMatch = html.match(/<[^>]*itemprop\s*=\s*["']addressRegion["'][^>]*>([^<]+)</i);
    if (stateMatch) profile.state = stateMatch[1].trim();
  }
  if (!profile.zip) {
    const zipMatch = html.match(/<[^>]*itemprop\s*=\s*["']postalCode["'][^>]*>([^<]+)</i);
    if (zipMatch) profile.zip = zipMatch[1].trim();
  }

  if (!profile.address) {
    const m = html.match(/(\d{1,5}[\w\s.,]+?)\s*,\s*([A-Za-z\s.]+?)\s*,\s*([A-Z]{2})\s*(\d{5})/);
    if (m) {
      profile.address = m[1].trim();
      profile.city = profile.city || m[2].trim();
      profile.state = profile.state || m[3].trim();
      profile.zip = profile.zip || m[4].trim();
    }
  }

  if (!profile.logo_url) {
    const logoMatch = html.match(/<img[^>]*(?:class|id)\s*=\s*["'][^"']*logo[^"']*["'][^>]*src\s*=\s*["']([^"']+)["']/i)
      || html.match(/<img[^>]*src\s*=\s*["']([^"']+)["'][^>]*(?:class|id|alt)\s*=\s*["'][^"']*logo[^"']*["']/i);
    if (logoMatch) profile.logo_url = logoMatch[1];
  }
}

// ─── OEM brands ─────────────────────────────────────────────

const OEM_BRANDS = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
  "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lucid", "Maserati", "Mazda",
  "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Polestar",
  "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla", "Toyota",
  "Volkswagen", "Volvo",
];

function detectOemBrands(html: string, profile: DealerProfile) {
  const cleaned = html.replace(/<[^>]+>/g, " ").toLowerCase();
  const found = new Set<string>();
  for (const brand of OEM_BRANDS) {
    const rx = new RegExp(`\\b${brand.replace(/\s/g, "\\s*")}\\b`, "i");
    if (rx.test(cleaned)) found.add(brand);
  }
  profile.oem_brands = Array.from(found);
}

// ─── Value props ────────────────────────────────────────────

function extractValueProps(html: string, profile: DealerProfile) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const phrases = [
    /family[\s-]owned(?:\s+(?:and|&)\s+operated)?/gi,
    /award[\s-]winning/gi, /certified\s+dealer/gi, /premier\s+dealer/gi,
    /largest\s+selection/gi, /price\s+guarantee/gi, /best\s+price/gi,
    /no\s+haggle/gi, /lifetime\s+warranty/gi, /free\s+delivery/gi,
    /customer\s+satisfaction/gi, /since\s+\d{4}/gi,
  ];
  const found = new Set<string>();
  for (const rx of phrases) {
    const matches = text.match(rx);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim().replace(/\s+/g, " ");
        if (cleaned.length > 4 && cleaned.length < 80) found.add(cleaned);
      }
    }
  }
  profile.value_propositions = Array.from(found).slice(0, 8);
}

// ─── Social links ───────────────────────────────────────────

function extractSocialLinks(html: string, profile: DealerProfile) {
  if (!profile.social) profile.social = {};
  const patterns = [
    { key: "facebook" as const, rx: /href\s*=\s*["'](https?:\/\/(?:www\.)?facebook\.com\/[^\s"']+)["']/i },
    { key: "instagram" as const, rx: /href\s*=\s*["'](https?:\/\/(?:www\.)?instagram\.com\/[^\s"']+)["']/i },
    { key: "twitter" as const, rx: /href\s*=\s*["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"']+)["']/i },
    { key: "youtube" as const, rx: /href\s*=\s*["'](https?:\/\/(?:www\.)?youtube\.com\/[^\s"']+)["']/i },
  ];
  for (const { key, rx } of patterns) {
    if (profile.social[key]) continue;
    const m = html.match(rx);
    if (m) profile.social[key] = m[1];
  }
}
