import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, Clock, FileText, Heart, CheckCircle2, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";

const typeIcons: Record<string, React.ReactNode> = {
  warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  urgent: <AlertTriangle className="w-4 h-4 text-destructive" />,
  deadline: <Clock className="w-4 h-4 text-violet-500" />,
  material: <FileText className="w-4 h-4 text-primary" />,
  wellbeing: <Heart className="w-4 h-4 text-rose-500" />,
  positive: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  info: <Bell className="w-4 h-4 text-muted-foreground" />,
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Ora";
  if (min < 60) return `${min}min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Ieri" : `${d}g fa`;
}

export default function TeacherNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profileId = getChildSession()?.profileId;
  const [items, setItems] = useState<any[]>([]);
  const [classi, setClassi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user, profileId]);

  async function loadData() {
    setLoading(true);
    const [{ data: feed }, { data: cl }] = await Promise.all([
      (supabase as any).from("teacher_activity_feed").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false }).limit(50),
      profileId
        ? (supabase as any).from("classi").select("id, nome").eq("docente_profile_id", profileId)
        : Promise.resolve({ data: [] }),
    ]);
    setItems(feed || []);
    setClassi(cl || []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await (supabase as any).from("teacher_activity_feed").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, read_at: new Date().toISOString() } : i));
  }

  async function markAllRead() {
    const unreadIds = items.filter(i => !i.read_at).map(i => i.id);
    if (unreadIds.length === 0) return;
    await (supabase as any).from("teacher_activity_feed").update({ read_at: new Date().toISOString() }).eq("teacher_id", user!.id).is("read_at", null);
    setItems(prev => prev.map(i => ({ ...i, read_at: i.read_at || new Date().toISOString() })));
  }

  const classMap = new Map(classi.map((c: any) => [c.id, c.nome]));
  const unreadCount = items.filter(i => !i.read_at).length;

  return (
    <div className="relative">
      <BackLink label="alla home" to="/dashboard" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-2">Centro notifiche</p>
          <h1 className="font-display text-[28px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none">Notifiche</h1>
          {unreadCount > 0 && (
            <p className="text-[16px] font-normal text-muted-foreground mt-2.5">{unreadCount} non lette</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Segna tutte come lette
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[16px] font-normal text-muted-foreground">Nessuna notifica al momento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const isUnread = !item.read_at;
            const className = item.class_id ? classMap.get(item.class_id) : null;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                  isUnread
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card border-border"
                }`}
                onClick={() => {
                  if (!item.read_at) markAsRead(item.id);
                  if (item.action_route) navigate(item.action_route);
                  else if (item.class_id) navigate(`/classe/${item.class_id}`);
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {typeIcons[item.type] || typeIcons[item.severity] || typeIcons.info}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    <p className={`text-[16px] leading-snug ${isUnread ? "text-foreground font-medium" : "text-muted-foreground font-normal"}`}>
                      {item.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {className && (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{className}</span>
                    )}
                    <span className="text-[14px] font-normal text-muted-foreground">{timeAgo(item.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
