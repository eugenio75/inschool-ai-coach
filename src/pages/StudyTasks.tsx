import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Loader2, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/TaskCard";
import { CoachPresence } from "@/components/CoachPresence";
import { TeacherAssignments } from "@/components/TeacherAssignments";
import { getTasks, deleteTask } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const subjectEmojis: Record<string, string> = {
  Matematica: "📐", Italiano: "📖", Scienze: "🔬", Storia: "🏛️",
  Geografia: "🌍", Inglese: "🇬🇧", Fisica: "⚡", Chimica: "🧪",
  Filosofia: "💭", Arte: "🎨", Musica: "🎵", Educazione_Fisica: "⚽",
  Informatica: "💻", Latino: "📜", Greco: "🏺",
};

const subjectBgColors: Record<string, string> = {
  Matematica: "bg-sage-light/50 border-sage/30",
  Italiano: "bg-clay-light/50 border-clay/30",
  Scienze: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40",
  Storia: "bg-terracotta-light/50 border-terracotta/30",
  Inglese: "bg-sage-light/50 border-sage/30",
};

const StudyTasks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Map homework_id → session status ("paused" | "active")
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const dbTasks = await getTasks();
      setTasks(dbTasks);

      // Fetch all paused/active sessions in one query
      try {
        const isChild = isChildSession();
        const userId = isChild ? getChildSession()?.profileId : user?.id;
        if (userId) {
          const { data: sessions } = await supabase
            .from("guided_sessions")
            .select("homework_id, status")
            .eq("user_id", userId)
            .in("status", ["paused", "active"])
            .order("updated_at", { ascending: false });

          if (sessions) {
            const map: Record<string, string> = {};
            for (const s of sessions) {
              if (s.homework_id && !map[s.homework_id]) {
                map[s.homework_id] = s.status!;
              }
            }
            setSessionStatuses(map);
          }
        }
      } catch (err) {
        console.error("Failed to fetch session statuses:", err);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const groupedBySubject = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const t of tasks) {
      const subj = t.subject || "Altro";
      if (!groups[subj]) groups[subj] = [];
      groups[subj].push(t);
    }
    // Sort subjects alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const toggleSubject = (subject: string) => {
    setCollapsed((prev) => ({ ...prev, [subject]: !prev[subject] }));
  };

  const mapTask = (t: any) => ({
    id: t.id, subject: t.subject, title: t.title, description: t.description || "",
    estimatedMinutes: t.estimated_minutes || 15, difficulty: t.difficulty || 1,
    steps: Array.isArray(t.micro_steps) ? t.micro_steps.length : 0, completed: t.completed || false,
    sessionStatus: sessionStatuses[t.id] as "paused" | "active" | undefined || null,
  });

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    const dbTasks = await getTasks();
    setTasks(dbTasks);
  };

  return (
    <div className="min-h-screen-safe bg-background pb-28 sm:pb-8 font-sans">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 sm:px-6 pt-5 pb-4 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/dashboard")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-foreground">I miei compiti</h1>
              <p className="text-xs text-muted-foreground">Scegli un compito e il coach ti guida passo passo</p>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <CoachPresence />
          </motion.div>
        </div>
      </div>

      {/* Teacher Assignments */}
      <div className="px-4 sm:px-6 mt-4">
        <div className="max-w-3xl mx-auto">
          <TeacherAssignments />
        </div>
      </div>

      {/* Task list grouped by subject */}
      <div className="px-4 sm:px-6 mt-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground text-sm">Compiti inseriti</h3>
            <Button onClick={() => navigate("/add-homework")} variant="outline" size="sm" className="rounded-xl text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Aggiungi
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">Nessun compito ancora!</p>
              <Button onClick={() => navigate("/add-homework")} className="bg-primary text-primary-foreground rounded-2xl">
                <Plus className="w-4 h-4 mr-2" /> Aggiungi compiti
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {groupedBySubject.map(([subject, subjectTasks], gi) => {
                const isCollapsed = collapsed[subject];
                const emoji = subjectEmojis[subject] || "📚";
                const bgClass = subjectBgColors[subject] || "bg-muted/40 border-border";
                const pendingCount = subjectTasks.filter((t: any) => !t.completed).length;

                return (
                  <motion.div
                    key={subject}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: gi * 0.06 }}
                    className={`rounded-2xl border ${bgClass} overflow-hidden`}
                  >
                    {/* Subject header */}
                    <button
                      onClick={() => toggleSubject(subject)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{emoji}</span>
                        <span className="font-display font-semibold text-foreground text-sm">{subject}</span>
                        <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">
                          {pendingCount > 0 ? `${pendingCount} da fare` : "✓ Tutti fatti"}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                    </button>

                    {/* Tasks inside */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-2">
                            {subjectTasks.map((task: any) => (
                              <TaskCard
                                key={task.id}
                                task={mapTask(task)}
                                onClick={() => navigate(`/us?type=guided&hw=${task.id}`)}
                                onDelete={handleDelete}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyTasks;
