import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Calendar, Settings, FileText, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LangToggle } from "@/components/LangToggle";
import { AnimatePresence, motion } from "framer-motion";

function TeacherNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("teacher_activity_feed")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id)
      .is("read_at", null)
      .then(({ count }: any) => setUnreadCount(count || 0));
  }, [user, location.pathname]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { icon: FileText, route: "/materiali-docente", label: "Materiali", badge: 0 },
    { icon: Bell, route: "/notifications", label: "Notifiche", badge: unreadCount },
    { icon: Calendar, route: "/agenda-docente", label: "Agenda", badge: 0 },
    { icon: Settings, route: "/settings", label: "Impostazioni", badge: 0 },
  ];

  return (
    <>
      <header className="h-14 flex items-center justify-between border-b border-border px-5 bg-card sticky top-0 z-50">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-baseline gap-1.5 hover:opacity-80 transition-opacity"
        >
          <span className="font-black text-2xl tracking-tight">
            <span className="text-foreground">Sar</span>
            <span className="text-primary">AI</span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">Better</span>
        </button>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          <LangToggle />
          {navItems.map(({ icon: Icon, route, label, badge }) => (
            <button
              key={route}
              onClick={() => navigate(route)}
              title={label}
              className={cn(
                "relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                location.pathname === route
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile: notification bell (always visible) + hamburger */}
        <div className="flex sm:hidden items-center gap-1">
          <button
            onClick={() => navigate("/notifications")}
            className={cn(
              "relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
              location.pathname === "/notifications"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            )}
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="sm:hidden fixed top-14 left-0 right-0 z-40 bg-card border-b border-border shadow-lg"
          >
            <div className="px-4 py-3 space-y-1">
              {navItems
                .filter(item => item.route !== "/notifications") // already shown outside
                .map(({ icon: Icon, route, label }) => (
                  <button
                    key={route}
                    onClick={() => navigate(route)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      location.pathname === route
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              <div className="pt-2 border-t border-border mt-2">
                <LangToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {menuOpen && (
        <div
          className="sm:hidden fixed inset-0 top-14 z-30 bg-black/20"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TeacherNavbar />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
