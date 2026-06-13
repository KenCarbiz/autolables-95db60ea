import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useVehicleFiles } from "@/hooks/useVehicleFiles";
import { useGetReady } from "@/hooks/useGetReady";
import { useAdvertisedPrices, assessDrift } from "@/hooks/useAdvertisedPrices";
import {
  ScanLine, Wrench, Tag, Send, CheckCircle2,
  RotateCcw, ShieldCheck, AlertTriangle,
  ArrowRight, Camera, FileSignature, Mail, TrendingUp,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// ProcessDashboard — Wave 18 · post-login landing.
//
// Organises the platform around the 8 processes the dealer
// actually runs (Lot Capture → Get-Ready → Ready to Publish →
// Out for Sign → Signed → Compliance Defense). Every tile is a
// live count + one-click jump into the relevant tool. Reads
// from existing TanStack-Query'd hooks (useVehicleFiles,
// useGetReady) and a small set of direct supabase queries for
// what isn't hooked yet.
//
// Tiles deliberately numbered 1–5 along the linear flow so the
// dealer reads the dashboard in order. Compliance tiles sit on
// their own row below; they fire when there's something to do.
// ──────────────────────────────────────────────────────────────

const ProcessDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant, currentStore } = useTenant();
  const storeId = currentStore?.id || "";

  // ── Reuse existing hooks where they exist (already cached via
  //    TanStack Query, already realtime-synced in Wave 14.6).
  const { files: vehicleFiles } = useVehicleFiles(storeId);
  const { records: getReadyRecords } = useGetReady(storeId);
  const { byVin: advertisedByVin } = useAdvertisedPrices(storeId);

  // ── Direct queries for tiles whose data lives in tables not
  //    yet wrapped in a domain hook. Each query is tenant-scoped
  //    via RLS; the storeId narrows further when set.
  const { data: vinQueueCount = 0 } = useQuery({
    queryKey: ["dash", "vin_queue", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("vin_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    staleTime: 30_000,
  });

  const { data: listings = { draft: 0, published: 0, published_rows: [] as { vin: string; price: number | null }[] } } = useQuery({
    queryKey: ["dash", "listings", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const [{ count: d }, { count: p }, pubRows] = await Promise.all([
        (supabase as any)
          .from("vehicle_listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        (supabase as any)
          .from("vehicle_listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        (supabase as any)
          .from("vehicle_listings")
          .select("vin, price")
          .eq("status", "published")
          .not("vin", "is", null)
          .limit(500),
      ]);
      return {
        draft: d || 0,
        published: p || 0,
        published_rows: (pubRows.data || []) as { vin: string; price: number | null }[],
      };
    },
    staleTime: 30_000,
  });

  // ── Wave 20 derived count: published listings whose sticker
  //    drifts from the latest advertised snapshot. Untracked rows
  //    (no advertised price on file) don't count as drift — they
  //    surface separately as "untracked" so the dealer can
  //    decide to capture.
  const priceDrift = useMemo(() => {
    let drift = 0;
    let untracked = 0;
    for (const row of listings.published_rows) {
      const ap = advertisedByVin.get((row.vin || "").toUpperCase());
      const a = assessDrift(row.price || 0, ap);
      if (a.status === "drift") drift++;
      if (a.status === "untracked") untracked++;
    }
    return { drift, untracked };
  }, [listings.published_rows, advertisedByVin]);

  const { data: signings = { open: 0, recent: [] as any[], returnsOpen: 0 } } = useQuery({
    queryKey: ["dash", "signings", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      // Out for sign — addendum_signings whose return path
      // isn't closed yet (rough proxy: signed_at IS NULL).
      const [openRes, recentRes, returnsRes] = await Promise.all([
        (supabase as any)
          .from("addendum_signings")
          .select("id", { count: "exact", head: true })
          .is("signed_at", null),
        (supabase as any)
          .from("addendum_signings")
          .select("id, vin, signer_name, signed_at, content_hash")
          .not("signed_at", "is", null)
          .order("signed_at", { ascending: false })
          .limit(6),
        (supabase as any)
          .from("addendum_signings")
          .select("id", { count: "exact", head: true })
          .eq("return_status", "requested"),
      ]);
      return {
        open: openRes.count || 0,
        recent: (recentRes.data || []) as any[],
        returnsOpen: returnsRes.count || 0,
      };
    },
    staleTime: 30_000,
  });

  // ── Derived counts off the cached hook data.
  const getReadyInFlight = getReadyRecords.filter(
    r => r.status === "pending" || r.status === "in_progress",
  ).length;
  const missingInstallPhotos = useMemo(
    () => getReadyRecords.filter(r =>
      (r.accessoriesToInstall || []).some(
        a => a.installed && (!a.install_photos || a.install_photos.length === 0),
      ),
    ).length,
    [getReadyRecords],
  );
  const missingBenefit = useMemo(
    () => vehicleFiles.filter(f =>
      (f.stickers || []).some(s =>
        (s.products_snapshot || []).some(
          (p: any) =>
            p?.badge_type === "installed" &&
            !((p as any).benefit_justification || "").trim(),
        ),
      ),
    ).length,
    [vehicleFiles],
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = user?.email?.split("@")[0].split(".")[0] || "there";
  const capitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const inFlight = vinQueueCount + getReadyInFlight + listings.draft + signings.open;
  const attentionCount = signings.returnsOpen + missingInstallPhotos + missingBenefit;

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Hero band — greeting + day-level summary. Reads as the
          first sentence of the dealer's day. */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B2041] via-[#1E3A5F] to-[#1E90FF] text-white px-6 py-5 shadow-premium">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
              {currentStore?.name || tenant?.name || "Your dealership"}
            </p>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight mt-0.5">
              {greeting}, {capitalized}.
            </h1>
            <p className="text-sm text-white/80 mt-1.5">
              <span className="font-semibold text-white">{inFlight}</span> {inFlight === 1 ? "vehicle" : "vehicles"} in flight
              {attentionCount > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-amber-300">
                    {attentionCount} need{attentionCount === 1 ? "s" : ""} your attention today
                  </span>
                </>
              )}
              {attentionCount === 0 && inFlight > 0 && (
                <> · <span className="font-semibold text-emerald-300">queue clear</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate("/scan")}
              className="h-11 px-4 rounded-xl bg-gradient-to-r from-[#3BB4FF] to-[#1E90FF] text-white inline-flex items-center gap-1.5 shadow-premium hover:brightness-110 transition-all"
            >
              <ScanLine className="w-4 h-4 stroke-[2.5]" />
              <span className="font-display font-black tracking-tight text-sm">Scan a VIN</span>
            </button>
            <button
              onClick={() => navigate("/inventory?add=1")}
              className="h-11 px-4 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-white inline-flex items-center gap-1.5 hover:bg-white/25 transition-all"
            >
              <span className="font-display font-bold tracking-tight text-sm">Add vehicle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Process flow — five numbered tiles tracing the linear
          workflow. The number is the wayfinding cue: "where is
          this vehicle in my pipeline." */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Today's flow · 1 → 5
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <FlowTile
            num={1}
            icon={ScanLine}
            label="Lot capture"
            count={vinQueueCount}
            unit="queued"
            empty="lot scanned"
            href="/queue"
            tone="sky"
            blurb="VINs picked up by the scanner waiting to be triaged."
          />
          <FlowTile
            num={2}
            icon={Wrench}
            label="Get-ready"
            count={getReadyInFlight}
            unit="in progress"
            empty="all installed"
            href="/admin?tab=getready"
            tone="amber"
            blurb="Vehicles whose pre-sale install isn't sign-off-complete."
          />
          <FlowTile
            num={3}
            icon={Tag}
            label="Ready to publish"
            count={listings.draft}
            unit={listings.draft === 1 ? "draft sticker" : "draft stickers"}
            empty="all live"
            href="/inventory"
            tone="indigo"
            blurb="Sticker + addendum done, waiting for publish."
          />
          <FlowTile
            num={4}
            icon={Send}
            label="Out for sign"
            count={signings.open}
            unit={signings.open === 1 ? "link open" : "links open"}
            empty="no opens"
            href="/admin?tab=funnel"
            tone="violet"
            blurb="Customers have a signing link; we're waiting for ink."
          />
          <FlowTile
            num={5}
            icon={CheckCircle2}
            label="Signed"
            count={signings.recent.length}
            unit="this week"
            empty="—"
            href="/saved"
            tone="emerald"
            blurb="Completed customer sign-offs · audit-defense ready."
          />
        </div>
      </section>

      {/* Compliance row — separate tiles for the items that don't
          fit the linear flow but ARE the dealer's job today.
          Numbered separately (A/B/C) so the dealer reads them as
          "defense, not flow." */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Compliance defense
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DefenseTile
            icon={RotateCcw}
            label="SB 766 returns"
            count={signings.returnsOpen}
            empty="no open returns"
            href="/admin?tab=home"
            cite="§11713.21 · Oct 1, 2026"
            tone={signings.returnsOpen > 0 ? "amber" : "neutral"}
          />
          <DefenseTile
            icon={Camera}
            label="Install photos"
            count={missingInstallPhotos}
            empty="all installed items have photos"
            href="/admin?tab=getready"
            cite="FTC §5 · install proof"
            tone={missingInstallPhotos > 0 ? "rose" : "neutral"}
            countSuffix={missingInstallPhotos === 1 ? "vehicle missing" : "vehicles missing"}
          />
          <DefenseTile
            icon={FileSignature}
            label="Benefit text"
            count={missingBenefit}
            empty="every installed line has benefit copy"
            href="/admin?tab=products"
            cite="FTC §5 · CA SB 766"
            tone={missingBenefit > 0 ? "rose" : "neutral"}
            countSuffix={missingBenefit === 1 ? "vehicle missing" : "vehicles missing"}
          />
        </div>

        {/* Wave 20 — second row dedicated to price-match defense.
            The 97-letter campaign cited this exact hook. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <DefenseTile
            icon={TrendingUp}
            label="Price drift"
            count={priceDrift.drift}
            empty="sticker matches advertised on every published VIN"
            href="/inventory"
            cite="FTC §5 · March 2026 97-letter campaign"
            tone={priceDrift.drift > 0 ? "rose" : "neutral"}
            countSuffix={priceDrift.drift === 1 ? "published VIN" : "published VINs"}
          />
          <DefenseTile
            icon={TrendingUp}
            label="Untracked price"
            count={priceDrift.untracked}
            empty="every published VIN has an advertised price on file"
            href="/inventory"
            cite="2-yr retention · CA SB 766 §11713.21"
            tone={priceDrift.untracked > 0 ? "amber" : "neutral"}
            countSuffix={priceDrift.untracked === 1 ? "VIN no snapshot" : "VINs no snapshot"}
          />
          <DefenseTile
            icon={ShieldCheck}
            label="Audit-Defense ready"
            count={signings.recent.length}
            empty="—"
            href="/compliance"
            cite="self-contained · SHA-256 chain root"
            tone="neutral"
            countSuffix="VIN packets last 7d"
          />
        </div>
      </section>

      {/* Recent signed — top 6 with Defend exits matching the
          /saved row actions (Wave 15.5). */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Recent signings · last 7 days
          </p>
          <Link to="/saved" className="text-[11px] font-semibold text-[#1E90FF] hover:underline">
            View all →
          </Link>
        </div>
        {signings.recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-foreground">No customer signings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              When a customer signs an addendum, the signed record + Defend button land here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">Signed</th>
                  <th className="text-left px-4 py-2 font-bold">VIN</th>
                  <th className="text-left px-4 py-2 font-bold">Signer</th>
                  <th className="text-left px-4 py-2 font-bold">Hash</th>
                  <th className="text-right px-4 py-2 font-bold">Defense</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {signings.recent.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {r.signed_at ? new Date(r.signed_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{(r.vin || "").slice(-8)}</td>
                    <td className="px-4 py-2.5 text-sm">{r.signer_name || "Buyer"}</td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                      {(r.content_hash || "").slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => navigate(`/compliance?vin=${encodeURIComponent(r.vin || "")}`)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 h-7 rounded-md text-emerald-700 hover:bg-emerald-50"
                      >
                        <ShieldCheck className="w-3 h-3" /> Defend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quietly-deferred surfaces — the dashboard names them so
          the dealer sees what's coming next, with explicit
          "Wave 19 / 20" framing for transparency. */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Roadmap surfaces · coming soon
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoadmapTile icon={ScanLine}    label="Lot capture queue polish" wave="Wave 21" detail="Status tagging (needs sticker / needs prep / needs photos), batch actions, V2 chrome." />
          <RoadmapTile icon={AlertTriangle} label="Inventory feed health" wave="Wave 22" detail="Autocurb push/pull status + manual sync button + last-synced timestamp." />
        </div>
      </section>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// FlowTile — numbered linear-process card.
// ──────────────────────────────────────────────────────────────

interface FlowTileProps {
  num: number;
  icon: typeof ScanLine;
  label: string;
  count: number;
  unit: string;
  empty: string;
  href: string;
  tone: "sky" | "amber" | "indigo" | "violet" | "emerald";
  blurb: string;
}

const FlowTile = ({ num, icon: Icon, label, count, unit, empty, href, tone, blurb }: FlowTileProps) => {
  const isZero = count === 0;
  const accent =
    tone === "sky"     ? "from-sky-500 to-[#1E90FF]"   :
    tone === "amber"   ? "from-amber-400 to-amber-600" :
    tone === "indigo"  ? "from-indigo-500 to-indigo-700" :
    tone === "violet"  ? "from-violet-500 to-violet-700" :
                         "from-emerald-500 to-emerald-700";
  return (
    <Link
      to={href}
      className="group rounded-xl border border-border bg-card p-4 flex flex-col hover:shadow-md hover:border-foreground/20 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent} text-white inline-flex items-center justify-center font-display font-black text-sm shadow-premium`}>
          {num}
        </span>
        <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-2xl font-semibold tabular-nums leading-none ${isZero ? "text-muted-foreground" : "text-foreground"}`}>
        {count}
      </p>
      <p className="text-[10px] text-muted-foreground/80 mt-1">
        {isZero ? empty : unit}
      </p>
      <p className="text-[10px] text-muted-foreground mt-2 leading-snug line-clamp-2 group-hover:text-foreground/70 transition-colors">
        {blurb}
      </p>
      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E90FF] opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
};

// ──────────────────────────────────────────────────────────────
// DefenseTile — compliance-defense card. Tone reacts to count.
// ──────────────────────────────────────────────────────────────

interface DefenseTileProps {
  icon: typeof ShieldCheck;
  label: string;
  count: number;
  empty: string;
  href: string;
  cite: string;
  tone: "rose" | "amber" | "neutral";
  countSuffix?: string;
}

const DefenseTile = ({ icon: Icon, label, count, empty, href, cite, tone, countSuffix }: DefenseTileProps) => {
  const tint =
    tone === "rose"  ? "border-rose-200 bg-rose-50/60"  :
    tone === "amber" ? "border-amber-200 bg-amber-50/60" :
                       "border-emerald-200 bg-emerald-50/40";
  const iconColor =
    tone === "rose"  ? "text-rose-700"  :
    tone === "amber" ? "text-amber-700" :
                       "text-emerald-700";
  return (
    <Link to={href} className={`group rounded-xl border ${tint} p-4 flex items-start gap-3 hover:shadow-md transition-all`}>
      <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
        <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-[0.12em] font-bold">
          {cite}
        </p>
        {count > 0 ? (
          <p className={`text-xs mt-1.5 font-semibold ${iconColor}`}>
            {count} {countSuffix || "open"}
          </p>
        ) : (
          <p className="text-xs mt-1.5 text-emerald-800/80 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {empty}
          </p>
        )}
      </div>
    </Link>
  );
};

interface RoadmapTileProps {
  icon: typeof Mail;
  label: string;
  wave: string;
  detail: string;
}

const RoadmapTile = ({ icon: Icon, label, wave, detail }: RoadmapTileProps) => (
  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 opacity-80">
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground bg-card border border-border px-1.5 py-0.5 rounded">
        {wave}
      </span>
    </div>
    <p className="text-sm font-semibold text-foreground">{label}</p>
    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{detail}</p>
  </div>
);

export default ProcessDashboard;
