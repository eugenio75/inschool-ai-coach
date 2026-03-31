import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Calendar, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LangToggle } from "@/components/LangToggle";

function TeacherNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("teacher_activity_feed")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id)
      .is("read_at", null)
      .then(({ count }: any) => setUnreadCount(count || 0));
  }, [user, location.pathname]);

  const navItems = [
    { icon: Bell, route: "/notifications", label: "Notifiche", badge: unreadCount },
    { icon: Calendar, route: "/agenda-docente", label: "Agenda", badge: 0 },
    { icon: Settings, route: "/settings", label: "Impostazioni", badge: 0 },
  ];

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-5 bg-card sticky top-0 z-50">
      <button
        onClick={() => navigate("/dashboard")}
        className="font-display text-lg font-bold text-primary tracking-tight hover:opacity-80 transition-opacity"
      >
        InSchool
      </button>
      <div className="flex items-center gap-1">
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
    </header>
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
