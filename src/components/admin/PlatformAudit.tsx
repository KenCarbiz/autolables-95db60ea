import { useEffect, useMemo, useState } from "react";
import { useAdminPlatform, type AuditRow } from "@/hooks/useAdminPlatform";
import { ScrollText, Search } from "lucide-react";

const ACTION_PRESETS = [
  "",
  "addendum_signed",
  "addendum_viewed",
  "listing_viewed",
  "listing_published",
  "deal_signed",
  "autocurb_pull_completed",
  "autocurb_notified",
  "autocurb_sync",
  "dms_sync",
  "entitlement_overridden",
  "tenant_suspended",
  "tenant_reactivated",
  "member_role_changed",
  "document_archived",
];

const formatDateTime = (s: string) => {
  const d = new Date(s);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export const PlatformAudit = () => {
  const { tenants, searchAudit } = useAdminPlatform();
  const [q, setQ] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [sinceDays, setSinceDays] = useState<number>(7);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const tenantsById = useMemo(() => {
    const m = new Map<string, string>();
    (tenants.data || []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tenants.data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await searchAudit({
        tenantId: tenantFilter || undefined,
        action: actionFilter || undefined,
        sinceDays,
        limit: 200,
      });
      if (!cancelled) {
        setRows(res);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantFilter, actionFilter, sinceDays, searchAudit]);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter((r) => {
      const tn = (tenantsById.get(r.store_id || "") || "").toLowerCase();
      return (
        r.action.toLowerCase().includes(lc) ||
        r.entity_type.toLowerCase().includes(lc) ||
        r.entity_id.toLowerCase().includes(lc) ||
        (r.user_email || "").toLowerCase().includes(lc) ||
        tn.includes(lc)
      );
    });
  }, [rows, q, tenantsById]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ScrollText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Cross-tenant audit log</h2>
            <p className="text-[11px] text-muted-foreground">
              {filtered.length} events · last {sinceDays} days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-background text-sm max-w-[200px]">
            <option value="">All tenants</option>
            {(tenants.data || []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-background text-sm">
            {ACTION_PRESETS.map((a) => (
              <option key={a} value={a}>{a || "All actions"}</option>
            ))}
          </select>
          <select value={sinceDays} onChange={(e) => setSinceDays(parseInt(e.target.value, 10))} className="h-9 px-2 rounded-md border border-border bg-background text-sm">
            <option value={1}>24 h</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actions, tenants, emails…"
              className="h-9 pl-7 pr-3 rounded-md border border-border bg-background text-sm w-64"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading events…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No events match.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">When</th>
                <th className="text-left px-3 py-2 font-semibold">Action</th>
                <th className="text-left px-3 py-2 font-semibold">Tenant</th>
                <th className="text-left px-3 py-2 font-semibold">Entity</th>
                <th className="text-left px-3 py-2 font-semibold">Actor</th>
                <th className="text-left px-3 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2">
                    {tenantsById.get(r.store_id || "") ||
                      <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    <span className="uppercase tracking-wider text-[10px]">{r.entity_type}</span>
                    <span className="ml-1 font-mono">{r.entity_id.slice(0, 10)}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                    {r.user_email || (r.user_id ? r.user_id.slice(0, 8) : "anon")}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground truncate max-w-xs">
                    {JSON.stringify(r.details).slice(0, 120)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlatformAudit;
