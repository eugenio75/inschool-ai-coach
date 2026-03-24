import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight, Send, Flame, BookOpen, AlertTriangle, Heart, BatteryLow, CloudRain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getCoachAvatarSrc } from "@/components/shared/CoachAvatarPicker";

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

const placeholders = [
  "Chiedimi qualsiasi cosa...",
  "Raccontami come va...",
  "Su cosa vuoi lavorare?",
  "Come posso aiutarti oggi?",
];

const moodOptions = [
  { label: "Non mi va oggi", icon: CloudRain, msg: "Oggi non ho proprio voglia di studiare, non me la sento", color: "text-blue-600 dark:text-blue-400" },
  { label: "Sono stanco", icon: BatteryLow, msg: "Mi sento stanco e senza energie oggi", color: "text-amber-600 dark:text-amber-400" },
  { label: "Ho bisogno di parlare", icon: Heart, msg: "Ho bisogno di parlare con qualcuno di come mi sento", color: "text-rose-600 dark:text-rose-400" },
];

export function CoachPresence({ variant = "full" }: { variant?: "home" | "full" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<{ text: string; route: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [coachInput, setCoachInput] = useState("");
  const [showMood, setShowMood] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const moodRef = useRef<HTMLDivElement>(null);
  const [coachAvatar, setCoachAvatar] = useState<string | null>(null);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CoachContext>({
    streak: 0, pendingHomework: [], teacherAssignments: [],
    urgentCount: 0, recentEmotions: [], recentErrors: [], recentSessions: [],
  });

  // Rotate placeholder
  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx(i => (i + 1) % placeholders.length), 4000);
    return () => clearInterval(timer);
  }, []);

  // Close mood on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moodRef.current && !moodRef.current.contains(e.target as Node)) setShowMood(false);
    }
    if (showMood) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMood]);

  useEffect(() => {
    fetchCoachMessage();
    // Load coach preferences
    const loadCoachPrefs = async () => {
      const profileId = getChildSession()?.profileId || profile?.id;
      if (!profileId) return;
      const { data } = await supabase.from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
      const prefs = (data?.data as any) || {};
      if (prefs.coach_avatar) setCoachAvatar(prefs.coach_avatar);
      if (prefs.coach_name) setCoachName(prefs.coach_name);
    };
    loadCoachPrefs();
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

  const handleMoodSelect = (msg: string) => {
    setShowMood(false);
    navigate(`/us?type=study&msg=${encodeURIComponent(msg)}`);
  };

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

          {action && !loading && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => navigate(action.route)}
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
            >
              {action.text}<ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Chat input with mood button */}
      {!loading && (
        <div className="border-t border-border pt-3">
          <div className="flex gap-2 items-center">
            {/* Mood toggle */}
            <div className="relative" ref={moodRef}>
              <button
                onClick={() => setShowMood(!showMood)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  showMood ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="Come ti senti?"
              >
                <Heart className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showMood && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[200px] z-10"
                  >
                    <p className="text-[10px] text-muted-foreground font-medium px-2 pt-1 pb-1.5">Come ti senti oggi?</p>
                    {moodOptions.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => handleMoodSelect(opt.msg)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted transition-colors"
                      >
                        <opt.icon className={`w-4 h-4 shrink-0 ${opt.color}`} />
                        <span className="text-xs font-medium text-foreground">{opt.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input
              type="text"
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={placeholders[placeholderIdx]}
              className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-muted/50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!coachInput.trim()}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-xl transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
