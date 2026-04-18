import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import {
  ArrowLeft, Car, FileText, Wrench, Tag, Signature, Globe,
  CheckCircle2, Clock, Gauge, DollarSign, MapPin, Copy, ExternalLink,
  FileUp, Upload, Printer, Sparkles,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// VehicleFile — /vehicle-file/:id
//
// The single canonical per-vehicle workspace. Every downstream tool
// is scoped here: documents (factory sticker, Carfax, brochures),
// addendum build, prep / foreman sign-off, label generation,
// customer signing. The vehicle_listings row is the record; every
// child artifact refers to it by id.
// ──────────────────────────────────────────────────────────────

type TabId = "overview" | "documents" | "addendum" | "prep" | "labels" | "sign";

interface VehicleRow {
  id: string;
  tenant_id: string | null;
  vin: string;
  slug: string;
  ymm: string | null;
  trim: string | null;
  mileage: number | null;
  condition: "new" | "used" | "cpo" | null;
  price: number | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  view_count: number;
  sticker_snapshot: Record<string, unknown>;
  dealer_snapshot: Record<string, unknown>;
  documents: Array<{ name: string; url: string; type: string }>;
  videos: Array<{ id: string; url: string; caption?: string }>;
  prep_status: { all_accessories_installed?: boolean; foreman_signed_at?: string } | null;
  recall_check: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const VehicleFile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("vehicle_listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setVehicle(data as VehicleRow);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const publicUrl = useMemo(
    () => vehicle ? `${window.location.origin}/v/${vehicle.slug}` : "",
    [vehicle]
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !vehicle) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <Car className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Vehicle not found</h2>
        <p className="text-sm text-muted-foreground">
          This file may have been archived, or your tenant doesn't have access.
        </p>
        <button
          onClick={() => navigate("/inventory")}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to inventory
        </button>
      </div>
    );
  }

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Shopper link copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof Car }[] = [
    { id: "overview",  label: "Overview",  icon: Car },
    { id: "documents", label: "Documents", icon: FileUp },
    { id: "addendum",  label: "Addendum",  icon: FileText },
    { id: "prep",      label: "Prep & Install", icon: Wrench },
    { id: "labels",    label: "Labels",    icon: Tag },
    { id: "sign",      label: "Customer Sign-off", icon: Signature },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Hero / header */}
      <div>
        <button
          onClick={() => navigate("/inventory")}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          Inventory
        </button>
        <div className="mt-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                  vehicle.condition === "new" ? "bg-blue-100 text-blue-700" :
                  vehicle.condition === "cpo" ? "bg-violet-100 text-violet-700" :
                  "bg-slate-100 text-slate-700"
                }`}>{vehicle.condition || "unknown"}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                  vehicle.status === "published" ? "bg-emerald-100 text-emerald-700" :
                  vehicle.status === "archived" ? "bg-slate-100 text-slate-500" :
                  "bg-amber-100 text-amber-700"
                }`}>{vehicle.status}</span>
                {vehicle.prep_status?.foreman_signed_at ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Prep signed
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-black tracking-tight font-display text-foreground">
                {vehicle.ymm || "(needs VIN decode)"}
                {vehicle.trim ? <span className="text-muted-foreground font-normal ml-2">{vehicle.trim}</span> : null}
              </h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
                <span className="font-mono">{vehicle.vin}</span>
                {typeof vehicle.mileage === "number" && (
                  <span className="inline-flex items-center gap-1"><Gauge className="w-3 h-3" /> {vehicle.mileage.toLocaleString()} mi</span>
                )}
                {typeof vehicle.price === "number" && (
                  <span className="inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${vehicle.price.toLocaleString()}</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Created {new Date(vehicle.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {vehicle.status === "published" ? (
                <>
                  <button
                    onClick={copyLink}
                    className="h-9 px-3 rounded-md border border-border text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy link
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View shopper page
                  </a>
                </>
              ) : (
                <button
                  onClick={() => setTab("labels")}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <Globe className="w-4 h-4" />
                  Publish shopper page
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-10 px-3 text-xs font-semibold inline-flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="pt-2">
        {tab === "overview"  && <OverviewPanel vehicle={vehicle} onReload={load} />}
        {tab === "documents" && <DocumentsPanel vehicle={vehicle} onReload={load} />}
        {tab === "addendum"  && <JumpTo path="/addendum" reason="Build this vehicle's addendum" />}
        {tab === "prep"      && <JumpTo path="/prep" reason={`Sign off on prep & install for VIN ${vehicle.vin}`} />}
        {tab === "labels"    && <LabelsPanel vehicle={vehicle} />}
        {tab === "sign"      && <JumpTo path="/saved" reason="Generate or review customer signing links" />}
      </div>
    </div>
  );
};

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
  user_email: string | null;
  details: Record<string, unknown> | null;
  entity_type: string;
}

const PRETTY_ACTION: Record<string, string> = {
  listing_viewed: "Shopper viewed the page",
  listing_published: "Published to shopper portal",
  addendum_signed: "Customer signed the addendum",
  addendum_viewed: "Addendum opened by customer",
  addendum_consent_given: "Customer accepted E-SIGN consent",
  deal_signed: "Deal jacket signed",
  document_archived: "Signed document archived",
  vdp_scraped: "VDP scraped from dealer site",
  prep_sign_off_signed: "Foreman signed off on prep",
  recall_checked: "NHTSA recall lookup ran",
};

const prettyAction = (a: string) =>
  PRETTY_ACTION[a] || a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const OverviewPanel = ({ vehicle }: { vehicle: VehicleRow; onReload: () => void }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEvents(true);
      try {
        // Audit rows for this vehicle can match by entity_id (vehicle_listing)
        // OR by details->>vin (addendum / deal / archive paths) OR by the
        // slug (listing_viewed events). Pull them all in one OR query.
        const { data } = await (supabase as any)
          .from("audit_log")
          .select("id,action,created_at,user_email,details,entity_type")
          .or(
            `entity_id.eq.${vehicle.id},details->>vin.eq.${vehicle.vin},details->>slug.eq.${vehicle.slug}`
          )
          .order("created_at", { ascending: false })
          .limit(80);
        if (!cancelled) setEvents((data || []) as AuditEvent[]);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vehicle.id, vehicle.vin, vehicle.slug]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-3">
        <Card title="Activity timeline">
          {loadingEvents ? (
            <p className="text-xs text-muted-foreground">Loading events…</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No recorded activity yet. Events show up here as stickers are generated,
              prep is signed off, customers view the shopper page, and the addendum is
              signed. Every row is served from the append-only audit_log and is
              defensible in a compliance review.
            </p>
          ) : (
            <ol className="relative border-l-2 border-border pl-4 space-y-3">
              {events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gradient-to-br from-[#3BB4FF] to-[#1E90FF] ring-4 ring-background" />
                  <div className="text-sm font-semibold text-foreground">
                    {prettyAction(ev.action)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString()}
                    {ev.user_email ? ` · ${ev.user_email}` : ""}
                    {ev.entity_type ? ` · ${ev.entity_type}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Decoded equipment">
          {vehicle.sticker_snapshot && Object.keys(vehicle.sticker_snapshot).length > 0 ? (
            <pre className="text-[11px] font-mono bg-muted/40 rounded p-3 whitespace-pre-wrap break-words max-h-64 overflow-auto">
              {JSON.stringify(vehicle.sticker_snapshot, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No decoded equipment on file yet. Re-run the VIN decode from the VIN above
              to auto-populate year / make / model / trim / engine / fuel type.
            </p>
          )}
        </Card>

        <Card title="Recall status">
          {vehicle.recall_check ? (
            <pre className="text-[11px] font-mono bg-muted/40 rounded p-3 whitespace-pre-wrap break-words max-h-40 overflow-auto">
              {JSON.stringify(vehicle.recall_check, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No NHTSA recall check on file. A fresh check runs automatically when you
              publish the shopper page. Publish is blocked if the VIN has an active
              do-not-drive campaign without an admin override.
            </p>
          )}
        </Card>
      </div>

      <div className="space-y-3">
        <Card title="Milestones">
          <ul className="space-y-2 text-xs">
            <Item ok label="Vehicle created" when={vehicle.created_at} />
            <Item ok={!!vehicle.ymm} label="VIN decoded" when={vehicle.ymm ? vehicle.updated_at : null} />
            <Item ok={!!vehicle.prep_status?.foreman_signed_at} label="Prep & install signed off" when={vehicle.prep_status?.foreman_signed_at || null} />
            <Item ok={vehicle.status === "published"} label="Shopper page published" when={vehicle.published_at} />
          </ul>
        </Card>

        <Card title="Public URL">
          {vehicle.status === "published" ? (
            <a
              href={`${window.location.origin}/v/${vehicle.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary break-all font-mono hover:underline"
            >
              {window.location.origin}/v/{vehicle.slug}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">
              Not yet published. Published vehicles get a shareable URL,
              QR code, and embed snippet for the dealer's website.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

const DocumentsPanel = ({ vehicle, onReload }: { vehicle: VehicleRow; onReload: () => void }) => {
  const [uploading, setUploading] = useState<string | null>(null);

  const upload = async (file: File, type: "factory_sticker" | "carfax" | "brochure" | "we_owe" | "other") => {
    if (!vehicle.tenant_id) {
      toast.error("Vehicle has no tenant — re-save the vehicle file first");
      return;
    }
    setUploading(type);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${vehicle.tenant_id}/${vehicle.id}/${type}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("vehicle-docs")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      // Try to auto-create the bucket once; ignore failures.
      await supabase.storage.createBucket("vehicle-docs", {
        public: false, fileSizeLimit: 25 * 1024 * 1024,
      }).catch(() => undefined);
      const retry = await supabase.storage
        .from("vehicle-docs")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (retry.error) {
        toast.error(`Upload failed: ${retry.error.message}`);
        setUploading(null);
        return;
      }
    }
    const { data: signed } = await supabase.storage
      .from("vehicle-docs")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const next = [...(vehicle.documents || []), {
      name: file.name, type, url: signed?.signedUrl || path,
    }];
    const { error: updErr } = await (supabase as any)
      .from("vehicle_listings")
      .update({ documents: next })
      .eq("id", vehicle.id);
    setUploading(null);
    if (updErr) {
      toast.error("Saved file, but failed to attach to vehicle row");
    } else {
      toast.success(`${type.replace(/_/g, " ")} attached`);
      onReload();
    }
  };

  const slots: Array<{ type: "factory_sticker" | "carfax" | "brochure" | "we_owe" | "other"; label: string; desc: string }> = [
    { type: "factory_sticker", label: "Factory window sticker", desc: "OEM Monroney PDF / image — we'll show it to the buyer at signing." },
    { type: "carfax", label: "Carfax / AutoCheck", desc: "Vehicle history report — attach for buyer review + signoff." },
    { type: "brochure", label: "Product brochure", desc: "OEM or dealer marketing PDF — appears on the shopper page." },
    { type: "we_owe", label: "\"We owe\"", desc: "Items the dealership agreed to deliver post-sale (e.g. pending install)." },
    { type: "other", label: "Other", desc: "Anything else — inspection, MPI, warranty paperwork." },
  ];

  const filesByType = useMemo(() => {
    const m: Record<string, typeof vehicle.documents> = {};
    (vehicle.documents || []).forEach((d) => {
      m[d.type] = m[d.type] || [];
      m[d.type].push(d);
    });
    return m;
  }, [vehicle.documents]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {slots.map((s) => (
        <div key={s.type} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{s.label}</h3>
            <span className="text-[10px] text-muted-foreground">{(filesByType[s.type] || []).length} file(s)</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{s.desc}</p>
          {(filesByType[s.type] || []).map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-primary hover:underline truncate"
            >
              {d.name}
            </a>
          ))}
          <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed border-border text-xs font-semibold cursor-pointer hover:bg-muted/40">
            <Upload className="w-3 h-3" />
            {uploading === s.type ? "Uploading…" : "Upload"}
            <input
              type="file"
              className="hidden"
              disabled={uploading !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f, s.type);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      ))}
    </div>
  );
};

const LabelsPanel = ({ vehicle }: { vehicle: VehicleRow }) => {
  const navigate = useNavigate();
  const links = vehicle.condition === "new"
    ? [
        { path: "/new-car-sticker", label: "New-car Monroney + Addendum", desc: "Factory-style sticker with dealer-installed accessories and doc fee." },
        { path: "/buyers-guide",    label: "FTC Buyers Guide", desc: "Required for used sales. Spanish version auto-toggles." },
      ]
    : [
        { path: "/used-car-sticker", label: "Used-car Monroney + Addendum", desc: "Three layouts: full, equipment-only, accessories-only." },
        { path: "/cpo-sheet",        label: "CPO sheet",  desc: "Certified Pre-Owned disclosure template." },
        { path: "/buyers-guide",     label: "FTC Buyers Guide", desc: "Required; bilingual (en/es)." },
        { path: "/trade-up",         label: "Trade-Up sticker", desc: "For demo / courtesy / trade-in display units." },
      ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">Generate labels for this vehicle</h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          Every label pulls VIN, YMM, trim, equipment, and price from this file. When
          you publish to the shopper portal, the QR on the printed sticker resolves
          to <span className="font-mono">/v/{vehicle.slug}</span>.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {links.map((l) => (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-premium transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                {l.label}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{l.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const JumpTo = ({ path, reason }: { path: string; reason: string }) => {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-card p-6 text-center space-y-3">
      <p className="text-sm text-muted-foreground">{reason}</p>
      <button
        onClick={() => navigate(path)}
        className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5"
      >
        Open →
      </button>
      <p className="text-[11px] text-muted-foreground">
        Next wave folds this workflow directly into the vehicle file so you never
        leave the page.
      </p>
    </div>
  );
};

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
    {children}
  </div>
);

const Item = ({ ok, label, when }: { ok: boolean; label: string; when: string | null }) => (
  <li className="flex items-center justify-between gap-2">
    <span className="inline-flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </span>
    <span className="text-[10px] text-muted-foreground">
      {when ? new Date(when).toLocaleDateString() : "pending"}
    </span>
  </li>
);

export default VehicleFile;
