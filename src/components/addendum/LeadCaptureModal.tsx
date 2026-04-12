import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useDealerSettings } from "@/contexts/DealerSettingsContext";
import { useSmsDelivery } from "@/hooks/useSmsDelivery";

interface LeadCaptureModalProps {
  open: boolean;
  signingUrl: string;
  vehicleInfo: string;
  onClose: () => void;
}

interface LeadInfo {
  name: string;
  phone: string;
  email: string;
}

const LeadCaptureModal = ({ open, signingUrl, vehicleInfo, onClose }: LeadCaptureModalProps) => {
  const { settings } = useDealerSettings();
  const { sendSigningLink, sending: smsSending, lastResult: smsResult } = useSmsDelivery();
  const [lead, setLead] = useState<LeadInfo>({ name: "", phone: "", email: "" });
  const [captured, setCaptured] = useState(false);

  if (!open) return null;

  const handleCapture = () => {
    let leads: any[] = [];
    try { leads = JSON.parse(localStorage.getItem("leads") || "[]"); } catch { /* corrupted, start fresh */ }
    leads.push({
      id: crypto.randomUUID(),
      store_id: localStorage.getItem("wl_current_store") || "store-default",
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      vehicle_interest: vehicleInfo,
      vehicle_vin: "",
      source: "qr_scan",
      signing_url: signingUrl,
      status: "new",
      notes: "",
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    localStorage.setItem("leads", JSON.stringify(leads));
    setCaptured(true);
  };

  const handleSms = async () => {
    if (!lead.phone.trim()) return;
    handleCapture();
    await sendSigningLink(lead.phone, signingUrl, vehicleInfo);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold font-barlow-condensed text-foreground">Customer Signing</h2>

        <div className="flex justify-center py-3">
          <QRCodeSVG value={signingUrl} size={180} />
        </div>
        <p className="text-[10px] text-muted-foreground break-all">{signingUrl}</p>

        {/* Lead capture */}
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Customer Contact (optional lead capture)</p>
          <input
            value={lead.name}
            onChange={(e) => setLead({ ...lead, name: e.target.value })}
            placeholder="Customer name"
            className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground/50"
          />
          <input
            value={lead.phone}
            onChange={(e) => setLead({ ...lead, phone: e.target.value })}
            placeholder="Phone number"
            type="tel"
            className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground/50"
          />
          <input
            value={lead.email}
            onChange={(e) => setLead({ ...lead, email: e.target.value })}
            placeholder="Email address"
            type="email"
            className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground/50"
          />

          <div className="flex gap-2">
            {!captured ? (
              <button
                onClick={handleCapture}
                disabled={!lead.name.trim() && !lead.phone.trim() && !lead.email.trim()}
                className="flex-1 py-2 bg-teal text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                Save Lead
              </button>
            ) : (
              <p className="flex-1 py-2 text-xs text-teal font-semibold">Lead captured</p>
            )}

            {settings.feature_sms && (
              <button
                onClick={handleSms}
                disabled={smsSending || !lead.phone.trim()}
                className="flex-1 py-2 bg-action text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                {smsSending ? "Sending..." : "Send SMS"}
              </button>
            )}
          </div>

          {smsResult && (
            <p className={`text-[10px] ${smsResult.success ? "text-teal" : "text-red"}`}>
              {smsResult.message}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => navigator.clipboard.writeText(signingUrl).then(() => alert("Link copied!"))}
            className="flex-1 h-10 rounded-lg border-2 border-border text-sm font-semibold text-foreground hover:bg-muted"
          >
            Copy Link
          </button>
          <button onClick={onClose} className="flex-1 h-10 rounded-lg bg-navy text-primary-foreground text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadCaptureModal;
