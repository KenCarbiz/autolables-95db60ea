// ──────────────────────────────────────────────────────────────
// E-SIGN / UETA helpers — required to make AutoLabels digital
// signatures legally defensible.
//
// What this captures, in order of statutory importance:
//   1. Explicit CONSENT to do business electronically (ESIGN Act
//      15 USC §7001(c)) — including the disclosures this Act
//      demands (paper-copy right, withdrawal right, hardware
//      requirements, retention).
//   2. CONTENT HASH — tamper-evident SHA-256 of the canonical
//      payload the customer saw and signed.
//   3. IP + USER AGENT — a reasonable "at-signing" environment
//      record. We fetch IP via ipify (fail-open, best effort).
//   4. TIMESTAMP — provided by the server via Supabase timestamptz.
// ──────────────────────────────────────────────────────────────

export const ESIGN_CONSENT_TEXT = `
ELECTRONIC RECORDS AND SIGNATURES DISCLOSURE

By checking the box and signing below, you agree to use electronic records
and signatures for this transaction and you acknowledge the following:

1. You may request a paper copy of any signed document at no charge by
   contacting the dealership directly.
2. You may withdraw your consent to conduct this transaction electronically
   at any time before you sign by contacting the dealership. Withdrawing
   consent does not affect the legal validity of any document you have
   already signed electronically.
3. To view and sign these documents, you need a device with a modern web
   browser (Chrome, Safari, Firefox, or Edge released within the last two
   years), internet access, and the ability to receive email or SMS.
4. Your signed documents will be retained for the period required by
   applicable federal and state law (generally no less than 2 years) and
   are available by request.
5. Your signature, initials, selections, and the exact contents of the
   document as presented to you are hashed (SHA-256) and stored so that
   any later modification can be detected.
6. This consent applies only to this transaction.

Federal law (15 U.S.C. §7001, E-SIGN Act) and state Uniform Electronic
Transactions Act (UETA) provisions treat your electronic signature as
legally equivalent to a handwritten signature for this purpose.
`.trim();

export interface EsignConsentRecord {
  version: string;
  consent_text: string;
  consented_at: string;
  user_agent: string;
  language: string;
  paper_copy_notice: true;
  withdraw_right_notice: true;
  hardware_notice: true;
}

export const buildConsentRecord = (): EsignConsentRecord => ({
  version: "v1-2026-04",
  consent_text: ESIGN_CONSENT_TEXT,
  consented_at: new Date().toISOString(),
  user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  language: typeof navigator !== "undefined" ? navigator.language : "en-US",
  paper_copy_notice: true,
  withdraw_right_notice: true,
  hardware_notice: true,
});

// Canonical JSON stringifier — keys sorted deterministically so the
// hash is stable regardless of object key order.
const canonicalStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
};

export const sha256Hex = async (input: string): Promise<string> => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Fail-open: we never want to block signing because of a missing
    // Web Crypto implementation (ancient browser). Record a sentinel
    // so audit reviewers can spot it.
    return "NOSUBTLE";
  }
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const hashPayload = async (payload: unknown): Promise<string> => {
  return sha256Hex(canonicalStringify(payload));
};

export const fetchClientIp = async (): Promise<string | null> => {
  // Best-effort public IP lookup for non-repudiation. Never throw.
  // In production we'd prefer a trusted edge function that reads the
  // Cloudflare / Vercel / x-forwarded-for header server-side.
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return typeof data.ip === "string" ? data.ip : null;
  } catch {
    return null;
  }
};

export const fetchGeoloc = (): Promise<{ lat: number; lon: number; accuracy: number } | null> => {
  // Prompt for geolocation — useful for signing-location audit, but
  // never blocking. Fail-open if the user denies.
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60_000 }
    );
  });
};
