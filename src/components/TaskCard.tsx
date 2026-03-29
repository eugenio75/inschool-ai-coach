import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Check, ArrowRight, BookOpen, PenLine, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Task {
  id: string;
  subject: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: number;
  steps: number;
  completed: boolean;
  task_type?: string;
  sessionStatus?: "paused" | "active" | null;
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDelete?: (taskId: string) => void;
}

const DifficultyDots = ({ level }: { level: number }) => (
  <div className="flex gap-1">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className={`w-1.5 h-1.5 rounded-full ${
          i <= level ? "bg-clay" : "bg-border"
        }`}
      />
    ))}
  </div>
);

const subjectColors: Record<string, string> = {
  Matematica: "bg-sage-light text-sage-dark",
  Italiano: "bg-clay-light text-clay-dark",
  Scienze: "bg-accent text-accent-foreground",
  Storia: "bg-terracotta-light text-terracotta",
  Geografia: "bg-muted text-muted-foreground",
  Inglese: "bg-sage-light text-sage-dark",
};

export const TaskCard = ({ task, onClick, onDelete }: TaskCardProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const colorClass = subjectColors[task.subject] || "bg-muted text-muted-foreground";
  const isStudy = task.task_type === "study";

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        className={`relative w-full text-left p-5 rounded-2xl border transition-all ${
          task.completed
            ? "bg-muted/40 border-primary/20 opacity-70 hover:opacity-90"
            : "bg-card border-border shadow-soft hover:shadow-card"
        }`}
      >
        {/* Delete button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm(true);
            }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors z-10"
            aria-label="Elimina compito"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button onClick={onClick} className="w-full text-left">
          <div className="flex items-start justify-between mb-3 pr-6">
            <div className="flex items-center gap-2">
              {isStudy && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground">
                  <BookOpen className="w-3 h-3" /> Studio
                </span>
              )}
              {!isStudy && task.task_type === "exercise" && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-clay-light text-clay-dark">
                  <PenLine className="w-3 h-3" /> Esercizio
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colorClass}`}>
                {task.subject} • {task.estimatedMinutes} min
              </span>
            </div>
            <DifficultyDots level={task.difficulty} />
          </div>

          <h3 className={`font-display text-lg font-medium mb-1 ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">{task.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {task.completed ? "Completato" : `${task.steps} passi da fare`}
            </div>
            <div className="flex items-center gap-2">
              {task.sessionStatus === "paused" && !task.completed && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  ⏸ In pausa
                </span>
              )}
              {task.sessionStatus === "active" && !task.completed && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                  ▶ In corso
                </span>
              )}
              {task.completed ? (
                <div className="flex items-center gap-1 text-primary text-xs font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                  <Check className="w-3.5 h-3.5" />
                  Fatto
                </div>
              ) : (
                <div className="flex items-center gap-1 text-primary text-xs font-medium">
                  {task.sessionStatus === "paused" ? "Riprendi" : "Inizia"}
                  <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        </button>
      </motion.div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo compito?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare "{task.title}". Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete?.(task.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
