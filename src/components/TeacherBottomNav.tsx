import { useNavigate, useLocation } from "react-router-dom";
import { Home, Plus, FolderOpen, Calendar } from "lucide-react";
import { getChildSession } from "@/lib/childSession";

export function TeacherBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const session = getChildSession();
  const role = session?.profile?.school_level || "";

  if (role !== "docente") return null;

  // Hide on certain paths
  const hiddenPaths = ["/auth", "/onboarding", "/", "/coach-docente"];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p) && (p !== "/" || location.pathname === "/"))) {
    return null;
  }

  const navItems = [
    { path: "/dashboard", label: "Home", icon: Home },
    { path: "/materiali-docente?create=true", label: "Crea", icon: Plus },
    { path: "/materiali-docente", label: "Materiali", icon: FolderOpen },
    { path: "/agenda-docente", label: "Agenda", icon: Calendar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom sm:hidden">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.path.includes("?")
              ? location.pathname + location.search === item.path
              : location.pathname === item.path && !location.search.includes("action=create");
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px] ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} fill={isActive ? "currentColor" : "none"} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
