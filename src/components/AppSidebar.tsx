import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Settings, FolderOpen,
} from "lucide-react";
import { getChildSession } from "@/lib/childSession";
import { NavLink } from "@/components/NavLink";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { LangToggle } from "@/components/LangToggle";
import { CommandSearch } from "@/components/CommandSearch";
import { useLang } from "@/contexts/LangContext";
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

function useNavByRole() {
  const { t } = useLang();
  return {
    superiori: [
      { title: t("nav_dashboard"), url: "/dashboard", icon: LayoutDashboard },
      { title: t("nav_study_ai"), url: "/challenge/new", icon: BookOpen },
      { title: t("nav_free_study"), url: "/study", icon: BookOpen },
      { title: t("nav_my_tasks"), url: "/add-homework", icon: LayoutDashboard },
      { title: t("nav_review_reinforce"), url: "/memory", icon: BookOpen },
      { title: t("nav_library"), url: "/libreria", icon: FolderOpen },
      { title: t("nav_agenda"), url: "/agenda", icon: LayoutDashboard },
      { title: t("nav_progress"), url: "/progress", icon: BookOpen },
      { title: t("nav_settings"), url: "/settings", icon: Settings },
    ],
    universitario: [
      { title: t("nav_dashboard"), url: "/dashboard", icon: LayoutDashboard },
      { title: t("nav_study_ai"), url: "/challenge/new", icon: BookOpen },
      { title: t("nav_free_study"), url: "/study", icon: BookOpen },
      { title: t("nav_exams"), url: "/dashboard", icon: BookOpen },
      { title: t("nav_review_reinforce"), url: "/memory", icon: BookOpen },
      { title: t("nav_library"), url: "/libreria", icon: FolderOpen },
      { title: t("nav_agenda"), url: "/agenda", icon: LayoutDashboard },
      { title: t("nav_progress"), url: "/progress", icon: BookOpen },
      { title: t("nav_settings"), url: "/settings", icon: Settings },
    ],
  };
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const navByRole = useNavByRole();

  const session = getChildSession();
  const profile = session?.profile;
  const role = profile?.school_level || "";
  const name = profile?.name || "Utente";
  const roleLabel = role === "superiori" ? t("role_student") : role === "universitario" ? t("role_university") : "";

  if (role === "docente") {
    return null;
  }

  const items = navByRole[role as keyof typeof navByRole] || navByRole.superiori;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <span className="font-black text-lg tracking-tight">
                  <span className="text-sidebar-foreground">Sar</span>
                  <span className="text-primary">AI</span>
                </span>
                <span className="block text-[10px] text-sidebar-foreground/50 -mt-0.5">by AzarLabs</span>
              </div>
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 mb-2">
            <CommandSearch />
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">{collapsed ? "" : t("nav_menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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