import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

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
  const [lead, setLead] = useState<LeadInfo>({ name: "", phone: "", email: "" });
  const [captured, setCaptured] = useState(false);

  if (!open) return null;

  const handleCapture = () => {
    // Store lead locally (can be synced to CRM later)
    const leads = JSON.parse(localStorage.getItem("captured_leads") || "[]");
    leads.push({
      ...lead,
      vehicle: vehicleInfo,
      signingUrl,
      capturedAt: new Date().toISOString(),
    });
    localStorage.setItem("captured_leads", JSON.stringify(leads));
    setCaptured(true);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold font-barlow-condensed text-foreground">Customer Signing</h2>

        {/* QR Code */}
        <div className="flex justify-center py-3">
          <QRCodeSVG value={signingUrl} size={180} />
        </div>
        <p className="text-[10px] text-muted-foreground break-all">{signingUrl}</p>

        {/* Lead capture section */}
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
          {!captured ? (
            <button
              onClick={handleCapture}
              disabled={!lead.name.trim() && !lead.phone.trim() && !lead.email.trim()}
              className="w-full py-2 bg-teal text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              Save Lead Info
            </button>
          ) : (
            <p className="text-xs text-teal font-semibold">Lead captured</p>
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
