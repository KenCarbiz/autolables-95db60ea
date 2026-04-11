import { useState } from "react";

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
}

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

export const useDealerScraper = () => {
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrapeDealer = async (url: string): Promise<DealerProfile | null> => {
    setScraping(true);
    setError(null);

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let html = "";
    for (const proxy of CORS_PROXIES) {
      try {
        const res = await fetch(proxy(formattedUrl), { signal: AbortSignal.timeout(15000) });
        if (res.ok) { html = await res.text(); if (html.length > 500) break; }
      } catch { continue; }
    }

    if (!html || html.length < 500) {
      setError("Could not fetch dealer website");
      setScraping(false);
      return null;
    }

    const profile = parseDealerSite(html, url);
    setScraping(false);
    return profile;
  };

  return { scrapeDealer, scraping, error };
};

function parseDealerSite(html: string, sourceUrl: string): DealerProfile {
  const profile: DealerProfile = {
    name: "", address: "", city: "", state: "", zip: "", phone: "",
    email: "", website: sourceUrl, logo_url: "", tagline: "",
    oem_brands: [], value_propositions: [],
  };

  // JSON-LD for AutoDealer or LocalBusiness
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = data["@graph"] ? data["@graph"] : [data];
      for (const item of items) {
        const type = (item["@type"] || "").toLowerCase();
        if (type.includes("autodealer") || type.includes("localbusiness") || type.includes("dealer") || type.includes("organization")) {
          if (item.name) profile.name = item.name;
          if (item.telephone) profile.phone = item.telephone;
          if (item.email) profile.email = item.email;
          if (item.slogan) profile.tagline = item.slogan;
          if (item.description && !profile.tagline) profile.tagline = String(item.description).slice(0, 200);
          if (item.logo) {
            profile.logo_url = typeof item.logo === "string" ? item.logo : (item.logo.url || "");
          }
          if (item.image && !profile.logo_url) {
            profile.logo_url = typeof item.image === "string" ? item.image : (item.image.url || "");
          }
          if (item.address) {
            const addr = typeof item.address === "string" ? {} : item.address;
            profile.address = addr.streetAddress || "";
            profile.city = addr.addressLocality || "";
            profile.state = addr.addressRegion || "";
            profile.zip = addr.postalCode || "";
          }
        }
      }
    } catch { /* */ }
  }

  // Meta tags
  const getMeta = (name: string): string => {
    const p = new RegExp(`<meta[^>]*(?:property|name)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i");
    const p2 = new RegExp(`<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${name}["']`, "i");
    const m = html.match(p) || html.match(p2);
    return m ? m[1] : "";
  };

  if (!profile.name) profile.name = getMeta("og:site_name") || getMeta("og:title") || "";
  if (!profile.tagline) profile.tagline = getMeta("og:description") || getMeta("description") || "";
  if (!profile.logo_url) profile.logo_url = getMeta("og:image") || "";

  // Title tag
  if (!profile.name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) profile.name = titleMatch[1].split(/[|\-–—]/)[0].trim();
  }

  // Phone pattern
  if (!profile.phone) {
    const phoneMatch = html.match(/(?:tel:|phone[:\s]*|call[:\s]*)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i);
    if (phoneMatch) profile.phone = phoneMatch[0].replace(/[^\d()-.\s]/g, "").trim();
  }

  // OEM brands detection
  const oemBrands = [
    "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler",
    "Dodge", "Ferrari", "Fiat", "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti",
    "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lucid",
    "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
    "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla", "Toyota",
    "Volkswagen", "Volvo",
  ];
  const lowerHtml = html.toLowerCase();
  profile.oem_brands = oemBrands.filter(b => lowerHtml.includes(b.toLowerCase()));

  // Value propositions (common dealer phrases)
  const valuePhrases = [
    "family-owned", "family owned", "award-winning", "award winning",
    "certified dealer", "premier dealer", "largest selection",
    "price guarantee", "best price", "no haggle", "one price",
    "lifetime warranty", "free delivery", "free oil changes",
    "customer satisfaction", "since \\d{4}",
  ];
  for (const phrase of valuePhrases) {
    const rx = new RegExp(`[^.]*${phrase}[^.]*\\.?`, "gi");
    const m = html.match(rx);
    if (m) {
      const cleaned = m[0].replace(/<[^>]+>/g, "").trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        profile.value_propositions.push(cleaned);
      }
    }
  }
  profile.value_propositions = [...new Set(profile.value_propositions)].slice(0, 5);

  return profile;
}
