import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ──────────────────────────────────────────────────────────────
// stripe-webhook — SHADOW LEDGER (Wave 5.1+)
//
// As of Wave 5.1 the central billing hub lives on Autocurb.io. Its
// stripe-webhook fn walks every subscription's items and calls
// `autocurb_sync_entitlements(p_tenant_id, p_items)` against OUR
// Supabase project. That RPC is the single authoritative writer of
// public.app_entitlements across the Autocurb family.
//
// This function used to mutate app_entitlements directly from
// metadata.app_slug. That codepath has been removed to prevent two
// concurrent writers racing on the same rows. We now:
//   1. Verify the Stripe signature (kept so we don't ingest forged
//      events into our ledger).
//   2. Append every event to billing_events (idempotent on
//      stripe_event_id) — useful as a local audit trail and for
//      debugging even though Autocurb also ledgers on its side.
//   3. Mark the event processed_at and return 200.
//
// There is no entitlement mutation here. If you're looking for the
// writer, see Autocurb's stripe-webhook + our
// `supabase/migrations/20260419020000_billing_contract.sql`.
// ──────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hmacSha256Hex = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
};

const verifyStripeSignature = async (
  header: string | null,
  body: string,
  secret: string,
  toleranceSec = 300
) => {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string[]>>((acc, kv) => {
    const [k, v] = kv.split("=");
    if (!k || !v) return acc;
    (acc[k] = acc[k] || []).push(v);
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const sigs = parts.v1 || [];
  if (!timestamp || sigs.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  return sigs.some((s) => timingSafeEqual(s, expected));
};

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!supabaseUrl || !serviceKey) return json(500, { error: "supabase not configured" });
    if (!webhookSecret) return json(500, { error: "STRIPE_WEBHOOK_SECRET not configured" });

    const raw = await req.text();
    const sigHeader = req.headers.get("stripe-signature");
    const ok = await verifyStripeSignature(sigHeader, raw, webhookSecret);
    if (!ok) return json(401, { error: "invalid signature" });

    let event: StripeEvent;
    try { event = JSON.parse(raw); }
    catch { return json(400, { error: "invalid JSON" }); }

    const admin = createClient(supabaseUrl, serviceKey);

    const obj = event.data.object;
    const metadata: Record<string, string> =
      obj.metadata || obj.subscription_details?.metadata || {};
    const tenantId = metadata.tenant_id || null;

    // Append to ledger (idempotent via unique stripe_event_id).
    // Entitlement state is NOT mutated here — see header comment.
    await admin.from("billing_events").upsert(
      {
        tenant_id: tenantId,
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event as unknown as Record<string, unknown>,
      },
      { onConflict: "stripe_event_id", ignoreDuplicates: true }
    );

    await admin
      .from("billing_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return json(200, { received: true, applied: false, note: "shadow ledger only — Autocurb owns entitlement mutation" });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : "unknown error" });
  }
});
