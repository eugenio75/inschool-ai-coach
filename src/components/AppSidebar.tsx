import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, BookOpen, Plus, LogOut, Settings,
} from "lucide-react";
import { getChildSession } from "@/lib/childSession";
import { NavLink } from "@/components/NavLink";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { LangToggle } from "@/components/LangToggle";
import { CommandSearch } from "@/components/CommandSearch";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { supabase } from "@/integrations/supabase/client";
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
    { title: "Studia con AI", url: "/challenge/new", icon: BookOpen },
    { title: "I miei task", url: "/add-homework", icon: LayoutDashboard },
    { title: "Memoria", url: "/memory", icon: BookOpen },
    { title: "Impostazioni", url: "/settings", icon: Settings },
  ],
  universitario: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Studia con AI", url: "/challenge/new", icon: BookOpen },
    { title: "Esami", url: "/dashboard", icon: BookOpen },
    { title: "Tunnel Focus", url: "/dashboard", icon: BookOpen },
    { title: "Memoria", url: "/memory", icon: BookOpen },
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
  const name = profile?.name || "Utente";
  const roleLabel = role === "superiori" ? "Studente" : role === "universitario" ? "Universitario" : role === "docente" ? "Docente" : "";

  // Docente: load classes for sidebar
  const [classi, setClassi] = useState<any[]>([]);
  const [feedCounts, setFeedCounts] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (role !== "docente" || !session?.profileId) return;
    loadDocente();
  }, [role, session?.profileId]);

  async function loadDocente() {
    const { data: c } = await (supabase as any)
      .from("classi").select("id, nome, materia, codice_invito")
      .eq("docente_profile_id", session?.profileId)
      .order("created_at", { ascending: false });
    setClassi(c || []);

    if (c && c.length > 0) {
      const { data: feed } = await (supabase as any)
        .from("teacher_activity_feed")
        .select("class_id")
        .eq("teacher_id", session?.profileId)
        .is("read_at", null);
      if (feed) {
        const counts: Record<string, number> = {};
        let total = 0;
        for (const f of feed) {
          if (f.class_id) {
            counts[f.class_id] = (counts[f.class_id] || 0) + 1;
          }
          total++;
        }
        setFeedCounts(counts);
        setTotalUnread(total);
      }
    }
  }

  // ═══════════════════════════════════════
  // SIDEBAR DOCENTE
  // ═══════════════════════════════════════
  if (role === "docente") {
    return (
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarContent className="bg-[#1A3A5C]">
          {/* Logo */}
          <div className="px-4 py-4 border-b border-white/10">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              {!collapsed && (
                <div>
                  <span className="font-display text-sm font-bold text-white tracking-tight">InSchool</span>
                  <span className="block text-[10px] text-white/50 -mt-0.5">by AzarLabs</span>
                </div>
              )}
            </button>
          </div>

          {/* Search */}
          {!collapsed && (
            <div className="px-3 pt-3 pb-1">
              <CommandSearch />
            </div>
          )}

          {/* Home nav — ONLY Home link */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard"
                      end
                      className="text-white/70 hover:text-white hover:bg-white/10 transition-colors rounded-lg"
                      activeClassName="bg-white/15 text-white font-medium border-l-2 border-white"
                    >
                      <LayoutDashboard className="mr-2.5 h-4 w-4" />
                      {!collapsed && <span className="text-sm">Home</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Classi */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/40 text-[10px] uppercase tracking-widest flex items-center justify-between">
              {collapsed ? "" : "Classi"}
              {!collapsed && totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {totalUnread}
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {classi.map((cl) => {
                  const isActive = location.pathname === `/classe/${cl.id}`;
                  const unread = feedCounts[cl.id] || 0;
                  return (
                    <SidebarMenuItem key={cl.id}>
                      <SidebarMenuButton asChild>
                        <button
                          onClick={() => navigate(`/classe/${cl.id}`)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? "bg-white/15 text-white font-medium border-l-2 border-white"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${unread > 0 ? 'bg-amber-400' : 'bg-green-400'}`} />
                          {!collapsed && (
                            <>
                              <span className="truncate flex-1">{cl.nome}</span>
                              {unread > 0 && (
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shrink-0">
                                  {unread}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {classi.length === 0 && !collapsed && (
                  <p className="text-white/30 text-xs px-3 py-1">Nessuna classe</p>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={() => navigate("/dashboard")}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-white/40 hover:text-white/60 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      {!collapsed && <span>Nuova classe</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Bottom */}
          <div className="mt-auto px-4 py-4 border-t border-white/10 space-y-3">
            {!collapsed && <LangToggle />}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={() => navigate("/settings")}
                    className="flex items-center gap-2.5 w-full text-white/60 hover:text-white/80 transition-colors text-sm rounded-lg px-1 py-1.5"
                  >
                    <Settings className="w-4 h-4" />
                    {!collapsed && <span>Impostazioni</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <div className="flex items-center gap-2.5">
              <AvatarInitials name={name} size="sm" />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{name}</p>
                  <p className="text-[10px] text-white/50 capitalize">{roleLabel}</p>
                </div>
              )}
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // ═══════════════════════════════════════
  // DEFAULT SIDEBAR (superiori, universitario)
  // ═══════════════════════════════════════
  const items = navByRole[role] || navByRole.superiori;

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

        {/* Search */}
        {!collapsed && (
          <div className="px-3 mb-2">
            <CommandSearch />
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">{collapsed ? "" : "Menu"}</SidebarGroupLabel>
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
