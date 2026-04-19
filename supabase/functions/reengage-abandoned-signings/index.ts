import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ──────────────────────────────────────────────────────────────
// reengage-abandoned-signings
//
// Scheduled edge function (deploy with a Supabase cron trigger, or
// hit it hourly from any external scheduler). Finds every addendum
// where the shopper opened the link >24h ago, never signed, and
// wasn't re-engaged in the last 72h, then emails them their link.
//
// Every send is dedup'd by writing a signing_link_reengaged audit
// event so a subsequent run won't pick the same token up again until
// the 72h cooldown elapses.
//
// Contract:
//   POST /functions/v1/reengage-abandoned-signings
//   Headers: Authorization: Bearer <SERVICE_ROLE_KEY>  (from cron config)
//   Body: { min_hours_since_open?, min_hours_since_retry?, limit? }
//   Returns: { ok: true, picked: N, sent: N, failed: N }
//
// Auth: service-role only. This is not a shopper-facing endpoint;
// anyone triggering it should already have the service key.
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

interface Candidate {
  addendum_id: string;
  signing_token: string;
  tenant_id: string | null;
  store_id: string | null;
  vehicle_ymm: string | null;
  vehicle_vin: string | null;
  dealer_name: string | null;
  customer_email: string | null;
  opened_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST required" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "supabase not configured" });

  // Service-role gate. The Authorization header must match SERVICE_KEY.
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (auth !== SERVICE_KEY) return json(401, { error: "not authorized" });

  let minOpen = 24;
  let minRetry = 72;
  let limit = 100;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      min_hours_since_open?: number;
      min_hours_since_retry?: number;
      limit?: number;
    };
    if (typeof body.min_hours_since_open === "number") minOpen = body.min_hours_since_open;
    if (typeof body.min_hours_since_retry === "number") minRetry = body.min_hours_since_retry;
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    /* defaults are fine */
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await admin.rpc("find_abandoned_signings", {
    _min_hours_since_open: minOpen,
    _min_hours_since_retry: minRetry,
    _limit: limit,
  });
  if (error) return json(500, { error: error.message });

  const candidates = (data as Candidate[]) || [];
  const origin = req.headers.get("origin") || "https://autolabels.io";

  let sent = 0;
  let failed = 0;

  for (const c of candidates) {
    if (!c.customer_email || !c.signing_token) continue;
    const signingUrl = `${origin}/sign/${c.signing_token}`;
    const ymm = c.vehicle_ymm || "your vehicle";
    const dealer = c.dealer_name || "your dealership";

    const html = `
      <p>Hi,</p>
      <p>Looks like you started signing the addendum for the <strong>${escapeHtml(ymm)}</strong> at ${escapeHtml(dealer)} but didn't finish.</p>
      <p>No rush — your link is still good. Pick up where you left off:</p>
      <p><a href="${signingUrl}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Finish signing</a></p>
      <p style="font-size:12px;color:#555">Or paste this URL into your browser: ${signingUrl}</p>
      <p style="font-size:11px;color:#888">If you've changed your mind, no action is needed \u2014 we won't keep emailing you about this vehicle.</p>
    `;

    const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        to: c.customer_email,
        subject: `Still interested in the ${ymm}?`,
        html,
      }),
    }).catch(() => null);

    const ok = !!emailRes && emailRes.ok;
    if (ok) sent += 1; else failed += 1;

    // Always log the attempt so the 72h cooldown kicks in even if
    // the provider transiently failed. Better to under-send than to
    // keep retrying every cron tick on the same bad address.
    await admin.rpc("record_signing_reengagement", {
      _addendum_id: c.addendum_id,
      _channel: "email",
      _details: {
        to: c.customer_email,
        opened_at: c.opened_at,
        email_ok: ok,
      },
    }).catch(() => { /* best-effort */ });
  }

  return json(200, {
    ok: true,
    picked: candidates.length,
    sent,
    failed,
  });
});

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
