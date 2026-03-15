import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AddHomework from "./pages/AddHomework";
import HomeworkDetail from "./pages/HomeworkDetail";
import FocusSession from "./pages/FocusSession";
import MemoryRecap from "./pages/MemoryRecap";
import ParentDashboard from "./pages/ParentDashboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-homework" element={<AddHomework />} />
          <Route path="/homework/:taskId" element={<HomeworkDetail />} />
          <Route path="/focus/:taskId" element={<FocusSession />} />
          <Route path="/memory" element={<MemoryRecap />} />
          <Route path="/parent-dashboard" element={<ParentDashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
