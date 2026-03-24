import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { AdultLayout } from "@/components/AdultLayout";
import { getChildSession as getCS } from "@/lib/childSession";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ProfileSelector = lazy(() => import("./pages/ProfileSelector"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AddHomework = lazy(() => import("./pages/AddHomework"));
const HomeworkDetail = lazy(() => import("./pages/HomeworkDetail"));
const FocusSession = lazy(() => import("./pages/FocusSession"));
const CoachChallenge = lazy(() => import("./pages/CoachChallenge"));
const MemoryRecap = lazy(() => import("./pages/MemoryRecap"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const EmotionalCheckin = lazy(() => import("./pages/EmotionalCheckin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Security = lazy(() => import("./pages/Security"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const CredentialVerify = lazy(() => import("./pages/CredentialVerify"));
const LandingStudenti = lazy(() => import("./pages/LandingStudenti"));
const LandingDocenti = lazy(() => import("./pages/LandingDocenti"));
const GuidedSession = lazy(() => import("./pages/GuidedSession"));
const PrepSession = lazy(() => import("./pages/PrepSession"));
const ClassView = lazy(() => import("./pages/ClassView"));
const StudentView = lazy(() => import("./pages/StudentView"));
const StudentProgress = lazy(() => import("./pages/StudentProgress"));
const Agenda = lazy(() => import("./pages/Agenda"));
const AgendaDocente = lazy(() => import("./pages/AgendaDocente"));
const FreeStudySession = lazy(() => import("./pages/FreeStudySession"));
const UnifiedSession = lazy(() => import("./pages/UnifiedSession"));
const MaterialLibrary = lazy(() => import("./pages/MaterialLibrary"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// Routes accessible by either parent auth OR child session
function AccessibleRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const childSession = isChildSession();
  if (loading) return <PageLoader />;
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
import { LangProvider } from "@/contexts/LangContext";

// Global Guard for Intelligent Routing
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

function MaybeAdultLayout({ children }: { children: React.ReactNode }) {
  const session = getCS();
  const isAdult = ["superiori", "universitario", "docente"].includes(session?.profile?.school_level || "");
  if (isAdult) return <AdultLayout>{children}</AdultLayout>;
  return <>{children}</>;
}

const AppRoutes = () => (
  <RoleGuard>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/studenti" element={<LandingStudenti />} />
        <Route path="/docenti" element={<LandingDocenti />} />
        <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
        <Route path="/profiles" element={<ProtectedRoute><ProfileSelector /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/checkin" element={<AccessibleRoute><EmotionalCheckin /></AccessibleRoute>} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/security" element={<Security />} />
        <Route path="/verify" element={<CredentialVerify />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<AccessibleRoute><MaybeAdultLayout><Dashboard /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/add-homework" element={<AccessibleRoute><MaybeAdultLayout><AddHomework /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/homework/:taskId" element={<AccessibleRoute><HomeworkDetail /></AccessibleRoute>} />
        <Route path="/focus/:taskId" element={<AccessibleRoute><FocusSession /></AccessibleRoute>} />
        <Route path="/challenge/:missionId" element={<AccessibleRoute><CoachChallenge /></AccessibleRoute>} />
        <Route path="/session/:homeworkId" element={<AccessibleRoute><GuidedSession /></AccessibleRoute>} />
        <Route path="/prep/:subject?" element={<AccessibleRoute><MaybeAdultLayout><PrepSession /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/memory" element={<AccessibleRoute><MaybeAdultLayout><MemoryRecap /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/progress" element={<AccessibleRoute><MaybeAdultLayout><StudentProgress /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/agenda" element={<AccessibleRoute><MaybeAdultLayout><Agenda /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/study" element={<AccessibleRoute><MaybeAdultLayout><FreeStudySession /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/us" element={<AccessibleRoute><UnifiedSession /></AccessibleRoute>} />
        <Route path="/libreria" element={<AccessibleRoute><MaybeAdultLayout><MaterialLibrary /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/agenda-docente" element={<AccessibleRoute><MaybeAdultLayout><AgendaDocente /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/parent-dashboard" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
        <Route path="/student-profile" element={<AccessibleRoute><StudentProfile /></AccessibleRoute>} />
        <Route path="/classe/:classId" element={<AccessibleRoute><MaybeAdultLayout><ClassView /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/studente/:studentId" element={<AccessibleRoute><MaybeAdultLayout><StudentView /></MaybeAdultLayout></AccessibleRoute>} />
        <Route path="/settings" element={<ProtectedRoute><MaybeAdultLayout><Settings /></MaybeAdultLayout></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </RoleGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LangProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
            <BottomNav />
          </BrowserRouter>
        </TooltipProvider>
      </LangProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;