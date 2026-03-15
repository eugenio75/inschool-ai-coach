import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, Plus, ArrowRight, Camera, Type, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressSun } from "@/components/ProgressSun";
import { TaskCard } from "@/components/TaskCard";

const spring = { type: "spring", stiffness: 260, damping: 30 };

const mockTasks = [
  {
    id: "1",
    subject: "Matematica",
    title: "Frazioni: La Grande Divisione",
    description: "Esercizi pagina 45, numeri 1-5",
    estimatedMinutes: 15,
    difficulty: 2,
    steps: 3,
    completed: false,
  },
  {
    id: "2",
    subject: "Italiano",
    title: "Comprensione del testo",
    description: "Leggere il brano e rispondere alle domande",
    estimatedMinutes: 20,
    difficulty: 1,
    steps: 4,
    completed: false,
  },
  {
    id: "3",
    subject: "Scienze",
    title: "Il ciclo dell'acqua",
    description: "Studiare paragrafo 3 e fare lo schema",
    estimatedMinutes: 15,
    difficulty: 2,
    steps: 2,
    completed: true,
  },
  {
    id: "4",
    subject: "Storia",
    title: "I Romani: la Repubblica",
    description: "Riassunto pagine 78-82",
    estimatedMinutes: 25,
    difficulty: 3,
    steps: 5,
    completed: false,
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string }>({ name: "Studente" });
  const [showAddModal, setShowAddModal] = useState(false);

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
            <button
              onClick={() => navigate("/settings")}
              className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
            >
              <span className="text-sm font-display font-bold">{profile.name.charAt(0).toUpperCase()}</span>
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">
              Ciao {profile.name}! 👋
            </h1>
            <p className="text-muted-foreground">Ecco i tuoi compiti di oggi. Da dove vuoi partire?</p>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="flex items-center gap-4 mt-5"
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

      {/* Task list */}
      <div className="px-6 mt-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {mockTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.2 + i * 0.08 }}
            >
              <TaskCard
                task={task}
                onClick={() => navigate(`/focus/${task.id}`)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Add homework FAB */}
      <div className="fixed bottom-6 right-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-card flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Add homework modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="bg-card rounded-2xl shadow-hover border border-border p-6 w-full max-w-md"
          >
            <h3 className="font-display text-lg font-bold text-foreground mb-2">Aggiungi compiti</h3>
            <p className="text-sm text-muted-foreground mb-6">Come vuoi inserire i tuoi compiti?</p>

            <div className="space-y-3">
              <button className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-border hover:bg-muted transition-colors text-left">
                <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center">
                  <Type className="w-5 h-5 text-sage-dark" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Scrivi a mano</p>
                  <p className="text-xs text-muted-foreground">Descrivi il compito con parole tue</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-border hover:bg-muted transition-colors text-left">
                <div className="w-10 h-10 rounded-xl bg-clay-light flex items-center justify-center">
                  <Camera className="w-5 h-5 text-clay-dark" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Fotografa il diario</p>
                  <p className="text-xs text-muted-foreground">Scatta una foto dei compiti scritti</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-border hover:bg-muted transition-colors text-left">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Fotografa il libro</p>
                  <p className="text-xs text-muted-foreground">Scatta una foto delle pagine da studiare</p>
                </div>
              </button>
            </div>

            <Button
              variant="ghost"
              onClick={() => setShowAddModal(false)}
              className="w-full mt-4 text-muted-foreground"
            >
              Annulla
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
