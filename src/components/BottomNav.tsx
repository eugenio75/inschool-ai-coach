import { useNavigate, useLocation } from "react-router-dom";
import { Home, Brain, User, Plus } from "lucide-react";
import { isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/memory", label: "Memoria", icon: Brain },
  { path: "/profiles", label: "Profilo", icon: User },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isChild = isChildSession();

  const hiddenPaths = ["/focus", "/homework", "/add-homework", "/auth", "/onboarding", "/"];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p) && (p !== "/" || location.pathname === "/"))) {
    return null;
  }

  const isParentView = Boolean(user);
  const items = isParentView ? navItems : navItems.filter((i) => i.path !== "/profiles");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom sm:hidden">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if (isParentView && item.path === "/profiles") {
            return [
              <button
                key="add-homework-mobile"
                onClick={() => navigate("/add-homework")}
                className="flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-xl transition-colors min-w-[64px] text-primary"
                aria-label="Aggiungi compito"
              >
                <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-card">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold">Aggiungi</span>
              </button>,
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px] ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>,
            ];
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px] ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        {!isParentView && !isChild && (
          <button
            onClick={() => navigate("/add-homework")}
            className="flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-xl transition-colors min-w-[64px] text-primary"
            aria-label="Aggiungi compito"
          >
            <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-card">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold">Aggiungi</span>
          </button>
        )}
      </div>
    </nav>
  );
};
