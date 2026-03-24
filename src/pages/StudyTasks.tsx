import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/TaskCard";
import { CoachPresence } from "@/components/CoachPresence";
import { TeacherAssignments } from "@/components/TeacherAssignments";
import { getTasks, deleteTask } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const StudyTasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const dbTasks = await getTasks();
      setTasks(dbTasks);
      setLoading(false);
    };
    load();
  }, []);

  const mapTask = (t: any) => ({
    id: t.id, subject: t.subject, title: t.title, description: t.description || "",
    estimatedMinutes: t.estimated_minutes || 15, difficulty: t.difficulty || 1,
    steps: Array.isArray(t.micro_steps) ? t.micro_steps.length : 0, completed: t.completed || false,
  });

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-8 font-sans">
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

          {/* Coach AI */}
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

      {/* Task list */}
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
              {tasks.map((task, i) => (
                <motion.div key={task.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.06 }}>
                  <TaskCard
                    task={mapTask(task)}
                    onClick={() => navigate(`/us?type=guided&hw=${task.id}`)}
                    onDelete={async (taskId) => {
                      await deleteTask(taskId);
                      const dbTasks = await getTasks();
                      setTasks(dbTasks);
                    }}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyTasks;
