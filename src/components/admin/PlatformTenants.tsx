import { useMemo, useState } from "react";
import { useAdminPlatform, type TenantSummary } from "@/hooks/useAdminPlatform";
import { toast } from "sonner";
import { Building2, Search, Power, PowerOff, Calendar, Users, AppWindow } from "lucide-react";

const formatDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const sourceBadge = (source: TenantSummary["source"]) => {
  const colors: Record<TenantSummary["source"], string> = {
    autocurb: "bg-violet-100 text-violet-700",
    autolabels: "bg-blue-100 text-blue-700",
    manual: "bg-slate-100 text-slate-700",
  };
  return colors[source] || colors.manual;
};

export const PlatformTenants = () => {
  const { tenants, setTenantActive } = useAdminPlatform();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const rows = useMemo(() => {
    const all = tenants.data || [];
    const lc = q.trim().toLowerCase();
    return all
      .filter((t) => (filter === "all" ? true : filter === "active" ? t.is_active : !t.is_active))
      .filter((t) => {
        if (!lc) return true;
        return (
          t.name.toLowerCase().includes(lc) ||
          t.slug.toLowerCase().includes(lc) ||
          (t.domain || "").toLowerCase().includes(lc)
        );
      });
  }, [tenants.data, q, filter]);

  const toggle = async (t: TenantSummary) => {
    const ok = await setTenantActive(t.id, !t.is_active);
    if (ok) toast.success(`${t.name} ${t.is_active ? "suspended" : "reactivated"}`);
    else toast.error("Action failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Tenants</h2>
            <p className="text-[11px] text-muted-foreground">
              {tenants.data?.length ?? 0} total · {rows.length} visible
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, slug, domain…"
              className="h-9 pl-7 pr-3 rounded-md border border-border bg-background text-sm w-64"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="h-9 px-2 rounded-md border border-border bg-background text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Suspended only</option>
          </select>
        </div>
      </div>

      {tenants.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading tenants…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No tenants match. {q ? "Try clearing the search." : "New sign-ups will appear here."}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Dealer</th>
                <th className="text-left px-3 py-2 font-semibold">Source</th>
                <th className="text-left px-3 py-2 font-semibold">Apps</th>
                <th className="text-left px-3 py-2 font-semibold">Members</th>
                <th className="text-left px-3 py-2 font-semibold">Created</th>
                <th className="text-left px-3 py-2 font-semibold">Last activity</th>
                <th className="text-right px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((t) => (
                <tr key={t.id} className={t.is_active ? "" : "opacity-60"}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-foreground">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {t.slug}
                      {t.domain ? ` · ${t.domain}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sourceBadge(t.source)}`}>
                      {t.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <AppWindow className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-semibold">{t.active_apps}</span>
                      {t.app_slugs.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ({t.app_slugs.join(", ")})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-semibold">{t.member_count}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(t.created_at)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatDate(t.last_activity)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => toggle(t)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 h-7 rounded-md ${
                        t.is_active
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {t.is_active ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                      {t.is_active ? "Suspend" : "Reactivate"}
                    </button>
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

export default PlatformTenants;
