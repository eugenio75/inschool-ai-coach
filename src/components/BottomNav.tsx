import { useNavigate, useLocation } from "react-router-dom";
import { Home, MessageSquare, RefreshCw, Target } from "lucide-react";
import { getChildSession } from "@/lib/childSession";
import { useLang } from "@/contexts/LangContext";

const HIDDEN_ROLES = ["docente"];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLang();

  const session = getChildSession();
  const storedProfile = (() => {
    try {
      const saved = localStorage.getItem("inschool-profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();
  const role = session?.profile?.school_level || storedProfile?.school_level || storedProfile?.schoolLevel || "";

  // Hide for teacher/no session; show for all student roles
  if (!role || HIDDEN_ROLES.includes(role)) return null;

  const hiddenPaths = ["/focus", "/homework", "/auth", "/onboarding", "/", "/challenge", "/us"];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p) && (p !== "/" || location.pathname === "/"))) {
    return null;
  }

  const navItems = [
    { path: "/dashboard", label: t("nav_home"), icon: Home },
    { path: "/us?type=study", label: t("nav_study"), icon: MessageSquare },
    { path: "/memory", label: t("nav_review_short"), icon: RefreshCw },
    { path: "/prep", label: t("nav_prepare"), icon: Target },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border sm:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 4px)" }}>
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.path.includes("?")
              ? location.pathname + location.search === item.path
              : location.pathname === item.path;
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
};
