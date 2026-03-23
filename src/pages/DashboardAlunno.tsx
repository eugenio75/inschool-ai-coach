import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Plus, ArrowRight, Brain, Loader2, LogOut, Play,
  MessageSquare, Flame, Star, Zap, Target, FolderOpen, Sparkles,
  CheckCircle2, AlertTriangle, Clock
} from "lucide-react";
import { CoachPresence } from "@/components/CoachPresence";
import { TeacherAssignments } from "@/components/TeacherAssignments";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/TaskCard";
import { GamificationKPI } from "@/components/GamificationBar";
import { DailyMissions } from "@/components/GamificationBar";
import { SocialProofBanner } from "@/components/CelebrationOverlay";
import { QuickHelpButton, QuickHelpModal } from "@/components/QuickHelp";
import { shouldShowCheckin } from "@/pages/EmotionalCheckin";
import { getTasks, getActiveChildProfileId, getChildProfile, getMemoryItems, deleteTask, getGamification } from "@/lib/database";
import { isChildSession, clearChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

/** Score each pending task and return the best one with a reason */
function pickSmartTask(
  pendingTasks: any[],
  memoryItems: any[]
): { task: any; reason: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const subjectStrength: Record<string, { total: number; count: number }> = {};
  for (const m of memoryItems) {
    const s = m.subject?.toLowerCase();
    if (!s) continue;
    if (!subjectStrength[s]) subjectStrength[s] = { total: 0, count: 0 };
    subjectStrength[s].total += m.strength ?? 50;
    subjectStrength[s].count += 1;
  }
  const avgStrength = (subject: string): number | null => {
    const entry = subjectStrength[subject?.toLowerCase()];
    if (!entry || entry.count === 0) return null;
    return entry.total / entry.count;
  };

  let bestTask = pendingTasks[0];
  let bestScore = -Infinity;
  let bestReason = "";

  for (const task of pendingTasks) {
    let score = 0;
    let reason = "";

    if (task.due_date) {
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) { score += 100; reason = "Questo compito scade oggi!"; }
      else if (daysUntil === 1) { score += 80; reason = "Questo compito scade domani"; }
      else if (daysUntil <= 3) { score += 50; reason = `Scade tra ${daysUntil} giorni`; }
    }

    const strength = avgStrength(task.subject);
    if (strength !== null && strength < 40) {
      score += 60;
      if (!reason) reason = `Hai bisogno di rinforzare ${task.subject} — la tua memoria è al ${Math.round(strength)}%`;
      else reason += ` e hai bisogno di rinforzare ${task.subject}`;
    } else if (strength !== null && strength < 60) {
      score += 30;
      if (!reason) reason = `${task.subject} ha bisogno di un po' di pratica — memoria al ${Math.round(strength)}%`;
    }

    score += Math.max(0, 3 - (task.difficulty || 1)) * 5;
    if (!reason) reason = "Un buon punto di partenza per oggi";

    if (score > bestScore) { bestScore = score; bestTask = task; bestReason = reason; }
  }

  return { task: bestTask, reason: bestReason };
}

const DashboardAlunno = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<{ task: any; reason: string } | null>(null);
  const [pausedSession, setPausedSession] = useState<{ task: any; state: any } | null>(null);
  const [quickHelpOpen, setQuickHelpOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [gamification, setGamification] = useState<any>(null);
  const isChild = isChildSession();

  useEffect(() => {
    if (isChild && shouldShowCheckin()) {
      navigate("/checkin", { replace: true });
    }
  }, [isChild, navigate]);

  useEffect(() => {
    const profileId = getActiveChildProfileId();
    if (!profileId && !isChild) { navigate("/profiles"); return; }

    const load = async () => {
      if (isChild) {
        const session = getChildSession();
        if (session) setProfile(session.profile);
      } else {
        const p = await getChildProfile(profileId!);
        if (p) setProfile(p);
        else {
          const saved = localStorage.getItem("inschool-profile");
          if (saved) try { setProfile(JSON.parse(saved)); } catch {}
        }
      }

      const [dbTasks, memory, gam] = await Promise.all([
        getTasks(),
        getMemoryItems(),
        getGamification(),
      ]);
      setTasks(dbTasks);
      setMemoryItems(memory);
      setGamification(gam);

      // Detect paused focus session
      for (const t of dbTasks) {
        try {
          const saved = sessionStorage.getItem(`focus-session-${t.id}`);
          if (saved) {
            const state = JSON.parse(saved);
            if (state.phase === "focus" || state.phase === "checkin" || state.phase === "breathing") {
              setPausedSession({ task: t, state });
              break;
            }
          }
        } catch {}
      }

      // Smart suggestion
      const pending = dbTasks.filter((t: any) => !t.completed);
      if (pending.length > 0) {
        setSuggestion(pickSmartTask(pending, memory));
      }

      // Check library preference
      const pid = getChildSession()?.profileId || profileId;
      if (pid) {
        try {
          const { data: prefData } = await supabase
            .from("user_preferences").select("data").eq("profile_id", pid).maybeSingle();
          setShowLibrary(!!((prefData?.data as any)?.show_library));
        } catch {}
      }

      setLoading(false);
    };
    load();
  }, [navigate, isChild]);

  const handleChildLogout = () => {
    clearChildSession();
    navigate("/auth");
  };

  const name = profile?.name || "Studente";
  const avatarName = profile?.name || "S";
  const streak = gamification?.streak || 0;

  const completedThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return tasks.filter(t => t.completed && new Date(t.updated_at) >= weekAgo).length;
  }, [tasks]);

  const trainedSubjects = useMemo(() => {
    const subjects = new Set<string>();
    tasks.filter(t => t.completed).forEach(t => subjects.add(t.subject));
    return Array.from(subjects);
  }, [tasks]);

  const weakAreas = useMemo(() => {
    return [...new Set(
      memoryItems.filter(m => (m.strength ?? 50) < 40).slice(0, 3).map(m => m.subject)
    )];
  }, [memoryItems]);

  const pendingTasks = tasks.filter(t => !t.completed);

  const mapTask = (t: any) => ({
    id: t.id, subject: t.subject, title: t.title, description: t.description || "",
    estimatedMinutes: t.estimated_minutes || 15, difficulty: t.difficulty || 1,
    steps: Array.isArray(t.micro_steps) ? t.micro_steps.length : 0, completed: t.completed || false,
  });

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-8 font-sans">
      {/* ─── Header ─── */}
      <div className="bg-card border-b border-border px-4 sm:px-6 pt-5 sm:pt-6 pb-4 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg sm:text-xl font-semibold text-foreground">Inschool</span>
            </div>
            <div className="flex items-center gap-2">
              {showLibrary && (
                <button onClick={() => navigate("/libreria")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors" title="Libreria materiali"><FolderOpen className="w-4 h-4" /></button>
              )}
              <button onClick={() => navigate("/memory")} className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-accent-foreground hover:bg-accent/80 transition-colors" title="Memoria e ripasso"><Brain className="w-4 h-4" /></button>
              <button onClick={() => navigate("/student-profile")} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-accent transition-colors text-xs font-bold text-primary" title="Il mio profilo">
                {avatarName.charAt(0).toUpperCase()}
              </button>
              {isChild && (
                <button onClick={handleChildLogout} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors" title="Esci">
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mt-4">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Ciao {name}!</h1>
          </motion.div>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-4 mt-4">

          {/* ═══ A — Saluto azionabile del coach (AI-powered) ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <CoachPresence />
          </motion.div>

          {/* Paused session banner */}
          {pausedSession && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              className="bg-accent border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessione in pausa</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Stavi lavorando su <strong>{pausedSession.task.title}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pausedSession.task.subject}</p>
                </div>
                <Button onClick={() => navigate(`/focus/${pausedSession.task.id}`)} size="sm" className="rounded-xl flex-shrink-0">
                  <Play className="w-3.5 h-3.5 mr-1" /> Riprendi
                </Button>
              </div>
            </motion.div>
          )}

          {/* Smart suggestion */}
          {suggestion && !pausedSession && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 }}
              className="bg-primary/5 border border-primary/20 rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Consiglio del coach</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">Inizia con <strong>{suggestion.task.title}</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                </div>
                <Button onClick={() => navigate(`/homework/${suggestion.task.id}`)} size="sm" variant="default" className="rounded-xl flex-shrink-0">
                  Vedi <ArrowRight className="ml-1 w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══ B — Oggi: compiti + assegnazioni docente ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
            {/* Teacher Assignments */}
            <TeacherAssignments />

            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-foreground text-base sm:text-lg">Compiti di oggi</h2>
              <button onClick={() => navigate("/add-homework")} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Aggiungi
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm mb-3">Nessun compito ancora!</p>
                <Button onClick={() => navigate("/add-homework")} size="sm" className="rounded-xl">
                  <Plus className="w-4 h-4 mr-1" /> Aggiungi compiti
                </Button>
              </div>
            ) : (
              <div className="space-y-3">{tasks.map((task, i) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 + i * 0.06 }}>
                  <TaskCard task={mapTask(task)} onClick={() => navigate(`/homework/${task.id}`)} onDelete={async (taskId) => {
                    await deleteTask(taskId);
                    const dbTasks = await getTasks();
                    setTasks(dbTasks);
                  }} />
                </motion.div>
              ))}</div>
            )}
          </motion.div>

          {/* ═══ Missioni del giorno ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.14 }}>
            <DailyMissions />
          </motion.div>

          {/* ═══ C — Stato del percorso ═══ */}
          {!loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }}>
              <h2 className="font-display font-bold text-foreground text-base sm:text-lg mb-3">Il tuo percorso</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Flame className="w-3.5 h-3.5 text-destructive" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Giorni consecutivi</span>
                  </div>
                  <p className="font-display text-2xl font-bold text-foreground">{streak}</p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Completati questa settimana</span>
                  </div>
                  <p className="font-display text-2xl font-bold text-foreground">{completedThisWeek}</p>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                      <Star className="w-3.5 h-3.5 text-accent-foreground" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Materie allenate</span>
                  </div>
                  {trainedSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {trainedSubjects.map(s => (
                        <span key={s} className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nessuna ancora</p>
                  )}
                </div>

                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Da rinforzare</span>
                  </div>
                  {weakAreas.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {weakAreas.map(s => (
                        <span key={s} className="text-[10px] font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-md">{s}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Tutto bene!</p>
                  )}
                </div>
              </div>

              {/* KPI punti (existing component) */}
              <div className="mt-3">
                <GamificationKPI />
              </div>
            </motion.div>
          )}

          {/* ═══ D — Accesso rapido (3 voci) ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.22 }}>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  const first = pendingTasks[0];
                  if (first) navigate(`/focus/${first.id}`);
                  else navigate("/add-homework");
                }}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <Play className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Inizia</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Il primo compito</p>
              </button>

              <button
                onClick={() => navigate("/memory")}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Ripassa</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Memoria e quiz</p>
              </button>

              <button
                onClick={() => navigate("/challenge/new?prompt=aiuto-studio")}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Chiedi aiuto</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Parla col coach</p>
              </button>
            </div>
          </motion.div>

          {/* ═══ E — "Non so da dove iniziare" ═══ */}
          {pendingTasks.length > 0 && !pausedSession && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.26 }}>
              <button
                onClick={() => navigate("/challenge/help-start")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              >
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Non so da dove iniziare</p>
                  <p className="text-xs text-muted-foreground">Il coach ti aiuta a scegliere il primo passo</p>
                </div>
              </button>
            </motion.div>
          )}

        </div>
      </div>

      {/* FAB for desktop */}
      <div className="hidden sm:block fixed bottom-8 right-6 z-50">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate("/add-homework")} className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-hover flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>
      <QuickHelpModal open={quickHelpOpen} onClose={() => setQuickHelpOpen(false)} />
    </div>
  );
};

export default DashboardAlunno;
