import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight, Send, Flame, BookOpen, AlertTriangle, Sparkles, MessageCircle, PenLine, Heart, BatteryLow, CloudRain } from "lucide-react";
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
  recentEmotions: any[];
  recentErrors: any[];
  recentSessions: any[];
}

function buildLocalCoachMessage(profileName: string, ctx: CoachContext) {
  const firstName = profileName || "campione";

  if (ctx.urgentCount > 0 && ctx.pendingHomework[0]?.subject) {
    const hw = ctx.pendingHomework[0];
    return {
      message: `${firstName}, ci sono ${ctx.urgentCount} compiti urgenti — il primo è di ${hw.subject}. Vuoi partire da quello?`,
      action: { text: `Inizia ${hw.subject}`, route: hw.id ? `/us?type=guided&hw=${hw.id}` : `/study-tasks` },
    };
  }

  if (ctx.streak > 0 && ctx.pendingHomework.length > 0) {
    return {
      message: `${firstName}, ${ctx.streak} giorni consecutivi — bella costanza! Hai ${ctx.pendingHomework.length} compiti aperti. Da quale partiamo?`,
      action: { text: "Vedi i compiti", route: "/dashboard" },
    };
  }

  if (ctx.pendingHomework.length > 0) {
    return {
      message: `${firstName}, hai ${ctx.pendingHomework.length} compiti in sospeso. Vuoi che li affrontiamo insieme?`,
      action: { text: "Guarda i compiti", route: "/dashboard" },
    };
  }

  if (ctx.recentErrors.length > 0) {
    const subject = ctx.recentErrors[0]?.subject;
    return {
      message: `${firstName}, ho notato qualche difficoltà ${subject ? `in ${subject}` : "recente"}. Vuoi che ci lavoriamo un po' insieme?`,
      action: { text: "Ripassa con me", route: subject ? `/us?type=review&subject=${encodeURIComponent(subject)}` : "/us?type=review" },
    };
  }

  if (ctx.streak > 0) {
    return {
      message: `${firstName}, ${ctx.streak} giorni di fila — stai andando forte! Vuoi fare un ripasso veloce per mantenere il ritmo?`,
      action: { text: "Ripasso veloce", route: "/us?type=review" },
    };
  }

  return {
    message: `${firstName}, sono qui per te. Raccontami come va o scegli cosa vuoi fare oggi.`,
    action: { text: "Parla col coach", route: "/us?type=study" },
  };
}

export function CoachPresence({ variant = "full" }: { variant?: "home" | "full" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<{ text: string; route: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachInput, setCoachInput] = useState("");
  const [ctx, setCtx] = useState<CoachContext>({
    streak: 0, pendingHomework: [], teacherAssignments: [],
    urgentCount: 0, recentEmotions: [], recentErrors: [], recentSessions: [],
  });

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
      let recentEmotions: any[] = [];
      let recentErrors: any[] = [];
      let recentSessions: any[] = [];

      if (childMode && childSession) {
        const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`;
        const childHeaders = { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
        const childBody = { accessCode: childSession.accessCode, childProfileId: childSession.profileId };

        const [tasksRes, gamRes] = await Promise.all([
          fetch(baseUrl, { method: "POST", headers: childHeaders, body: JSON.stringify({ ...childBody, action: "get-tasks" }) }),
          fetch(baseUrl, { method: "POST", headers: childHeaders, body: JSON.stringify({ ...childBody, action: "get-gamification" }) }),
        ]);

        const tasksData = await tasksRes.json();
        const gamJson = await gamRes.json();

        pending = (Array.isArray(tasksData) ? tasksData : [])
          .filter((t: any) => !t.completed)
          .sort((a: any, b: any) => {
            if (!a.due_date) return 1; if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          })
          .slice(0, 5)
          .map((t: any) => ({ id: t.id, title: t.title, subject: t.subject, due_date: t.due_date }));

        streak = gamJson?.streak || 0;
        gamData = gamJson || null;
      } else if (profileId) {
        const userId = user?.id || profileId;

        const [homeworkRes, sessionsRes, gamRes, assignRes, emotionsRes, errorsRes] = await Promise.all([
          supabase.from("homework_tasks")
            .select("id, title, subject, due_date, completed")
            .eq("child_profile_id", profileId).eq("completed", false)
            .order("due_date", { ascending: true }).limit(5),
          supabase.from("guided_sessions")
            .select("homework_id, completed_at, bloom_level_reached, status")
            .eq("user_id", userId)
            .order("completed_at", { ascending: false }).limit(3),
          supabase.from("gamification")
            .select("streak, focus_points, consistency_points, autonomy_points")
            .eq("child_profile_id", profileId).maybeSingle(),
          user?.id
            ? supabase.from("teacher_assignments").select("title, subject, type, due_date")
                .eq("student_id", user.id).order("assigned_at", { ascending: false }).limit(3)
            : Promise.resolve({ data: [], error: null } as any),
          supabase.from("emotional_checkins")
            .select("emotional_tone, energy_level, signals, checkin_date")
            .eq("child_profile_id", profileId)
            .order("checkin_date", { ascending: false }).limit(3),
          supabase.from("learning_errors")
            .select("subject, topic, error_type, description, resolved")
            .eq("user_id", userId).eq("resolved", false)
            .order("created_at", { ascending: false }).limit(5),
        ]);

        pending = (homeworkRes.data || []).map((t: any) => ({ id: t.id, title: t.title, subject: t.subject, due_date: t.due_date }));
        streak = gamRes.data?.streak || 0;
        assignments = assignRes.data || [];
        recentSessions = sessionsRes.data || [];
        lastSession = recentSessions[0] || null;
        gamData = gamRes.data || null;
        recentEmotions = emotionsRes.data || [];
        recentErrors = errorsRes.data || [];
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      const urgentCount = pending.filter((t: any) => t.due_date && new Date(t.due_date).getTime() <= tomorrow.getTime()).length;

      const contextData: CoachContext = {
        streak, pendingHomework: pending, teacherAssignments: assignments,
        urgentCount, recentEmotions, recentErrors, recentSessions,
      };
      setCtx(contextData);

      const localFallback = buildLocalCoachMessage(profile?.name || "", contextData);

      try {
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
            gender: profile?.gender || null,
            lastSession,
            pendingHomework: pending,
            recentEmotions,
            recentErrors,
            recentSessions,
            streak,
            teacherAssignments: assignments,
            urgentCount,
            gamification: gamData,
          }),
        });

        if (!res.ok) throw new Error("edge fn error");

        const data = await res.json();
        setMessage(data?.message?.trim() || localFallback.message);
        setAction(
          data?.suggestedAction && data?.actionRoute
            ? { text: data.suggestedAction, route: data.actionRoute }
            : localFallback.action
        );
      } catch {
        setMessage(localFallback.message);
        setAction(localFallback.action);
      }
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
    navigate(`/us?type=study&msg=${encodeURIComponent(coachInput)}`);
  };

  const quickActions = [
    { label: "Spiegami un argomento", icon: <Sparkles className="w-3 h-3" />, msg: "Vorrei capire meglio un argomento" },
    { label: "Aiutami a organizzarmi", icon: <PenLine className="w-3 h-3" />, msg: "Aiutami a organizzare lo studio di oggi" },
  ];

  const emotionalChips = [
    { label: "Non mi va oggi", icon: <CloudRain className="w-3 h-3" />, msg: "Oggi non ho proprio voglia di studiare, non me la sento", color: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" },
    { label: "Sono stanco", icon: <BatteryLow className="w-3 h-3" />, msg: "Mi sento stanco e senza energie oggi", color: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" },
    { label: "Ho bisogno di parlare", icon: <Heart className="w-3 h-3" />, msg: "Ho bisogno di parlare con qualcuno di come mi sento", color: "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300" },
  ];

  const showPills = variant === "full";
  const pills: { icon: JSX.Element; label: string; color: string }[] = [];
  if (showPills) {
    if (ctx.streak > 0) pills.push({ icon: <Flame className="w-3 h-3" />, label: `${ctx.streak} giorni`, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" });
    if (ctx.urgentCount > 0) pills.push({ icon: <AlertTriangle className="w-3 h-3" />, label: `${ctx.urgentCount} urgenti`, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" });
    if (ctx.pendingHomework.length > 0) pills.push({ icon: <BookOpen className="w-3 h-3" />, label: `${ctx.pendingHomework.length} compiti`, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" });
    if (ctx.teacherAssignments.length > 0) pills.push({ icon: <BookOpen className="w-3 h-3" />, label: `${ctx.teacherAssignments.length} dal prof`, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-4 sm:p-5">
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
            <p className="text-sm text-foreground leading-relaxed font-medium">{message}</p>
          )}

          {!loading && pills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pills.map((pill, i) => (
                <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill.color}`}>
                  {pill.icon}{pill.label}
                </span>
              ))}
            </div>
          )}

          {action && !loading && (
            <button onClick={() => navigate(action.route)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              {action.text}<ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick action chips */}
      {!loading && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={() => navigate(`/us?type=study&msg=${encodeURIComponent(qa.msg)}`)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {qa.icon}{qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Emotional chips */}
      {!loading && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {emotionalChips.map((ec) => (
            <button
              key={ec.label}
              onClick={() => navigate(`/us?type=study&msg=${encodeURIComponent(ec.msg)}`)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors hover:opacity-80 ${ec.color}`}
            >
              {ec.icon}{ec.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat input */}
      <div className="border-t border-border pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={coachInput}
            onChange={(e) => setCoachInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Scrivi al coach..."
            className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-muted/50"
          />
          <button
            onClick={handleSend}
            disabled={!coachInput.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
