import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Plus, ArrowRight, Brain, Loader2, LogOut, Play,
  MessageSquare, Flame, Star, Zap, Target, FolderOpen, Send,
  Clock, CheckCircle2, AlertTriangle, FileText, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/TaskCard";
import { DailyMissions } from "@/components/GamificationBar";
import { shouldShowCheckin } from "@/pages/EmotionalCheckin";
import { getTasks, getActiveChildProfileId, getChildProfile, getMemoryItems, deleteTask, getGamification } from "@/lib/database";
import { isChildSession, clearChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// ─── Types ───
interface TodayItem {
  id: string;
  type: "task" | "teacher" | "review";
  subject: string;
  title: string;
  dueDate?: string;
  status: "da_fare" | "in_corso" | "completato";
  priority: number; // higher = more urgent
  raw: any;
}

// ─── Smart prioritization ───
function buildTodayList(
  tasks: any[],
  teacherAssignments: any[],
  memoryItems: any[]
): TodayItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items: TodayItem[] = [];

  // Tasks
  for (const t of tasks) {
    let priority = 10;
    if (t.due_date) {
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      if (days <= 0) priority = 100;
      else if (days === 1) priority = 80;
      else if (days <= 3) priority = 50;
    }
    // Boost weak subjects
    const weakSubject = memoryItems.find(m => m.subject?.toLowerCase() === t.subject?.toLowerCase() && (m.strength ?? 50) < 40);
    if (weakSubject) priority += 30;

    items.push({
      id: t.id,
      type: "task",
      subject: t.subject,
      title: t.title,
      dueDate: t.due_date,
      status: t.completed ? "completato" : "da_fare",
      priority,
      raw: t,
    });
  }

  // Teacher assignments
  for (const a of teacherAssignments) {
    items.push({
      id: a.id,
      type: "teacher",
      subject: a.subject || "",
      title: a.title,
      dueDate: a.due_date,
      status: a.metadata?.status === "completed" ? "completato" : "da_fare",
      priority: 70, // teacher assignments are high priority
      raw: a,
    });
  }

  // Weak memory items → suggested reviews (top 2)
  const weakItems = memoryItems.filter(m => (m.strength ?? 50) < 40).slice(0, 2);
  for (const m of weakItems) {
    items.push({
      id: `review-${m.id}`,
      type: "review",
      subject: m.subject,
      title: `Ripassa: ${m.concept}`,
      status: "da_fare",
      priority: 35,
      raw: m,
    });
  }

  // Sort: incomplete first (by priority desc), then completed
  return items.sort((a, b) => {
    if (a.status === "completato" && b.status !== "completato") return 1;
    if (a.status !== "completato" && b.status === "completato") return -1;
    return b.priority - a.priority;
  });
}

// ─── Coach greeting logic ───
function getCoachGreeting(
  name: string,
  tasks: any[],
  lastSession: any,
  streak: number,
  teacherAssignments: any[]
): { text: string; actionLabel?: string; actionRoute?: string } {
  const pending = tasks.filter(t => !t.completed);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check for upcoming tests
  const urgentTask = pending.find(t => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    return days <= 1 && t.subject;
  });

  // Unopened teacher assignments
  const newTeacher = teacherAssignments.filter(a => a.metadata?.status !== "opened");

  if (urgentTask) {
    const isDueToday = (() => {
      const d = new Date(urgentTask.due_date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    })();
    return {
      text: isDueToday
        ? `Oggi scade "${urgentTask.title}" di ${urgentTask.subject}. Vuoi iniziare da lì?`
        : `Domani hai scadenza su ${urgentTask.subject}. Vuoi fare un ripasso adesso?`,
      actionLabel: "Inizia",
      actionRoute: `/homework/${urgentTask.id}`,
    };
  }

  if (newTeacher.length > 0) {
    return {
      text: `Il tuo professore ha assegnato ${newTeacher.length === 1 ? "qualcosa di nuovo" : `${newTeacher.length} cose nuove`}. Lo vediamo insieme?`,
    };
  }

  if (streak === 0 || streak === undefined) {
    return { text: `Bentornato ${name}. Partiamo da un passo piccolo, non da tutto.` };
  }

  if (pending.length === 0) {
    return { text: `Ottimo lavoro ${name}! Non hai compiti in sospeso. Vuoi ripassare qualcosa?` };
  }

  if (pending.length <= 2) {
    return {
      text: `Oggi hai ${pending.length} ${pending.length === 1 ? "cosa" : "cose"}. Ti aiuto a partire dalla più gestibile.`,
      actionLabel: "Inizia",
      actionRoute: `/homework/${pending[0].id}`,
    };
  }

  return {
    text: `Hai ${pending.length} compiti in programma. Ti aiuto a partire dalla più gestibile.`,
    actionLabel: "Inizia",
    actionRoute: `/homework/${pending[0].id}`,
  };
}

const DashboardAlunno = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [gamification, setGamification] = useState<any>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pausedSession, setPausedSession] = useState<{ task: any; state: any } | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [coachInput, setCoachInput] = useState("");
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
      // Load profile
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

      // Parallel data loading
      const [dbTasks, memory, gam] = await Promise.all([
        getTasks(),
        getMemoryItems(),
        getGamification(),
      ]);
      setTasks(dbTasks);
      setMemoryItems(memory);
      setGamification(gam);

      // Teacher assignments
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ta } = await supabase
          .from("teacher_assignments")
          .select("*")
          .eq("student_id", user.id)
          .order("assigned_at", { ascending: false });
        setTeacherAssignments(ta || []);
      }

      // Paused session detection
      for (const t of dbTasks) {
        try {
          const saved = sessionStorage.getItem(`focus-session-${t.id}`);
          if (saved) {
            const state = JSON.parse(saved);
            if (["focus", "checkin", "breathing"].includes(state.phase)) {
              setPausedSession({ task: t, state });
              break;
            }
          }
        } catch {}
      }

      // Library preference
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

  const handleCoachSend = () => {
    if (!coachInput.trim()) return;
    navigate(`/challenge/new?msg=${encodeURIComponent(coachInput)}`);
  };

  const name = profile?.name || "Studente";
  const avatarName = profile?.name || "S";
  const streak = gamification?.streak || 0;

  const todayList = useMemo(
    () => buildTodayList(tasks, teacherAssignments, memoryItems),
    [tasks, teacherAssignments, memoryItems]
  );

  const pendingCount = todayList.filter(i => i.status !== "completato").length;
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
    return memoryItems
      .filter(m => (m.strength ?? 50) < 40)
      .slice(0, 3)
      .map(m => m.subject);
  }, [memoryItems]);

  const greeting = useMemo(
    () => getCoachGreeting(name, tasks, null, streak, teacherAssignments),
    [name, tasks, streak, teacherAssignments]
  );

  const mapTask = (t: any) => ({
    id: t.id, subject: t.subject, title: t.title, description: t.description || "",
    estimatedMinutes: t.estimated_minutes || 15, difficulty: t.difficulty || 1,
    steps: Array.isArray(t.micro_steps) ? t.micro_steps.length : 0, completed: t.completed || false,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-8 font-sans">
      {/* ─── Header ─── */}
      <div className="bg-card border-b border-border px-4 sm:px-6 pt-5 pb-4 shadow-sm">
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
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-4 mt-4">

          {/* ═══ A — Saluto azionabile del coach ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base text-foreground leading-relaxed font-medium">
                    {greeting.text}
                  </p>
                  {greeting.actionLabel && greeting.actionRoute && (
                    <button
                      onClick={() => navigate(greeting.actionRoute!)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {greeting.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {/* Inline chat input */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCoachSend()}
                    placeholder="Scrivi al coach..."
                    className="flex-1 text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-muted/50"
                  />
                  <button onClick={handleCoachSend} disabled={!coachInput.trim()} className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-3 py-2 rounded-lg transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Paused session banner */}
          {pausedSession && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              className="bg-accent border border-accent-foreground/10 rounded-xl p-4"
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
                </div>
                <Button onClick={() => navigate(`/focus/${pausedSession.task.id}`)} size="sm" className="rounded-xl flex-shrink-0">
                  <Play className="w-3.5 h-3.5 mr-1" /> Riprendi
                </Button>
              </div>
            </motion.div>
          )}

          {/* ═══ B — Oggi ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-foreground text-base sm:text-lg">Oggi</h2>
              <button onClick={() => navigate("/add-homework")} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Aggiungi
              </button>
            </div>

            {todayList.length === 0 ? (
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
              <div className="space-y-2">
                {todayList.map((item, i) => (
                  <TodayItemCard key={item.id} item={item} index={i} navigate={navigate} onDeleteTask={async (taskId) => {
                    await deleteTask(taskId);
                    const dbTasks = await getTasks();
                    setTasks(dbTasks);
                  }} />
                ))}
              </div>
            )}
          </motion.div>

          {/* ═══ Missioni del giorno ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }}>
            <DailyMissions />
          </motion.div>

          {/* ═══ C — Stato del percorso ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }}>
            <h2 className="font-display font-bold text-foreground text-base sm:text-lg mb-3">Il tuo percorso</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Flame} iconBg="bg-destructive/10" iconColor="text-destructive" label="Giorni consecutivi" value={streak} />
              <StatCard icon={CheckCircle2} iconBg="bg-primary/10" iconColor="text-primary" label="Completati questa settimana" value={completedThisWeek} />
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
                    {[...new Set(weakAreas)].map(s => (
                      <span key={s} className="text-[10px] font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-md">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Tutto bene!</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* ═══ D — Accesso rapido (3 voci) ═══ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.24 }}>
            <div className="grid grid-cols-3 gap-3">
              <QuickAccessButton
                icon={Play}
                label="Inizia"
                desc="Il primo compito"
                onClick={() => {
                  const firstPending = todayList.find(i => i.status !== "completato" && i.type === "task");
                  if (firstPending) navigate(`/focus/${firstPending.id}`);
                  else navigate("/add-homework");
                }}
              />
              <QuickAccessButton
                icon={Brain}
                label="Ripassa"
                desc="Memoria e quiz"
                onClick={() => navigate("/memory")}
              />
              <QuickAccessButton
                icon={MessageSquare}
                label="Chiedi aiuto"
                desc="Parla col coach"
                onClick={() => navigate("/challenge/new?prompt=aiuto-studio")}
              />
            </div>
          </motion.div>

          {/* ═══ E — "Non so da dove iniziare" ═══ */}
          {pendingCount > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }}>
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
    </div>
  );
};

// ─── Sub-components ───

function StatCard({ icon: Icon, iconBg, iconColor, label, value }: {
  icon: any; iconBg: string; iconColor: string; label: string; value: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function QuickAccessButton({ icon: Icon, label, desc, onClick }: {
  icon: any; label: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/30 hover:shadow-md transition-all text-left group"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}

const statusConfig = {
  da_fare: { label: "Da fare", className: "bg-muted text-muted-foreground" },
  in_corso: { label: "In corso", className: "bg-primary/10 text-primary" },
  completato: { label: "Completato", className: "bg-primary/20 text-primary" },
} as const;

function TodayItemCard({ item, index, navigate, onDeleteTask }: {
  item: TodayItem; index: number; navigate: (path: string) => void; onDeleteTask: (id: string) => void;
}) {
  const status = statusConfig[item.status];
  const isTeacher = item.type === "teacher";
  const isReview = item.type === "review";

  const handleClick = () => {
    if (isTeacher) navigate(`/session/${item.id}`);
    else if (isReview) navigate("/memory");
    else navigate(`/homework/${item.id}`);
  };

  // Format due date
  const dueDateLabel = item.dueDate ? (() => {
    const d = new Date(item.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (days < 0) return null; // past due, don't show
    if (days === 0) return "Oggi";
    if (days === 1) return "Domani";
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  })() : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.08 + index * 0.04 }}
      onClick={handleClick}
      className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-sm ${
        item.status === "completato"
          ? "bg-muted/40 border-border opacity-70"
          : isTeacher
            ? "bg-card border-l-4 border-l-accent-foreground border-border"
            : "bg-card border-border hover:border-primary/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.subject && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.subject}</span>
            )}
            {isTeacher && (
              <span className="text-[10px] font-semibold bg-accent text-accent-foreground px-1.5 py-0.5 rounded">Docente</span>
            )}
            {isReview && (
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">Ripasso</span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${status.className}`}>{status.label}</span>
          </div>
          <p className={`text-sm font-medium truncate ${item.status === "completato" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {item.title}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dueDateLabel && (
            <span className={`text-[10px] font-medium ${dueDateLabel === "Oggi" ? "text-destructive" : "text-muted-foreground"}`}>
              {dueDateLabel}
            </span>
          )}
          {item.status !== "completato" && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
          {item.status === "completato" && <CheckCircle2 className="w-4 h-4 text-primary" />}
        </div>
      </div>
    </motion.button>
  );
}

export default DashboardAlunno;
