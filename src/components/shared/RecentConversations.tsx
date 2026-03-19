import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RecentConversationsProps {
  profileId: string | null | undefined;
  title?: string;
}

export function RecentConversations({ profileId, title = "Conversazioni recenti" }: RecentConversationsProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) { setLoading(false); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("conversation_sessions")
        .select("id, titolo, materia, updated_at")
        .eq("profile_id", profileId)
        .order("updated_at", { ascending: false })
        .limit(3);
      setSessions(data || []);
      setLoading(false);
    })();
  }, [profileId]);

  if (loading) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
      {sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <MessageSquare className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nessuna conversazione ancora</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-xl text-xs" onClick={() => navigate("/challenge/new")}>
            Inizia una chat
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => navigate(`/challenge/new?session=${s.id}`)}
              className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{s.titolo || "Conversazione"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {s.materia && <Badge variant="secondary" className="text-[10px]">{s.materia}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.updated_at), { locale: it, addSuffix: true })}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          <Button variant="ghost" size="sm" className="w-full rounded-xl text-xs text-muted-foreground" onClick={() => navigate("/challenge/new")}>
            Vai alla chat
          </Button>
        </div>
      )}
    </section>
  );
}
