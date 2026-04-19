import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";

// ──────────────────────────────────────────────────────────────
// ReturnsQueue — dealer-facing view of SB 766 return activity.
// Reads from addendum_signings (tenant-scoped via RLS) and shows
// any row with return_status set. Acts on requested rows via
// resolve_return(signing_id, outcome, restocking, mileage, reason).
// ──────────────────────────────────────────────────────────────

interface ReturnRow {
  id: string;
  vin: string | null;
  signer_name: string | null;
  signed_at: string;
  return_status: string;
  return_window_closes_at: string | null;
  return_requested_at: string | null;
  return_reason: string | null;
  return_restocking_fee: number | null;
  return_delivery_mileage: number | null;
}

const statusTone: Record<string, string> = {
  eligible:  "border-slate-200 bg-slate-50 text-slate-700",
  requested: "border-amber-300 bg-amber-50 text-amber-900",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  denied:    "border-red-300 bg-red-50 text-red-900",
  expired:   "border-slate-200 bg-white text-slate-500",
  waived:    "border-slate-200 bg-white text-slate-500",
};

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

const ReturnsQueue = () => {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("addendum_signings")
      .select("id, vin, signer_name, signed_at, return_status, return_window_closes_at, return_requested_at, return_reason, return_restocking_fee, return_delivery_mileage")
      .not("return_status", "is", null)
      .order("return_requested_at", { ascending: false, nullsFirst: false })
      .order("signed_at", { ascending: false });
    setRows(((data as ReturnRow[]) || []));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, outcome: "completed" | "denied") => {
    const restockingStr = outcome === "completed"
      ? window.prompt("Restocking fee charged ($200 min, $600 max). Leave blank to skip.")
      : null;
    const mileageStr = outcome === "completed"
      ? window.prompt("Delivery mileage at return (optional).")
      : null;
    const reason = outcome === "denied"
      ? window.prompt("Reason for denial (required).")
      : window.prompt("Note for the record (optional).");
    if (outcome === "denied" && !reason?.trim()) {
      toast.error("A reason is required when denying a return.");
      return;
    }
    const { error } = await (supabase as any).rpc("resolve_return", {
      _signing_id: id,
      _outcome: outcome,
      _restocking: restockingStr ? Number(restockingStr) : null,
      _mileage: mileageStr ? Number(mileageStr) : null,
      _reason: reason?.trim() || null,
    });
    if (error) {
      toast.error("Couldn't resolve return.");
      return;
    }
    toast.success(outcome === "completed" ? "Return marked completed." : "Return denied.");
    await load();
  };

  const requested = rows.filter(r => r.return_status === "requested");
  const other = rows.filter(r => r.return_status !== "requested");

  if (!loading && rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-4 h-4 text-slate-700" />
        <h3 className="text-base font-semibold text-foreground">SB 766 returns</h3>
        {requested.length > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
            {requested.length} open
          </span>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {requested.length > 0 && (
        <div className="space-y-2 mb-3">
          {requested.map(r => (
            <div key={r.id} className={`rounded-xl border p-3 ${statusTone.requested}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{r.signer_name || "Buyer"} — VIN {(r.vin || "").slice(-8)}</p>
                  <p className="text-[11px] mt-1">
                    Requested {fmtDate(r.return_requested_at)} · Window closes {fmtDate(r.return_window_closes_at)}
                  </p>
                  {r.return_reason && (
                    <p className="text-[11px] mt-1 italic">"{r.return_reason}"</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(r.id, "completed")}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-slate-950 text-white text-[11px] font-semibold hover:bg-slate-900"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </button>
                  <button
                    onClick={() => resolve(r.id, "denied")}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-300 text-[11px] font-semibold hover:bg-slate-100"
                  >
                    <XCircle className="w-3 h-3" /> Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">History</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-[12px]">
              <tbody>
                {other.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 first:border-t-0">
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border ${statusTone[r.return_status] || statusTone.eligible}`}>
                        {r.return_status === "expired" && <Clock className="w-3 h-3" />}
                        {r.return_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{(r.vin || "").slice(-8)}</td>
                    <td className="px-3 py-2">{r.signer_name || "Buyer"}</td>
                    <td className="px-3 py-2 text-slate-500 text-right">{fmtDate(r.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default ReturnsQueue;
