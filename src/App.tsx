import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DealerSettingsProvider } from "@/contexts/DealerSettingsContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { AuditProvider } from "@/contexts/AuditContext";
import AppShell from "@/components/layout/AppShell";
import ThemeInjector from "@/components/layout/ThemeInjector";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import EntitlementGate from "@/components/layout/EntitlementGate";
import AdminGate from "@/components/layout/AdminGate";

// Wrap a signed-in route with both the app shell and the AutoLabels
// entitlement check. Users without an autolabels entitlement hit the
// ActivatePaywall instead of the page content.
const Gated = ({ children }: { children: JSX.Element }) => (
  <EntitlementGate app="autolabels">
    <AppShell>{children}</AppShell>
  </EntitlementGate>
);

// Wrap a platform-admin route — does NOT require a tenant or an app
// entitlement, only an admin-role auth.users row.
const AdminOnly = ({ children }: { children: JSX.Element }) => (
  <AdminGate>
    <AppShell>{children}</AppShell>
  </AdminGate>
);

// Lazy-loaded pages — each becomes its own chunk
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Admin = lazy(() => import("./pages/Admin"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const Inventory = lazy(() => import("./pages/Inventory"));
const VehicleFile = lazy(() => import("./pages/VehicleFile"));
const SavedAddendums = lazy(() => import("./pages/SavedAddendums"));
const BuyersGuide = lazy(() => import("./pages/BuyersGuide"));
const MobileSigning = lazy(() => import("./pages/MobileSigning"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const TradeUpSticker = lazy(() => import("./pages/TradeUpSticker"));
const About = lazy(() => import("./pages/About"));
const BrandGuide = lazy(() => import("./pages/BrandGuide"));
const ScanPage = lazy(() => import("./pages/ScanPage"));
const ComplianceCenter = lazy(() => import("./pages/ComplianceCenter"));
const VehiclePortal = lazy(() => import("./pages/VehiclePortal"));
const UsedCarSticker = lazy(() => import("./pages/UsedCarSticker"));
const NewCarSticker = lazy(() => import("./pages/NewCarSticker"));
const CpoSheet = lazy(() => import("./pages/CpoSheet"));
const DescriptionWriter = lazy(() => import("./pages/DescriptionWriter"));
const SaveCarInventory = lazy(() => import("./pages/SaveCarInventory"));
const DealSigning = lazy(() => import("./pages/DealSigning"));
const PublicListing = lazy(() => import("./pages/PublicListing"));
const PrepSignOff = lazy(() => import("./pages/PrepSignOff"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Loading fallback — minimal spinner
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    {/* MotionConfig: Wave 2 motion ladder. All framer-motion
        components inherit the out-expo easing + 320ms duration.
        reducedMotion="user" honors prefers-reduced-motion so
        accessibility users get instant state changes. */}
    <MotionConfig
      reducedMotion="user"
      transition={{
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <TenantProvider>
          <DealerSettingsProvider>
            <AuditProvider>
              <BrowserRouter>
                <ThemeInjector />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                      {/* Public routes — no shell */}
                      <Route path="/" element={<Landing />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/sign/:token" element={<MobileSigning />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/scan" element={<ScanPage />} />
                      <Route path="/vehicle/:vin" element={<VehiclePortal />} />
                      <Route path="/v/:slug" element={<PublicListing />} />
                      <Route path="/deal/:token" element={<DealSigning />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/brand" element={<BrandGuide />} />

                      {/* Signed-in routes — wrapped in AppShell + entitlement gate */}
                      <Route path="/addendum" element={<Gated><Index /></Gated>} />
                      {/* /dashboard is the dealer's landing. We now show the
                          inventory-first view at both /dashboard and
                          /inventory so the sidebar Dashboard link and the
                          Inventory link both take you to the same place. */}
                      <Route path="/dashboard" element={<Gated><Inventory /></Gated>} />
                      <Route path="/inventory" element={<Gated><Inventory /></Gated>} />
                      <Route path="/dashboard-legacy" element={<Gated><Dashboard /></Gated>} />
                      <Route path="/vehicle-file/:id" element={<Gated><VehicleFile /></Gated>} />
                      {/* /admin is shared by dealer settings (products, rules,
                          branding, leads, queue, files, audit) AND the
                          platform-admin surfaces (tenants, members,
                          entitlements, platform audit). The page renders
                          behind Gated so any tenant member can reach their
                          own settings; the platform-admin tabs are rendered
                          only when isAdmin is true via the tab list itself. */}
                      <Route path="/admin" element={<Gated><Admin /></Gated>} />
                      {/* Platform-admin is a separate route gated on
                          isAdmin role, not on an app entitlement. */}
                      <Route path="/platform-admin" element={<AdminOnly><PlatformAdmin /></AdminOnly>} />
                      <Route path="/saved" element={<Gated><SavedAddendums /></Gated>} />
                      <Route path="/buyers-guide" element={<Gated><BuyersGuide /></Gated>} />
                      <Route path="/trade-up" element={<Gated><TradeUpSticker /></Gated>} />
                      <Route path="/used-car-sticker" element={<Gated><UsedCarSticker /></Gated>} />
                      <Route path="/new-car-sticker" element={<Gated><NewCarSticker /></Gated>} />
                      <Route path="/cpo-sheet" element={<Gated><CpoSheet /></Gated>} />
                      <Route path="/compliance" element={<Gated><ComplianceCenter /></Gated>} />
                      <Route path="/description-writer" element={<Gated><DescriptionWriter /></Gated>} />
                      <Route path="/add-inventory" element={<Gated><SaveCarInventory /></Gated>} />
                      <Route path="/prep" element={<Gated><PrepSignOff /></Gated>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AuditProvider>
          </DealerSettingsProvider>
        </TenantProvider>
      </AuthProvider>
    </TooltipProvider>
    </MotionConfig>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
