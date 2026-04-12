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
import Dashboard from "./pages/Dashboard.tsx";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Admin from "./pages/Admin.tsx";
import SavedAddendums from "./pages/SavedAddendums.tsx";
import BuyersGuide from "./pages/BuyersGuide.tsx";
import NotFound from "./pages/NotFound.tsx";
import MobileSigning from "./pages/MobileSigning.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import TradeUpSticker from "./pages/TradeUpSticker.tsx";
import About from "./pages/About.tsx";
import BrandGuide from "./pages/BrandGuide.tsx";
import ScanPage from "./pages/ScanPage.tsx";
import ComplianceCenter from "./pages/ComplianceCenter.tsx";
import VehiclePortal from "./pages/VehiclePortal.tsx";

const queryClient = new QueryClient();

const App = () => (
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
                  <Routes>
                    {/* Public routes — no shell */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/sign/:token" element={<MobileSigning />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/scan" element={<ScanPage />} />
                    <Route path="/vehicle/:vin" element={<VehiclePortal />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/brand" element={<BrandGuide />} />

                    {/* Signed-in routes — wrapped in AppShell */}
                    <Route path="/" element={<AppShell><Index /></AppShell>} />
                    <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
                    <Route path="/admin" element={<AppShell><Admin /></AppShell>} />
                    <Route path="/saved" element={<AppShell><SavedAddendums /></AppShell>} />
                    <Route path="/buyers-guide" element={<AppShell><BuyersGuide /></AppShell>} />
                    <Route path="/trade-up" element={<AppShell><TradeUpSticker /></AppShell>} />
                    <Route path="/compliance" element={<AppShell><ComplianceCenter /></AppShell>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </OnboardingGate>
              </BrowserRouter>
            </AuditProvider>
          </DealerSettingsProvider>
        </TenantProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
