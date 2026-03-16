import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, BookOpen, Brain, Lightbulb, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTask, updateTask } from "@/lib/database";
import { subjectColors } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const HomeworkDetail = () => {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showHint, setShowHint] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!taskId) return;
      const t = await getTask(taskId);
      if (t) {
        setTask(t);
        const steps = Array.isArray(t.micro_steps) ? t.micro_steps : [];
        setCompletedSteps(steps.filter((s: any) => s.done).map((s: any) => s.id));
      }
      setLoading(false);
    };
    load();
  }, [taskId]);

  const toggleStep = async (stepId: string) => {
    const newCompleted = completedSteps.includes(stepId)
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId];
    setCompletedSteps(newCompleted);

    // Update micro_steps in DB
    if (task?.micro_steps) {
      const updatedSteps = task.micro_steps.map((s: any) => ({
        ...s,
        done: newCompleted.includes(s.id),
      }));
      await updateTask(task.id, { micro_steps: updatedSteps });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Compito non trovato</p>
        <Button onClick={() => navigate("/dashboard")} variant="outline">Torna alla dashboard</Button>
      </div>
    );
  }

  const colors = subjectColors[task.subject] || subjectColors.Matematica;
  const microSteps = Array.isArray(task.micro_steps) ? task.micro_steps : [];
  const keyConcepts = Array.isArray(task.key_concepts) ? task.key_concepts : [];
  const recallQuestions = Array.isArray(task.recall_questions) ? task.recall_questions : [];
  const progress = microSteps.length > 0 ? completedSteps.length / microSteps.length : 0;

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colors.badge}`}>{task.subject}</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{task.title}</h1>
          <p className="text-muted-foreground">{task.description}</p>

          {microSteps.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{completedSteps.length}/{microSteps.length} passi completati</span>
                <span className="text-xs font-medium text-foreground">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress * 100}%` }} transition={spring} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Micro-steps */}
      {microSteps.length > 0 && (
        <div className="px-6 mt-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-sage-dark" />
              <h2 className="font-display font-semibold text-foreground">Micro-passi</h2>
            </div>
            <div className="space-y-3">
              {microSteps.map((step: any, i: number) => {
                const done = completedSteps.includes(step.id);
                return (
                  <motion.div key={step.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.06 }}>
                    <div className={`rounded-2xl border transition-all ${done ? "bg-sage-light/30 border-primary/20" : "bg-card border-border shadow-soft"}`}>
                      <button onClick={() => toggleStep(step.id)} className="w-full flex items-start gap-3 p-4 text-left">
                        <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${done ? "bg-primary" : "border-2 border-border"}`}>
                          {done && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{step.text}</p>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
                      </button>
                      {step.hint && !done && (
                        <div className="px-4 pb-3">
                          <button onClick={() => setShowHint(showHint === step.id ? null : step.id)} className="flex items-center gap-1.5 text-xs text-clay-dark hover:text-foreground transition-colors">
                            <Lightbulb className="w-3 h-3" />
                            {showHint === step.id ? "Nascondi indizio" : "Mostra indizio"}
                          </button>
                          {showHint === step.id && (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-xs text-clay-dark bg-clay-light/50 rounded-xl px-3 py-2 mt-2">
                              💡 {step.hint}
                            </motion.p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Key concepts */}
      {keyConcepts.length > 0 && (
        <div className="px-6 mt-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-clay-dark" />
              <h2 className="font-display font-semibold text-foreground">Concetti chiave</h2>
            </div>
            <div className="space-y-2">
              {keyConcepts.map((concept: string, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.3 + i * 0.06 }} className="bg-card rounded-xl border border-border px-4 py-3 shadow-soft">
                  <p className="text-sm text-foreground">{concept}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recall questions */}
      {recallQuestions.length > 0 && (
        <div className="px-6 mt-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-terracotta" />
              <h2 className="font-display font-semibold text-foreground">Domande di ripasso</h2>
            </div>
            <div className="space-y-2">
              {recallQuestions.map((q: string, i: number) => (
                <div key={i} className="bg-terracotta-light/50 rounded-xl px-4 py-3 border border-terracotta/10">
                  <p className="text-sm text-foreground">❓ {q}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {task.completed ? (
            <>
              <Button onClick={() => navigate("/memory")} variant="outline" className="flex-1 rounded-2xl py-5 text-base border-border">
                <Brain className="w-4 h-4 mr-2" /> Memoria e Ripasso
              </Button>
              <Button onClick={() => navigate(`/focus/${task.id}`)} variant="outline" className="flex-1 rounded-2xl py-5 text-base border-border">
                <Play className="w-4 h-4 mr-2" /> Ripeti sessione
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate(`/focus/${task.id}`)} className="flex-1 bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base">
              <Play className="w-4 h-4 mr-2" /> Inizia sessione di focus
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeworkDetail;
