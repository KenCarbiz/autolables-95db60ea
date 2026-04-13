import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DealerSettingsProvider } from "@/contexts/DealerSettingsContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { AuditProvider } from "@/contexts/AuditContext";
import AppShell from "@/components/layout/AppShell";
import ThemeInjector from "@/components/layout/ThemeInjector";
import OnboardingGate from "@/components/layout/OnboardingGate";
import ErrorBoundary from "@/components/layout/ErrorBoundary";

// Lazy-loaded pages — each becomes its own chunk
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Admin = lazy(() => import("./pages/Admin"));
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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <TenantProvider>
          <DealerSettingsProvider>
            <AuditProvider>
              <BrowserRouter>
                <ThemeInjector />
                <OnboardingGate>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Public routes — no shell */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/sign/:token" element={<MobileSigning />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/scan" element={<ScanPage />} />
                      <Route path="/vehicle/:vin" element={<VehiclePortal />} />
                      <Route path="/deal/:token" element={<DealSigning />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/brand" element={<BrandGuide />} />

                      {/* Signed-in routes — wrapped in AppShell */}
                      <Route path="/" element={<AppShell><Index /></AppShell>} />
                      <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
                      <Route path="/admin" element={<AppShell><Admin /></AppShell>} />
                      <Route path="/saved" element={<AppShell><SavedAddendums /></AppShell>} />
                      <Route path="/buyers-guide" element={<AppShell><BuyersGuide /></AppShell>} />
                      <Route path="/trade-up" element={<AppShell><TradeUpSticker /></AppShell>} />
                      <Route path="/used-car-sticker" element={<AppShell><UsedCarSticker /></AppShell>} />
                    <Route path="/new-car-sticker" element={<AppShell><NewCarSticker /></AppShell>} />
                      <Route path="/cpo-sheet" element={<AppShell><CpoSheet /></AppShell>} />
                      <Route path="/compliance" element={<AppShell><ComplianceCenter /></AppShell>} />
                    <Route path="/description-writer" element={<AppShell><DescriptionWriter /></AppShell>} />
                      <Route path="/add-inventory" element={<AppShell><SaveCarInventory /></AppShell>} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </OnboardingGate>
              </BrowserRouter>
            </AuditProvider>
          </DealerSettingsProvider>
        </TenantProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
