import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDealerSettings, DealerSettings, DEFAULT_SETTINGS } from "@/contexts/DealerSettingsContext";
import { useProductRules, ProductRule } from "@/hooks/useProductRules";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PRODUCT_ICONS } from "@/components/addendum/ProductRow";
import { STATE_DOC_FEES } from "@/data/docFees";

interface Product {
  id: string;
  name: string;
  subtitle: string | null;
  warranty: string | null;
  badge_type: string;
  price: number;
  price_label: string | null;
  disclosure: string | null;
  sort_order: number;
  is_active: boolean;
  icon_type?: string;
}

type AdminTab = "products" | "rules" | "settings" | "branding";

const emptyProduct = {
  name: "",
  subtitle: "",
  warranty: "",
  badge_type: "installed",
  price: 0,
  price_label: "Included in Selling Price",
  disclosure: "",
  sort_order: 0,
  is_active: true,
  icon_type: "",
};

const emptyRule: Omit<ProductRule, "id"> = {
  product_id: "",
  year_min: "",
  year_max: "",
  makes: [],
  models: [],
  trims: [],
  body_styles: [],
  condition: "all",
  mileage_max: 0,
};

const FEATURE_TOGGLES: { key: keyof DealerSettings; label: string; description: string }[] = [
  { key: "feature_vin_decode", label: "VIN Decode", description: "Auto-populate vehicle info from VIN using NHTSA database" },
  { key: "feature_vin_barcode", label: "VIN Barcode", description: "Show scannable VIN barcode on addendum" },
  { key: "feature_product_icons", label: "Product Icons", description: "Show category icons next to products on the addendum" },
  { key: "feature_product_rules", label: "Product Rules", description: "Auto-assign products based on vehicle Year/Make/Model/Trim" },
  { key: "feature_buyers_guide", label: "Buyers Guide", description: "Generate FTC-compliant Buyers Guides (As-Is / Implied / Warranty)" },
  { key: "feature_spanish_buyers_guide", label: "Spanish Buyers Guide", description: "Enable Spanish language option for Buyers Guides" },
  { key: "feature_lead_capture", label: "Lead Capture", description: "Capture customer name, phone, and email when sending QR signing links" },
  { key: "feature_cobuyer_signature", label: "Co-Buyer Signature", description: "Show co-buyer signature pad on the addendum" },
  { key: "feature_ink_saving", label: "Ink-Saving Mode", description: "Show ink-saving toggle for lighter print output" },
  { key: "feature_url_scrape", label: "Website URL Import", description: "Paste a vehicle listing URL from your website to auto-fill vehicle details (VIN, stock #, mileage, color, price)" },
  { key: "feature_custom_branding", label: "Custom Branding", description: "Use custom dealer logo and branding on addendums" },
  { key: "feature_inventory", label: "Inventory Management", description: "Import and manage vehicle inventory via CSV or manual entry" },
  { key: "feature_invoicing", label: "Installer Invoicing", description: "Create and manage invoices for product installations with RO/PO numbers" },
  { key: "feature_warranty", label: "Warranty Tracking", description: "Track product warranty registrations and expirations" },
  { key: "feature_payroll", label: "Payroll Tracking", description: "Track installer piece-work pay per invoice" },
  { key: "feature_analytics", label: "Analytics Dashboard", description: "View addendum stats, product acceptance rates, and revenue metrics" },
  { key: "feature_sms", label: "SMS Delivery", description: "Send signing links via SMS text message (requires Twilio)" },
  { key: "feature_ai_descriptions", label: "AI Descriptions", description: "Generate vehicle descriptions automatically" },
  { key: "feature_blackbook", label: "Black Book Data", description: "Pull factory equipment and live market data from Black Book (requires API key)" },
];

const Admin = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { settings, updateSettings } = useDealerSettings();
  const { rules, addRule, updateRule, deleteRule } = useProductRules();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<ProductRule & { _new?: boolean }> | null>(null);
  const [fetching, setFetching] = useState(true);

  // Branding form
  const [branding, setBranding] = useState({
    dealer_name: settings.dealer_name,
    dealer_tagline: settings.dealer_tagline,
    dealer_logo_url: settings.dealer_logo_url,
    primary_color: settings.primary_color,
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/login");
    }
  }, [user, isAdmin, loading, navigate]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("sort_order");
    if (data) setProducts(data as any);
    setFetching(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSaveProduct = async () => {
    if (!editing || !editing.name) return;
    const payload = {
      name: editing.name,
      subtitle: editing.subtitle || null,
      warranty: editing.warranty || null,
      badge_type: editing.badge_type || "installed",
      price: Number(editing.price) || 0,
      price_label: editing.price_label || "Included in Selling Price",
      disclosure: editing.disclosure || null,
      sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active ?? true,
    };

    if (editing.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Product added");
    }
    // Save icon_type to localStorage (extend later to DB)
    if (editing.icon_type) {
      const iconMap = JSON.parse(localStorage.getItem("product_icons") || "{}");
      const productId = editing.id || "pending";
      iconMap[productId] = editing.icon_type;
      localStorage.setItem("product_icons", JSON.stringify(iconMap));
    }
    setEditing(null);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success("Product deleted");
    fetchProducts();
  };

  const handleSaveRule = () => {
    if (!editingRule?.product_id) { toast.error("Select a product"); return; }
    if (editingRule._new) {
      const { _new, id, ...rest } = editingRule as any;
      addRule(rest);
      toast.success("Rule added");
    } else if (editingRule.id) {
      const { _new, ...rest } = editingRule as any;
      updateRule(editingRule.id, rest);
      toast.success("Rule updated");
    }
    setEditingRule(null);
  };

  const handleSaveBranding = () => {
    updateSettings(branding);
    toast.success("Branding saved");
  };

  const handleToggleFeature = (key: keyof DealerSettings) => {
    updateSettings({ [key]: !settings[key] });
  };

  if (loading || fetching) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "products", label: "Products" },
    ...(settings.feature_product_rules ? [{ id: "rules" as const, label: "Product Rules" }] : []),
    { id: "settings", label: "Feature Toggles" },
    { id: "branding", label: "Branding" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-barlow-condensed text-foreground">Admin Panel</h1>
          <div className="flex gap-2">
            <button onClick={() => navigate("/")} className="text-xs px-3 py-1.5 rounded bg-action text-primary-foreground">← Back to Addendum</button>
            <button onClick={signOut} className="text-xs px-3 py-1.5 rounded bg-destructive text-primary-foreground">Sign Out</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Products Tab ─── */}
        {tab === "products" && (
          <div>
            <button
              onClick={() => setEditing({ ...emptyProduct, sort_order: products.length + 1 })}
              className="mb-4 px-4 py-2 bg-teal text-primary-foreground rounded font-semibold text-sm"
            >
              + Add Product
            </button>

            <div className="space-y-3">
              {products.map((p) => {
                const iconMap = JSON.parse(localStorage.getItem("product_icons") || "{}");
                const icon = iconMap[p.id];
                return (
                  <div key={p.id} className="bg-card rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {icon && settings.feature_product_icons && (
                          <span className="text-lg">{PRODUCT_ICONS[icon] || "⚙️"}</span>
                        )}
                        <div>
                          <span className="font-semibold text-foreground">{p.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.badge_type}</span>
                          {!p.is_active && <span className="ml-2 text-xs text-destructive">INACTIVE</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-sm font-semibold text-foreground">${p.price.toFixed(2)}</span>
                        <button onClick={() => setEditing({ ...p, icon_type: iconMap[p.id] || "" })} className="text-xs px-3 py-1 bg-blue text-primary-foreground rounded">Edit</button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-xs px-3 py-1 bg-destructive text-primary-foreground rounded">Delete</button>
                      </div>
                    </div>
                    {p.subtitle && <p className="text-xs text-muted-foreground mt-1">{p.subtitle}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Product Rules Tab ─── */}
        {tab === "rules" && (
          <div>
            <div className="bg-card rounded-lg p-4 shadow-sm mb-4">
              <h3 className="text-sm font-bold text-foreground mb-1">Rules-Based Product Assignment</h3>
              <p className="text-xs text-muted-foreground">
                Create rules to auto-assign products based on vehicle attributes. Products without rules always appear. Products with rules only appear when a vehicle matches at least one rule.
              </p>
            </div>

            <button
              onClick={() => setEditingRule({ ...emptyRule, _new: true })}
              className="mb-4 px-4 py-2 bg-teal text-primary-foreground rounded font-semibold text-sm"
            >
              + Add Rule
            </button>

            <div className="space-y-3">
              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">No product rules yet. All products will show on every addendum.</p>
              )}
              {rules.map((r) => {
                const product = products.find(p => p.id === r.product_id);
                return (
                  <div key={r.id} className="bg-card rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-foreground">{product?.name || "Unknown product"}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.year_min && <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded">{r.year_min}–{r.year_max || "Any"}</span>}
                          {r.makes.length > 0 && <span className="text-[10px] bg-teal/10 text-teal px-1.5 py-0.5 rounded">{r.makes.join(", ")}</span>}
                          {r.models.length > 0 && <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{r.models.join(", ")}</span>}
                          {r.condition !== "all" && <span className="text-[10px] bg-navy/10 text-navy px-1.5 py-0.5 rounded">{r.condition}</span>}
                          {r.mileage_max > 0 && <span className="text-[10px] bg-action/10 text-action px-1.5 py-0.5 rounded">≤{r.mileage_max.toLocaleString()} mi</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingRule({ ...r })} className="text-xs px-3 py-1 bg-blue text-primary-foreground rounded">Edit</button>
                        <button onClick={() => { deleteRule(r.id); toast.success("Rule deleted"); }} className="text-xs px-3 py-1 bg-destructive text-primary-foreground rounded">Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Feature Toggles Tab ─── */}
        {tab === "settings" && (
          <div>
            <div className="bg-card rounded-lg p-4 shadow-sm mb-4">
              <h3 className="text-sm font-bold text-foreground mb-1">Feature Toggles</h3>
              <p className="text-xs text-muted-foreground">
                Turn features on or off for your dealership. Disabled features won't appear on the employee-facing addendum, keeping the interface clean and focused.
              </p>
            </div>

            {/* Paper Size Settings */}
            <div className="bg-card rounded-lg p-4 shadow-sm mb-3">
              <h4 className="text-sm font-bold text-foreground mb-2">Addendum Paper Size</h4>
              <p className="text-xs text-muted-foreground mb-3">Window sticker addendum scales to this paper size. (FTC Buyers Guide remains fixed per federal regulation.)</p>
              <div className="flex gap-2 flex-wrap">
                {(["letter", "legal", "half-sheet", "custom"] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => updateSettings({ addendum_paper_size: size })}
                    className={`text-xs px-3 py-1.5 rounded border ${settings.addendum_paper_size === size ? "bg-navy text-primary-foreground border-navy" : "bg-card text-foreground border-border-custom"}`}
                  >
                    {size === "letter" && "Letter (8.5×11)"}
                    {size === "legal" && "Legal (8.5×14)"}
                    {size === "half-sheet" && "Half Sheet (5.5×8.5)"}
                    {size === "custom" && "Custom"}
                  </button>
                ))}
              </div>
              {settings.addendum_paper_size === "custom" && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Width (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.addendum_custom_width}
                      onChange={(e) => updateSettings({ addendum_custom_width: e.target.value })}
                      className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Height (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.addendum_custom_height}
                      onChange={(e) => updateSettings({ addendum_custom_height: e.target.value })}
                      className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Product Default Mode */}
            <div className="bg-card rounded-lg p-4 shadow-sm mb-3">
              <h4 className="text-sm font-bold text-foreground mb-2">Product Default Mode</h4>
              <p className="text-xs text-muted-foreground mb-3">Choose how products appear on every addendum by default. Employees can override per-product at signing if enabled.</p>
              <div className="flex gap-2 flex-wrap">
                {(["selective", "all_installed", "all_optional"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => updateSettings({ product_default_mode: mode })}
                    className={`text-xs px-3 py-1.5 rounded border ${settings.product_default_mode === mode ? "bg-navy text-primary-foreground border-navy" : "bg-card text-foreground border-border-custom"}`}
                  >
                    {mode === "selective" && "Selective (per product)"}
                    {mode === "all_installed" && "All as Installed"}
                    {mode === "all_optional" && "All as Optional"}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-custom">
                <div>
                  <p className="text-sm font-semibold text-foreground">Allow Type Override at Signing</p>
                  <p className="text-xs text-muted-foreground">Employee can toggle installed ↔ optional live with the customer</p>
                </div>
                <button
                  onClick={() => updateSettings({ allow_type_override_at_signing: !settings.allow_type_override_at_signing })}
                  className={`relative w-12 h-7 rounded-full transition-colors ${settings.allow_type_override_at_signing ? "bg-teal" : "bg-muted"}`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-transform ${settings.allow_type_override_at_signing ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            {/* Dealer Documentation Fee */}
            <div className="bg-card rounded-lg p-4 shadow-sm mb-3">
              <h4 className="text-sm font-bold text-foreground mb-2">Dealer Documentation Fee</h4>
              <p className="text-xs text-muted-foreground mb-3">Add a state-compliant documentation fee to every addendum. The correct terminology auto-applies based on your state.</p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Enable Doc Fee</span>
                <button
                  onClick={() => updateSettings({ doc_fee_enabled: !settings.doc_fee_enabled })}
                  className={`relative w-12 h-7 rounded-full transition-colors ${settings.doc_fee_enabled ? "bg-teal" : "bg-muted"}`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-transform ${settings.doc_fee_enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {settings.doc_fee_enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">State</label>
                    <select
                      value={settings.doc_fee_state}
                      onChange={(e) => updateSettings({ doc_fee_state: e.target.value })}
                      className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                    >
                      {STATE_DOC_FEES.map(s => (
                        <option key={s.stateCode} value={s.stateCode}>{s.state} — "{s.terminology}"{s.maxFee ? ` (max $${s.maxFee})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.doc_fee_amount}
                      onChange={(e) => updateSettings({ doc_fee_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Feature Toggle list */}
            <div className="space-y-2">
              {FEATURE_TOGGLES.map((ft) => (
                <div key={ft.key} className="bg-card rounded-lg p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{ft.label}</p>
                    <p className="text-xs text-muted-foreground">{ft.description}</p>
                  </div>
                  <button
                    onClick={() => handleToggleFeature(ft.key)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${(settings[ft.key] as boolean) ? "bg-teal" : "bg-muted"}`}
                  >
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-transform ${(settings[ft.key] as boolean) ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Branding Tab ─── */}
        {tab === "branding" && (
          <div>
            <div className="bg-card rounded-lg p-4 shadow-sm mb-4">
              <h3 className="text-sm font-bold text-foreground mb-1">Dealership Branding</h3>
              <p className="text-xs text-muted-foreground">
                Customize how your dealership appears on addendums and buyers guides. These settings apply to all generated documents.
              </p>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Dealership Name</label>
                <input
                  value={branding.dealer_name}
                  onChange={(e) => setBranding({ ...branding, dealer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Tagline / Subtitle</label>
                <input
                  value={branding.dealer_tagline}
                  onChange={(e) => setBranding({ ...branding, dealer_tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Logo URL</label>
                <input
                  value={branding.dealer_logo_url}
                  onChange={(e) => setBranding({ ...branding, dealer_logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm bg-background text-foreground placeholder:text-muted-foreground/50"
                />
                {branding.dealer_logo_url && (
                  <div className="mt-2 p-3 bg-muted rounded flex items-center justify-center">
                    <img src={branding.dealer_logo_url} alt="Logo preview" className="h-12 object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Primary Brand Color (hex)</label>
                <div className="flex gap-2">
                  <input
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    placeholder="#1a2b4a"
                    className="flex-1 px-3 py-2 border border-border-custom rounded text-sm bg-background text-foreground placeholder:text-muted-foreground/50"
                  />
                  {branding.primary_color && (
                    <div className="w-10 h-10 rounded border border-border-custom" style={{ backgroundColor: branding.primary_color }} />
                  )}
                </div>
              </div>
              <button onClick={handleSaveBranding} className="px-6 py-2 bg-teal text-primary-foreground rounded font-semibold text-sm">
                Save Branding
              </button>
            </div>
          </div>
        )}

        {/* ─── Product Edit Modal ─── */}
        {editing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold font-barlow-condensed">{editing.id ? "Edit Product" : "Add Product"}</h2>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Product Name</label>
                <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Subtitle</label>
                <input value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Warranty</label>
                <input value={editing.warranty || ""} onChange={(e) => setEditing({ ...editing, warranty: e.target.value })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Price ($)</label>
                  <input type="number" step="0.01" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Sort Order</label>
                  <input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Type</label>
                  <select value={editing.badge_type || "installed"} onChange={(e) => setEditing({ ...editing, badge_type: e.target.value, price_label: e.target.value === "installed" ? "Included in Selling Price" : "If Accepted" })} className="w-full px-3 py-2 border border-border-custom rounded text-sm">
                    <option value="installed">Pre-Installed</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
                {settings.feature_product_icons && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Icon</label>
                    <select
                      value={editing.icon_type || ""}
                      onChange={(e) => setEditing({ ...editing, icon_type: e.target.value })}
                      className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                    >
                      <option value="">No icon</option>
                      {Object.entries(PRODUCT_ICONS).filter(([k]) => k !== "default").map(([key, emoji]) => (
                        <option key={key} value={key}>{emoji} {key.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Price Label</label>
                <input value={editing.price_label || ""} onChange={(e) => setEditing({ ...editing, price_label: e.target.value })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Disclosure Text</label>
                <textarea value={editing.disclosure || ""} onChange={(e) => setEditing({ ...editing, disclosure: e.target.value })} className="w-full px-3 py-2 border border-border-custom rounded text-sm" rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <label className="text-xs">Active</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveProduct} className="flex-1 py-2 bg-teal text-primary-foreground rounded font-semibold text-sm">Save</button>
                <button onClick={() => setEditing(null)} className="flex-1 py-2 bg-muted text-foreground rounded font-semibold text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Rule Edit Modal ─── */}
        {editingRule && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold font-barlow-condensed">{editingRule._new ? "Add Rule" : "Edit Rule"}</h2>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Product</label>
                <select
                  value={editingRule.product_id || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, product_id: e.target.value })}
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.badge_type})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Year Min</label>
                  <input
                    value={editingRule.year_min || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, year_min: e.target.value })}
                    placeholder="e.g. 2020"
                    className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Year Max</label>
                  <input
                    value={editingRule.year_max || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, year_max: e.target.value })}
                    placeholder="e.g. 2026"
                    className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Makes (comma-separated, blank = all)</label>
                <input
                  value={editingRule.makes?.join(", ") || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, makes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="e.g. Honda, Toyota, Nissan"
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Models (comma-separated, blank = all)</label>
                <input
                  value={editingRule.models?.join(", ") || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, models: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="e.g. CR-V, RAV4, Civic"
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Trims (comma-separated, blank = all)</label>
                <input
                  value={editingRule.trims?.join(", ") || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, trims: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="e.g. EX-L, Sport, Touring"
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Body Styles (comma-separated, blank = all)</label>
                <input
                  value={editingRule.body_styles?.join(", ") || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, body_styles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="e.g. SUV, Sedan, Truck"
                  className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Condition</label>
                  <select
                    value={editingRule.condition || "all"}
                    onChange={(e) => setEditingRule({ ...editingRule, condition: e.target.value as any })}
                    className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                  >
                    <option value="all">All</option>
                    <option value="new">New Only</option>
                    <option value="used">Used Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Max Mileage (0 = no limit)</label>
                  <input
                    type="number"
                    value={editingRule.mileage_max || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, mileage_max: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border-custom rounded text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveRule} className="flex-1 py-2 bg-teal text-primary-foreground rounded font-semibold text-sm">Save Rule</button>
                <button onClick={() => setEditingRule(null)} className="flex-1 py-2 bg-muted text-foreground rounded font-semibold text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
