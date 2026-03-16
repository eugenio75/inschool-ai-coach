import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { isChildSession } from "@/lib/childSession";
import { BottomNav } from "@/components/BottomNav";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ProfileSelector from "./pages/ProfileSelector";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AddHomework from "./pages/AddHomework";
import HomeworkDetail from "./pages/HomeworkDetail";
import FocusSession from "./pages/FocusSession";
import CoachChallenge from "./pages/CoachChallenge";
import MemoryRecap from "./pages/MemoryRecap";
import ParentDashboard from "./pages/ParentDashboard";
import Settings from "./pages/Settings";
import StudentProfile from "./pages/StudentProfile";
import NotFound from "./pages/NotFound";

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

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
    <Route path="/profiles" element={<ProtectedRoute><ProfileSelector /></ProtectedRoute>} />
    <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
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
