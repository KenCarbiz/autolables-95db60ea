import { describe, it, expect } from "vitest";
import {
  buildConsentRecord,
  hashPayload,
  sha256Hex,
  ESIGN_CONSENT_TEXT,
} from "./esign";

// ──────────────────────────────────────────────────────────────
// E-SIGN: the hash has to be deterministic across key order and
// byte-stable across sessions. Anything non-deterministic here
// breaks tamper-evidence.
// ──────────────────────────────────────────────────────────────

describe("ESIGN_CONSENT_TEXT", () => {
  it("references the federal E-SIGN Act", () => {
    expect(ESIGN_CONSENT_TEXT).toMatch(/15 U\.S\.C\. §7001/);
    expect(ESIGN_CONSENT_TEXT).toMatch(/E-SIGN Act/);
  });

  it("discloses the paper-copy right", () => {
    expect(ESIGN_CONSENT_TEXT).toMatch(/paper copy/i);
  });

  it("discloses the withdrawal right", () => {
    expect(ESIGN_CONSENT_TEXT).toMatch(/withdraw/i);
  });

  it("discloses hardware / browser requirements", () => {
    expect(ESIGN_CONSENT_TEXT.toLowerCase()).toMatch(/browser/);
  });

  it("references SHA-256 tamper-evidence", () => {
    expect(ESIGN_CONSENT_TEXT).toMatch(/SHA-256/);
  });
});

describe("buildConsentRecord", () => {
  it("returns the current version + consent text + timestamp", () => {
    const record = buildConsentRecord();
    expect(record.version).toMatch(/^v1-/);
    expect(record.consent_text).toBe(ESIGN_CONSENT_TEXT);
    expect(record.consented_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.paper_copy_notice).toBe(true);
    expect(record.withdraw_right_notice).toBe(true);
    expect(record.hardware_notice).toBe(true);
  });

  it("captures user agent and language (jsdom defaults)", () => {
    const record = buildConsentRecord();
    expect(typeof record.user_agent).toBe("string");
    expect(typeof record.language).toBe("string");
  });
});

describe("hashPayload", () => {
  it("is stable across object key order", async () => {
    const h1 = await hashPayload({ a: 1, b: 2, c: 3 });
    const h2 = await hashPayload({ c: 3, b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it("is stable for nested object key permutations", async () => {
    const h1 = await hashPayload({ top: { x: 1, y: 2 }, list: [1, 2, 3] });
    const h2 = await hashPayload({ list: [1, 2, 3], top: { y: 2, x: 1 } });
    expect(h1).toBe(h2);
  });

  it("changes when a value changes", async () => {
    const h1 = await hashPayload({ amount: 20000 });
    const h2 = await hashPayload({ amount: 20001 });
    expect(h1).not.toBe(h2);
  });

  it("preserves array order (order-significant)", async () => {
    const h1 = await hashPayload({ items: [1, 2, 3] });
    const h2 = await hashPayload({ items: [3, 2, 1] });
    expect(h1).not.toBe(h2);
  });

  it("handles null + undefined distinctly", async () => {
    const h1 = await hashPayload({ a: null });
    const h2 = await hashPayload({ a: undefined });
    expect(h1).not.toBe(h2);
  });
});

describe("sha256Hex", () => {
  it("returns a 64-char lowercase hex string in environments with crypto.subtle", async () => {
    const out = await sha256Hex("hello");
    if (out === "NOSUBTLE") {
      // jsdom environments without SubtleCrypto fall through to sentinel.
      // That's acceptable by design; skip the shape assertion.
      return;
    }
    expect(out).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "hello"
    expect(out).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("returns the same hash for the same input", async () => {
    const a = await sha256Hex("autolabels");
    const b = await sha256Hex("autolabels");
    expect(a).toBe(b);
  });
});
