import { useNavigate, useLocation } from "react-router-dom";
import { Home, Brain, User, Plus, FolderOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { useLang } from "@/contexts/LangContext";

const ADULT_ROLES = ["superiori", "universitario", "docente"];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLang();

  const session = getChildSession();
  const role = session?.profile?.school_level || "";

  if (ADULT_ROLES.includes(role)) return null;

  const hiddenPaths = ["/focus", "/homework", "/add-homework", "/auth", "/onboarding", "/", "/challenge"];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p) && (p !== "/" || location.pathname === "/"))) {
    return null;
  }

  const isParentView = Boolean(user);

  const navItems = [
    { path: "/dashboard", label: t("nav_home"), icon: Home },
    { path: "/add-homework", label: t("nav_add"), icon: Plus, isAdd: true },
    { path: "/libreria", label: t("nav_library"), icon: FolderOpen },
    { path: "/memory", label: t("nav_review"), icon: Brain },
    ...(isParentView ? [{ path: "/profiles", label: t("nav_profile"), icon: User }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom sm:hidden">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if ((item as any).isAdd) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-0.5 px-2 py-0.5 rounded-xl transition-colors min-w-[56px] text-primary"
                aria-label={t("nav_add")}
              >
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold">{t("nav_add")}</span>
              </button>
            );
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
      </div>
    </nav>
  );
};