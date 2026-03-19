import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ProfileSelector from "./pages/ProfileSelector";
import Onboarding from "./pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import AddHomework from "./pages/AddHomework";
import HomeworkDetail from "./pages/HomeworkDetail";
import FocusSession from "./pages/FocusSession";
import CoachChallenge from "./pages/CoachChallenge";
import MemoryRecap from "./pages/MemoryRecap";
import ParentDashboard from "./pages/ParentDashboard";
import Settings from "./pages/Settings";
import StudentProfile from "./pages/StudentProfile";
import EmotionalCheckin from "./pages/EmotionalCheckin";
import NotFound from "./pages/NotFound";

import Privacy from "./pages/Privacy";
import Security from "./pages/Security";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// Routes accessible by either parent auth OR child session
function AccessibleRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const childSession = isChildSession();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user && !childSession) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const childSession = isChildSession();
  if (loading) return null;
  if (user) return <Navigate to="/profiles" replace />;
  if (childSession) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Global Guard for Intelligent Routing (Step 1)
function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const checkRole = async () => {
      const childSession = getChildSession();
      let profile = childSession?.profile;

      if (!profile && user) {
        const { data } = await supabase.from("child_profiles").select("*").eq("parent_id", user.id).limit(1);
        if (data && data.length > 0) {
          profile = data[0];
        }
      }

      if (profile) {
        const role = profile.school_level;
        if (["superiori", "universitario", "docente"].includes(role)) {
          if (!(profile as any).onboarding_completed && location.pathname !== "/onboarding") {
            navigate("/onboarding", { replace: true });
          } else if ((profile as any).onboarding_completed && (location.pathname === "/onboarding" || location.pathname === "/profiles")) {
            navigate("/dashboard", { replace: true });
          }
        }
      }
    };
    checkRole();
  }, [user, loading, location.pathname, navigate]);

  return <>{children}</>;
}

const AppRoutes = () => (
  <RoleGuard>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
      <Route path="/profiles" element={<ProtectedRoute><ProfileSelector /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/checkin" element={<AccessibleRoute><EmotionalCheckin /></AccessibleRoute>} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/security" element={<Security />} />
      <Route path="/dashboard" element={<AccessibleRoute><Dashboard /></AccessibleRoute>} />
      <Route path="/add-homework" element={<AccessibleRoute><AddHomework /></AccessibleRoute>} />
      <Route path="/homework/:taskId" element={<AccessibleRoute><HomeworkDetail /></AccessibleRoute>} />
      <Route path="/focus/:taskId" element={<AccessibleRoute><FocusSession /></AccessibleRoute>} />
      <Route path="/challenge/:missionId" element={<AccessibleRoute><CoachChallenge /></AccessibleRoute>} />
      <Route path="/memory" element={<AccessibleRoute><MemoryRecap /></AccessibleRoute>} />
      <Route path="/parent-dashboard" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
      <Route path="/student-profile" element={<AccessibleRoute><StudentProfile /></AccessibleRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </RoleGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
          <BottomNav />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
