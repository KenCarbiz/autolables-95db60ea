import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ──────────────────────────────────────────────────────────────
// billing-replay
//
// Service-role gated test harness for the Autocurb \u2194 AutoLabels
// billing handshake. Takes a synthetic Autocurb-style item array
// and a tenant_id, calls autocurb_sync_entitlements(p_tenant_id,
// p_items), and returns the resulting public.app_entitlements
// rows for that tenant.
//
// Purpose: Autocurb's team can validate the full contract end-to-
// end before they wire real Stripe Products/Prices on their side.
// Hit this with a fake checkout.session.completed payload and
// confirm the entitlements flip exactly as the live webhook will.
//
// Contract:
//   POST /functions/v1/billing-replay
//   Headers: Authorization: Bearer <SERVICE_ROLE_KEY>
//   Body: {
//     tenant_id: UUID,                      // our tenants.id
//     items: [
//       {
//         app_slug: "autolabels",            // from Stripe price.metadata
//         plan_tier: "essential",            // from Stripe price.metadata
//         status: "active",                  // from subscription.status
//         stripe_subscription_id: "sub_xxx",
//         stripe_subscription_item_id: "si_xxx",
//         expires_at: "2026-05-19T00:00:00Z",
//         includes_apps: ["autolabels"]      // bundle fan-out
//       }
//     ],
//     dry_run?: false                       // if true, only validate
//                                            // and return the would-be
//                                            // payload, don't sync.
//   }
//   Returns: {
//     ok: true,
//     synced: <count>,
//     entitlements: [<row>, ...],            // current state for tenant
//     events_seen: [<recent billing_events>],// last 5
//     audit: [<recent entitlements_synced>], // last 5
//   }
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

interface ReplayItem {
  app_slug: string;
  plan_tier?: string;
  status?: string;
  stripe_subscription_id?: string;
  stripe_subscription_item_id?: string;
  expires_at?: string;
  includes_apps?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST required" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "supabase not configured" });

  // Service-role gate. The Authorization header must equal SERVICE_KEY.
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (auth !== SERVICE_KEY) return json(401, { error: "service-role required" });

  let tenantId = "";
  let items: ReplayItem[] = [];
  let dryRun = false;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tenant_id?: string;
      items?: ReplayItem[];
      dry_run?: boolean;
    };
    tenantId = (body.tenant_id || "").trim();
    items = Array.isArray(body.items) ? body.items : [];
    dryRun = !!body.dry_run;
  } catch {
    return json(400, { error: "invalid JSON body" });
  }

  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
    return json(400, { error: "tenant_id must be a UUID" });
  }
  if (items.length === 0) {
    return json(400, { error: "items[] required" });
  }
  for (const item of items) {
    if (!item.app_slug) {
      return json(400, { error: "every item needs app_slug" });
    }
    if (!item.stripe_subscription_id) {
      return json(400, { error: "every item needs stripe_subscription_id" });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (dryRun) {
    return json(200, {
      ok: true,
      dry_run: true,
      would_call: "autocurb_sync_entitlements",
      tenant_id: tenantId,
      items,
    });
  }

  const { error: syncErr } = await admin.rpc("autocurb_sync_entitlements", {
    p_tenant_id: tenantId,
    p_items: items,
  });
  if (syncErr) {
    return json(500, {
      ok: false,
      error: syncErr.message,
      hint: "check item shape matches the RPC contract in 20260419020000_billing_contract.sql",
    });
  }

  // Snapshot current state so the caller sees the after.
  const [entitlementsRes, eventsRes, auditRes] = await Promise.all([
    admin
      .from("app_entitlements")
      .select("app_slug, plan_tier, status, stripe_subscription_id, expires_at, renewed_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("app_slug"),
    admin
      .from("billing_events")
      .select("event_type, processed_at, created_at, stripe_event_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("audit_log")
      .select("action, details, created_at")
      .eq("entity_id", tenantId)
      .eq("action", "entitlements_synced")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return json(200, {
    ok: true,
    synced: items.length,
    entitlements: entitlementsRes.data || [],
    events_seen: eventsRes.data || [],
    audit: auditRes.data || [],
  });
});
