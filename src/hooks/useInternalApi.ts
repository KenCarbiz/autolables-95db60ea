// ──────────────────────────────────────────────────────────────
// Internal API Hook
//
// This is the integration layer for other AutoLabels products
// to push/pull data to/from the addendum platform.
//
// TWO MODES:
// 1. EMBEDDED (postMessage) — when running as iframe inside
//    HarteCash or another AutoLabels product. Uses the existing
//    useTenantIntegration protocol.
//
// 2. REST API (Supabase Edge Functions) — when running as
//    standalone service. Other products call our API endpoints.
//
// API ENDPOINTS TO BUILD (Supabase Edge Functions):
//
// ── VEHICLE DATA (push/pull) ──
// POST /api/vehicles          — create/update vehicle file
// GET  /api/vehicles/:vin     — get vehicle file by VIN
// GET  /api/vehicles          — list all vehicle files
//
// ── STICKERS (push/pull) ──
// POST /api/stickers          — register a printed sticker
// GET  /api/stickers/:code    — lookup by tracking code
// GET  /api/vehicles/:vin/stickers — all stickers for a VIN
//
// ── SIGNING (push) ──
// POST /api/signing/:token    — record a signing event
// GET  /api/signing/:token    — get signing status
//
// ── INVENTORY (push) ──
// POST /api/inventory/import  — bulk import vehicles (CSV/JSON)
// POST /api/inventory/scan    — add from mobile scanner
//
// ── LEADS (pull) ──
// GET  /api/leads             — export captured leads
//
// ── DESCRIPTIONS (push/pull) ──
// POST /api/descriptions      — generate AI description
//
// ── GET-READY (push/pull) ──
// POST /api/getready          — create get-ready record
// GET  /api/getready/:vin     — get get-ready status
// PUT  /api/getready/:id/complete — mark item complete
//
// ── AUDIT (pull) ──
// GET  /api/audit             — export audit log
//
// ── WEBHOOK (push from us) ──
// POST {dealer_webhook_url}   — notify dealer CRM when:
//   - Customer signs an addendum
//   - Lead captured from QR scan
//   - Vehicle file created
//   - Get-ready completed
//   - Sticker printed
// ──────────────────────────────────────────────────────────────

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export interface ApiEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  storeId: string;
}

const WEBHOOK_CONFIG_KEY = "webhook_config";
const WEBHOOK_QUEUE_KEY = "webhook_queue";

export const useInternalApi = () => {

  // ── Webhook configuration ──
  const getWebhookConfig = (): WebhookConfig | null => {
    try { return JSON.parse(localStorage.getItem(WEBHOOK_CONFIG_KEY) || "null"); } catch { return null; }
  };

  const saveWebhookConfig = (config: WebhookConfig) => {
    localStorage.setItem(WEBHOOK_CONFIG_KEY, JSON.stringify(config));
  };

  // ── Send webhook event ──
  const sendWebhook = async (event: string, data: Record<string, unknown>, storeId: string) => {
    const config = getWebhookConfig();
    if (!config?.active || !config.url) return;
    if (config.events.length > 0 && !config.events.includes(event)) return;

    const payload: ApiEvent = {
      event,
      data,
      timestamp: new Date().toISOString(),
      storeId,
    };

    // Queue for retry if the direct call fails
    try {
      // In production: call via Edge Function to add HMAC signature
      // await supabase.functions.invoke("webhook-sender", { body: payload });

      // For now: queue locally
      const queue = JSON.parse(localStorage.getItem(WEBHOOK_QUEUE_KEY) || "[]");
      queue.push(payload);
      localStorage.setItem(WEBHOOK_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Silently queue for retry
    }
  };

  // ── Convenience methods for common events ──
  const notifyAddendumSigned = (data: { vin: string; customerName: string; signingToken: string; totalPrice: number }, storeId: string) =>
    sendWebhook("addendum.signed", data, storeId);

  const notifyLeadCaptured = (data: { name: string; phone: string; email: string; vehicle: string; source: string }, storeId: string) =>
    sendWebhook("lead.captured", data, storeId);

  const notifyVehicleCreated = (data: { vin: string; ymm: string; stockNumber: string; condition: string }, storeId: string) =>
    sendWebhook("vehicle.created", data, storeId);

  const notifyGetReadyComplete = (data: { vin: string; ymm: string; stockNumber: string }, storeId: string) =>
    sendWebhook("getready.completed", data, storeId);

  const notifyStickerPrinted = (data: { vin: string; trackingCode: string; stickerType: string }, storeId: string) =>
    sendWebhook("sticker.printed", data, storeId);

  // ── Data export for external systems ──
  const exportVehicleFiles = (storeId: string): string => {
    try {
      const files = JSON.parse(localStorage.getItem("vehicle_files") || "[]")
        .filter((f: Record<string, unknown>) => f.store_id === storeId);
      return JSON.stringify(files, null, 2);
    } catch { return "[]"; }
  };

  const exportAuditLog = (storeId: string): string => {
    try {
      const entries = JSON.parse(localStorage.getItem("audit_log") || "[]")
        .filter((e: Record<string, unknown>) => e.store_id === storeId);
      return JSON.stringify(entries, null, 2);
    } catch { return "[]"; }
  };

  const exportLeads = (storeId: string): string => {
    try {
      const leads = JSON.parse(localStorage.getItem("leads") || "[]")
        .filter((l: Record<string, unknown>) => l.store_id === storeId);
      return JSON.stringify(leads, null, 2);
    } catch { return "[]"; }
  };

  return {
    getWebhookConfig,
    saveWebhookConfig,
    sendWebhook,
    notifyAddendumSigned,
    notifyLeadCaptured,
    notifyVehicleCreated,
    notifyGetReadyComplete,
    notifyStickerPrinted,
    exportVehicleFiles,
    exportAuditLog,
    exportLeads,
  };
};
