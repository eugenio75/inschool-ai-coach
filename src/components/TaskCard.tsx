import { motion } from "framer-motion";
import { Clock, Check, ArrowRight, BookOpen, PenLine } from "lucide-react";

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
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
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

export const TaskCard = ({ task, onClick }: TaskCardProps) => {
  const colorClass = subjectColors[task.subject] || "bg-muted text-muted-foreground";

  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl border transition-all ${
        task.completed
          ? "bg-muted/40 border-primary/20 opacity-70 hover:opacity-90"
          : "bg-card border-border shadow-soft hover:shadow-card"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colorClass}`}>
          {task.subject} • {task.estimatedMinutes} min
        </span>
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
        {task.completed ? (
          <div className="flex items-center gap-1 text-primary text-xs font-medium bg-primary/10 px-2 py-0.5 rounded-full">
            <Check className="w-3.5 h-3.5" />
            Fatto ✓
          </div>
        ) : (
          <div className="flex items-center gap-1 text-primary text-xs font-medium">
            Inizia
            <ArrowRight className="w-3 h-3" />
          </div>
        )}
      </div>
    </motion.button>
  );
};
