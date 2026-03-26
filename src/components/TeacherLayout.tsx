import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Calendar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

function TeacherNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Bell, route: "/notifications", label: "Notifiche" },
    { icon: Calendar, route: "/agenda-docente", label: "Agenda" },
    { icon: Settings, route: "/settings", label: "Impostazioni" },
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
        {navItems.map(({ icon: Icon, route, label }) => (
          <button
            key={route}
            onClick={() => navigate(route)}
            title={label}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
              location.pathname === route
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="w-[18px] h-[18px]" />
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
