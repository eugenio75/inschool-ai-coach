import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight, Send, Flame, BookOpen, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

interface CoachContext {
  streak: number;
  pendingHomework: any[];
  teacherAssignments: any[];
  urgentCount: number;
}

function buildLocalCoachMessage(profileName: string, ctx: CoachContext) {
  const firstName = profileName || "campionessa";

  if (ctx.urgentCount > 0 && ctx.pendingHomework[0]?.subject) {
    return {
      message: `${firstName}, ci sono ${ctx.urgentCount} compiti urgenti e il primo è di ${ctx.pendingHomework[0].subject}. Vuoi partire da quello più vicino?`,
      action: { text: `Inizia da ${ctx.pendingHomework[0].subject}`, route: "/dashboard" },
    };
  }

  if (ctx.streak > 0 && ctx.pendingHomework[0]?.subject) {
    return {
      message: `${firstName}, sei a ${ctx.streak} giorni di fila e hai ancora ${ctx.pendingHomework.length} compiti aperti. Vuoi iniziare con ${ctx.pendingHomework[0].subject}?`,
      action: { text: `Parti da ${ctx.pendingHomework[0].subject}`, route: "/dashboard" },
    };
  }

  if (ctx.pendingHomework.length > 0) {
    return {
      message: `${firstName}, oggi hai ${ctx.pendingHomework.length} compiti in sospeso. Da quale vuoi cominciare insieme?`,
      action: { text: "Guarda i compiti", route: "/dashboard" },
    };
  }

  if (ctx.streak > 0) {
    return {
      message: `${firstName}, stai costruendo una bella continuità: ${ctx.streak} giorni di fila. Vuoi fare un passo piccolo anche oggi?`,
      action: { text: "Parla col coach", route: "/challenge/new" },
    };
  }

  return {
    message: `${firstName}, sono qui con te. Vuoi organizzare il lavoro o raccontarmi da dove vuoi partire oggi?`,
    action: { text: "Apri il coach", route: "/challenge/new" },
  };
}

export function CoachPresence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<{ text: string; route: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachInput, setCoachInput] = useState("");
  const [ctx, setCtx] = useState<CoachContext>({ streak: 0, pendingHomework: [], teacherAssignments: [], urgentCount: 0 });

  useEffect(() => {
    fetchCoachMessage();
  }, []);

  async function fetchCoachMessage() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const profileId = getChildSession()?.profileId || profile?.id;
      const childSession = getChildSession();
      const childMode = isChildSession();

      let pending: any[] = [];
      let streak = 0;
      let assignments: any[] = [];
      let lastSession: any = null;
      let gamData: any = null;

      if (childMode && childSession) {
        const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`;
        const childHeaders = {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        const childBody = { accessCode: childSession.accessCode, childProfileId: childSession.profileId };

        const [tasksRes, gamRes] = await Promise.all([
          fetch(baseUrl, {
            method: "POST",
            headers: childHeaders,
            body: JSON.stringify({ ...childBody, action: "get-tasks" }),
          }),
          fetch(baseUrl, {
            method: "POST",
            headers: childHeaders,
            body: JSON.stringify({ ...childBody, action: "get-gamification" }),
          }),
        ]);

        const tasksData = await tasksRes.json();
        const gamJson = await gamRes.json();

        pending = (Array.isArray(tasksData) ? tasksData : [])
          .filter((task: any) => !task.completed)
          .sort((a: any, b: any) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          })
          .slice(0, 5)
          .map((task: any) => ({
            title: task.title,
            subject: task.subject,
            due_date: task.due_date,
            completed: task.completed,
          }));

        streak = gamJson?.streak || 0;
        gamData = gamJson || null;
      } else {
        const [homeworkRes, sessionsRes, gamRes, assignRes] = await Promise.all([
          supabase
            .from("homework_tasks")
            .select("title, subject, due_date, completed")
            .eq("child_profile_id", profileId)
            .eq("completed", false)
            .order("due_date", { ascending: true })
            .limit(5),
          supabase
            .from("guided_sessions")
            .select("homework_id, completed_at, bloom_level_reached")
            .eq("user_id", user?.id || profileId)
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1),
          supabase
            .from("gamification")
            .select("streak, focus_points, consistency_points, autonomy_points")
            .eq("child_profile_id", profileId)
            .maybeSingle(),
          user?.id
            ? supabase
                .from("teacher_assignments")
                .select("title, subject, type, due_date")
                .eq("student_id", user.id)
                .order("assigned_at", { ascending: false })
                .limit(3)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        pending = homeworkRes.data || [];
        streak = gamRes.data?.streak || 0;
        assignments = assignRes.data || [];
        lastSession = sessionsRes.data?.[0] || null;
        gamData = gamRes.data || null;
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      const urgentCount = pending.filter((task: any) => task.due_date && new Date(task.due_date).getTime() <= tomorrow.getTime()).length;

      const contextData: CoachContext = {
        streak,
        pendingHomework: pending,
        teacherAssignments: assignments,
        urgentCount,
      };

      setCtx(contextData);

      const localFallback = buildLocalCoachMessage(profile?.name || "", contextData);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-home-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          userName: profile?.name || "Studente",
          schoolLevel: profile?.school_level || "superiori",
          lastSession,
          pendingHomework: pending,
          emotionalHistory: null,
          upcomingTests: null,
          streak,
          teacherAssignments: assignments,
          urgentCount,
          gamification: gamData,
        }),
      });

      if (!res.ok) {
        setMessage(localFallback.message);
        setAction(localFallback.action);
        return;
      }

      const data = await res.json();
      const safeMessage = data?.message?.trim() ? data.message : localFallback.message;
      const safeAction = data?.suggestedAction && data?.actionRoute
        ? { text: data.suggestedAction, route: data.actionRoute }
        : localFallback.action;

      setMessage(safeMessage);
      setAction(safeAction);
    } catch (err) {
      console.error("CoachPresence error:", err);
      const localFallback = buildLocalCoachMessage(profile?.name || "", ctx);
      setMessage(localFallback.message);
      setAction(localFallback.action);
    } finally {
      setLoading(false);
    }
  }

  const handleSend = () => {
    if (!coachInput.trim()) return;
    navigate(`/challenge/new?msg=${encodeURIComponent(coachInput)}`);
  };

  const pills: { icon: JSX.Element; label: string; color: string; route?: string }[] = [];

  if (ctx.streak > 0) {
    pills.push({
      icon: <Flame className="w-3 h-3" />,
      label: `${ctx.streak} giorni`,
      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    });
  }

  if (ctx.urgentCount > 0) {
    pills.push({
      icon: <AlertTriangle className="w-3 h-3" />,
      label: `${ctx.urgentCount} urgenti`,
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      route: "/dashboard",
    });
  }

  if (ctx.pendingHomework.length > 0) {
    pills.push({
      icon: <BookOpen className="w-3 h-3" />,
      label: `${ctx.pendingHomework.length} compiti`,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    });
  }

  if (ctx.teacherAssignments.length > 0) {
    pills.push({
      icon: <BookOpen className="w-3 h-3" />,
      label: `${ctx.teacherAssignments.length} dal prof`,
      color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <Brain className="w-4 h-4 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed font-medium">
              {message}
            </p>
          )}

          {!loading && pills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pills.map((pill, i) => (
                <span
                  key={`${pill.label}-${i}`}
                  onClick={() => pill.route && navigate(pill.route)}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill.color} ${pill.route ? "cursor-pointer hover:opacity-80" : ""}`}
                >
                  {pill.icon}
                  {pill.label}
                </span>
              ))}
            </div>
          )}

          {action && !loading && (
            <button
              onClick={() => navigate(action.route)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {action.text}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={coachInput}
            onChange={(e) => setCoachInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Scrivi al coach..."
            className="flex-1 text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-muted/50"
          />
          <button
            onClick={handleSend}
            disabled={!coachInput.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
