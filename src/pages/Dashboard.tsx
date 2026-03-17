import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, Plus, ArrowRight, Sparkles, Brain, Target, Loader2, LogOut, Play, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressSun } from "@/components/ProgressSun";
import { TaskCard } from "@/components/TaskCard";
import { GamificationBar, DailyMissions } from "@/components/GamificationBar";
import { SocialProofBanner } from "@/components/CelebrationOverlay";
import { QuickHelpButton, QuickHelpModal } from "@/components/QuickHelp";
import { shouldShowCheckin } from "@/pages/EmotionalCheckin";
import { getTasks, getActiveChildProfileId, getChildProfile, getMemoryItems, deleteTask } from "@/lib/database";
import { isChildSession, clearChildSession, getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

/** Score each pending task and return the best one with a reason */
function pickSmartTask(
  pendingTasks: any[],
  memoryItems: any[]
): { task: any; reason: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a map: subject → average memory strength
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

    // 1. Due date urgency (highest priority)
    if (task.due_date) {
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 0) {
        score += 100;
        reason = "Questo compito scade oggi!";
      } else if (daysUntil === 1) {
        score += 80;
        reason = "Questo compito scade domani";
      } else if (daysUntil <= 3) {
        score += 50;
        reason = `Scade tra ${daysUntil} giorni`;
      }
    }

    // 2. Weak memory in this subject
    const strength = avgStrength(task.subject);
    if (strength !== null && strength < 40) {
      score += 60;
      if (!reason) reason = `Hai bisogno di rinforzare ${task.subject} — la tua memoria è al ${Math.round(strength)}%`;
      else reason += ` e hai bisogno di rinforzare ${task.subject}`;
    } else if (strength !== null && strength < 60) {
      score += 30;
      if (!reason) reason = `${task.subject} ha bisogno di un po' di pratica — memoria al ${Math.round(strength)}%`;
    }

    // 3. Fallback: prefer easier tasks slightly (lower friction to start)
    score += Math.max(0, 3 - (task.difficulty || 1)) * 5;

    if (!reason) {
      reason = "Un buon punto di partenza per oggi";
    }

    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
      bestReason = reason;
    }
  }

  return { task: bestTask, reason: bestReason };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<{ task: any; reason: string } | null>(null);
  const [pausedSession, setPausedSession] = useState<{ task: any; state: any } | null>(null);
  const [quickHelpOpen, setQuickHelpOpen] = useState(false);
  const isChild = isChildSession();

  // Redirect to check-in if not done today (only for child sessions)
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
      const dbTasks = await getTasks();
      setTasks(dbTasks);

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
        const memoryItems = await getMemoryItems();
        setSuggestion(pickSmartTask(pending, memoryItems));
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
  const avatar = profile?.avatar_emoji || profile?.avatarEmoji || "🧒";
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalMinutes = tasks.reduce((a: number, t: any) => a + (t.estimated_minutes || 0), 0);

  const mapTask = (t: any) => ({
    id: t.id, subject: t.subject, title: t.title, description: t.description || "",
    estimatedMinutes: t.estimated_minutes || 15, difficulty: t.difficulty || 1,
    steps: Array.isArray(t.micro_steps) ? t.micro_steps.length : 0, completed: t.completed || false,
  });

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-8">
      <div className="bg-card border-b border-border px-4 sm:px-6 pt-5 sm:pt-6 pb-6 sm:pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg sm:text-xl font-semibold text-foreground">Inschool</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/memory")} className="w-9 h-9 rounded-xl bg-clay-light flex items-center justify-center text-clay-dark hover:bg-accent transition-colors" title="Memoria e ripasso"><Brain className="w-4 h-4" /></button>
              <button onClick={() => navigate("/student-profile")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors" title="Il mio profilo">
                <span className="text-lg">{avatar}</span>
              </button>
              {isChild && (
                <button onClick={handleChildLogout} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors" title="Esci">
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-1">Ciao {name}! 👋</h1>
                <p className="text-sm sm:text-base text-muted-foreground">{tasks.length > 0 ? "Ecco i tuoi compiti. Da dove vuoi partire?" : "Non ci sono compiti per oggi! 🎉"}</p>
              </div>
              {isChild && <QuickHelpButton onClick={() => setQuickHelpOpen(true)} />}
            </div>
          </motion.div>

          <div className="mt-5 space-y-3">
            <GamificationBar />
            <SocialProofBanner />
          </div>

          {!loading && tasks.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-4 flex-1">
                <ProgressSun progress={tasks.length > 0 ? completedCount / tasks.length : 0} />
                <div>
                  <p className="text-sm font-medium text-foreground">{completedCount}/{tasks.length} completati</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />~{totalMinutes} min</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Paused session banner */}
      {pausedSession && (
        <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="bg-clay-light border border-clay-dark/20 rounded-2xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-clay-dark animate-pulse" />
                  <span className="text-xs font-medium text-clay-dark uppercase tracking-wider">Sessione in pausa</span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  Stavi lavorando su <strong>{pausedSession.task.title}</strong>
                </p>
                <p className="text-xs text-clay-dark/80 mt-0.5">{pausedSession.task.subject}</p>
              </div>
              <Button
                onClick={() => navigate(`/focus/${pausedSession.task.id}`)}
                className="bg-clay-dark text-white hover:bg-clay-dark/90 rounded-xl px-3 sm:px-4 py-2 text-sm flex-shrink-0"
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Riprendi
              </Button>
            </div>
          </motion.div>
        </div></div>
      )}

      {suggestion && !pausedSession && (
        <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="bg-sage-light border border-primary/20 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <span className="text-xs font-medium text-sage-dark uppercase tracking-wider">Consiglio del coach</span>
                </div>
                <p className="text-sm font-medium text-foreground">Inizia con <strong>{suggestion.task.title}</strong></p>
                <p className="text-xs text-sage-dark/80 mt-1">{suggestion.reason}</p>
              </div>
              <Button onClick={() => navigate(`/homework/${suggestion.task.id}`)} className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl px-3 sm:px-4 py-2 text-sm flex-shrink-0">
                Vedi <ArrowRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        </div></div>
      )}

      <div className="px-4 sm:px-6 mt-5 sm:mt-6"><div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }}>
          <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-clay-dark" /><h3 className="font-display font-semibold text-foreground text-sm">Missioni del giorno</h3></div>
          <DailyMissions />
        </motion.div>
      </div></div>

      <div className="px-4 sm:px-6 mt-5 sm:mt-6 pb-4"><div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-foreground text-sm">Compiti di oggi</h3>
          <button onClick={() => navigate("/memory")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><Brain className="w-3 h-3" /> Ripassa</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : tasks.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"><BookOpen className="w-7 h-7 text-muted-foreground" /></div>
            <p className="text-muted-foreground mb-4">Nessun compito ancora!</p>
            <Button onClick={() => navigate("/add-homework")} className="bg-primary text-primary-foreground rounded-2xl"><Plus className="w-4 h-4 mr-2" /> Aggiungi compiti</Button>
          </motion.div>
        ) : (
          <div className="space-y-3">{tasks.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 + i * 0.08 }}>
              <TaskCard task={mapTask(task)} onClick={() => navigate(`/homework/${task.id}`)} onDelete={async (taskId) => {
                await deleteTask(taskId);
                setTasks((prev) => prev.filter((t) => t.id !== taskId));
              }} />
            </motion.div>
          ))}</div>
        )}
      </div></div>

      {/* FAB for desktop (mobile uses BottomNav) */}
      <div className="hidden sm:block fixed bottom-8 right-6 z-50">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate("/add-homework")} className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-hover flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>
      <QuickHelpModal open={quickHelpOpen} onClose={() => setQuickHelpOpen(false)} />
    </div>
  );
};

export default Dashboard;
