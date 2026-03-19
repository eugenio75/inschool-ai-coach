import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, CheckSquare, BarChart3,
  Settings, GraduationCap, Search, Zap, Users, FilePlus,
  FileText, BookOpen,
} from "lucide-react";
import { getChildSession } from "@/lib/childSession";
import { NavLink } from "@/components/NavLink";
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
  const role = session?.profile?.school_level || "";
  const items = navByRole[role] || navByRole.superiori;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="font-display text-sm font-bold text-foreground tracking-tight">InSchool</span>
            )}
          </button>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>{collapsed ? "" : "Menu"}</SidebarGroupLabel>
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
                        className="hover:bg-muted/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
