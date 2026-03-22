import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, CheckSquare, BarChart3,
  Settings, GraduationCap, Zap, Users, FilePlus,
  FileText, BookOpen,
} from "lucide-react";
import { getChildSession } from "@/lib/childSession";
import { NavLink } from "@/components/NavLink";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { LangToggle } from "@/components/LangToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navByRole: Record<string, { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  superiori: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Studia con AI", url: "/challenge/new", icon: MessageSquare },
    { title: "I miei task", url: "/add-homework", icon: CheckSquare },
    { title: "Memoria", url: "/memory", icon: BookOpen },
    { title: "Impostazioni", url: "/settings", icon: Settings },
  ],
  universitario: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Studia con AI", url: "/challenge/new", icon: MessageSquare },
    { title: "Esami", url: "/dashboard", icon: GraduationCap },
    { title: "Tunnel Focus", url: "/dashboard", icon: Zap },
    { title: "Memoria", url: "/memory", icon: BookOpen },
    { title: "Impostazioni", url: "/settings", icon: Settings },
  ],
  docente: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Le mie classi", url: "/dashboard", icon: Users },
    { title: "Genera Verifica", url: "/dashboard", icon: FilePlus },
    { title: "Verifiche salvate", url: "/dashboard", icon: FileText },
    { title: "Chat AI", url: "/challenge/new", icon: MessageSquare },
    { title: "Impostazioni", url: "/settings", icon: Settings },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const session = getChildSession();
  const profile = session?.profile;
  const role = profile?.school_level || "";
  const items = navByRole[role] || navByRole.superiori;
  const name = profile?.name || "Utente";
  const roleLabel = role === "superiori" ? "Studente" : role === "universitario" ? "Universitario" : role === "docente" ? "Docente" : "";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <span className="font-display text-sm font-bold text-sidebar-foreground tracking-tight">InSchool</span>
                <span className="block text-[10px] text-sidebar-foreground/50 -mt-0.5">by AzarLabs</span>
              </div>
            )}
          </button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">{collapsed ? "" : "Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location.pathname === item.url ||
                  (item.url === "/challenge/new" && location.pathname.startsWith("/challenge"));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors rounded-lg"
                        activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium border-l-2 border-sidebar-primary"
                      >
                        <item.icon className="mr-2.5 h-4 w-4" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom: user info */}
        {!collapsed && (
          <div className="mt-auto px-4 py-4 border-t border-sidebar-border space-y-3">
            <LangToggle />
            <div className="flex items-center gap-2.5">
              <AvatarInitials name={name} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{name}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">{roleLabel}</p>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
