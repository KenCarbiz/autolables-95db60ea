import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ──────────────────────────────────────────────────────────────
// request-signing-link
//
// Anti-enumeration wrapper around the public.request_signing_link_resend
// RPC. The RPC returns a dispatch envelope { email, signing_url, ymm,
// dealer_name } on match; if that envelope reaches the browser a
// scraper can enumerate VIN + contact combinations and harvest
// signing tokens directly.
//
// This edge function calls the RPC server-side, fires send-email
// when a dispatch is returned, and always replies with exactly
// { ok: true } to the client — hit or miss.
//
// Contract:
//   POST /functions/v1/request-signing-link
//   Body: { vin: string, contact: string }
//   Returns: { ok: true }
//
// No JWT required — the token-lookup flow is shopper-facing. Abuse
// is mitigated by the audit_log entry the RPC writes on every
// attempt and by normal edge-function rate limits.
// ──────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface DispatchEnvelope {
  email?: string;
  signing_url?: string;
  ymm?: string | null;
  dealer_name?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: true });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    // Always same shape out even when misconfigured, so a scraper
    // can't distinguish a config issue from a miss.
    return json(200, { ok: true });
  }

  let vin = "";
  let contact = "";
  try {
    const body = (await req.json().catch(() => ({}))) as {
      vin?: string;
      contact?: string;
    };
    vin = (body.vin || "").trim();
    contact = (body.contact || "").trim();
  } catch {
    return json(200, { ok: true });
  }

  if (vin.length !== 17 || contact.length === 0) {
    return json(200, { ok: true });
  }

  const origin = req.headers.get("origin") || "https://autolabels.io";

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data } = await admin.rpc("request_signing_link_resend", {
      _vin: vin,
      _contact: contact,
      _origin: origin,
    });

    const dispatch: DispatchEnvelope | undefined = (data as { dispatch?: DispatchEnvelope })?.dispatch;

    if (dispatch?.email && dispatch?.signing_url) {
      const dealerName = dispatch.dealer_name || "your dealership";
      const ymm = dispatch.ymm || "your vehicle";
      const html = `
        <p>Here's your signing link for the <strong>${escapeHtml(ymm)}</strong> at ${escapeHtml(dealerName)}:</p>
        <p><a href="${dispatch.signing_url}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open your signing page</a></p>
        <p style="font-size:12px;color:#555">Or paste this URL into your browser: ${dispatch.signing_url}</p>
        <p style="font-size:11px;color:#888">This link is yours. Please do not share it.</p>
      `;

      // Invoke send-email via functions/v1 — fire and forget from
      // the client's perspective; we still await so errors land in
      // the edge-function log.
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          to: dispatch.email,
          subject: `Your signing link${ymm ? " — " + ymm : ""}`,
          html,
        }),
      }).catch(() => { /* best-effort */ });
    }
  } catch (_err) {
    // Swallow so the client can't distinguish backend failure from
    // a miss. The attempt is already logged by the RPC.
  }

  return json(200, { ok: true });
});

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
