import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, Plus, ArrowRight, Sparkles, Brain, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressSun } from "@/components/ProgressSun";
import { TaskCard } from "@/components/TaskCard";
import { GamificationBar, DailyMissions } from "@/components/GamificationBar";
import { mockTasks } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string }>({ name: "Studente" });

  useEffect(() => {
    const saved = localStorage.getItem("inschool-profile");
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch {}
    }
  }, []);

  const completedCount = mockTasks.filter((t) => t.completed).length;
  const totalMinutes = mockTasks.reduce((a, t) => a + t.estimatedMinutes, 0);
  const suggestedTask = mockTasks.find((t) => !t.completed && t.difficulty <= 2);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-semibold text-foreground">Inschool</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/memory")}
                className="w-9 h-9 rounded-xl bg-clay-light flex items-center justify-center text-clay-dark hover:bg-accent transition-colors"
                title="Memoria e ripasso"
              >
                <Brain className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
              >
                <span className="text-sm font-display font-bold">{profile.name.charAt(0).toUpperCase()}</span>
              </button>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">
              Ciao {profile.name}! 👋
            </h1>
            <p className="text-muted-foreground">Ecco i tuoi compiti di oggi. Da dove vuoi partire?</p>
          </motion.div>

          {/* Gamification bar */}
          <div className="mt-5">
            <GamificationBar />
          </div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="flex items-center gap-4 mt-4"
          >
            <div className="flex items-center gap-4 flex-1">
              <ProgressSun progress={completedCount / mockTasks.length} />
              <div>
                <p className="text-sm font-medium text-foreground">{completedCount}/{mockTasks.length} completati</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{totalMinutes} min totali
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Suggested start */}
      {suggestedTask && (
        <div className="px-6 -mt-4">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.2 }}
              className="bg-sage-light border border-primary/20 rounded-2xl p-5 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-sage-dark" />
                  <span className="text-xs font-medium text-sage-dark uppercase tracking-wider">Consiglio del coach</span>
                </div>
                <p className="text-sm text-foreground">
                  Inizia con <strong>{suggestedTask.title}</strong> — è un buon riscaldamento!
                </p>
              </div>
              <Button
                onClick={() => navigate(`/focus/${suggestedTask.id}`)}
                className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl px-4 py-2 text-sm flex-shrink-0"
              >
                Inizia con me
                <ArrowRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </motion.div>
          </div>
        </div>
      )}

      {/* Daily missions */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.25 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-clay-dark" />
              <h3 className="font-display font-semibold text-foreground text-sm">Missioni del giorno</h3>
            </div>
            <DailyMissions />
          </motion.div>
        </div>
      </div>

      {/* Task list */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground text-sm">Compiti di oggi</h3>
            <button
              onClick={() => navigate("/memory")}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              <Brain className="w-3 h-3" />
              Ripassa
            </button>
          </div>
          <div className="space-y-3">
            {mockTasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.3 + i * 0.08 }}
              >
                <TaskCard
                  task={task}
                  onClick={() => navigate(`/homework/${task.id}`)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Add homework FAB */}
      <div className="fixed bottom-6 right-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/add-homework")}
          className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-card flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  );
};

export default Dashboard;
