import { motion } from "framer-motion";
import { TrendingUp, Clock, Brain, Flame, Target, Zap } from "lucide-react";
import { ProgressSun } from "@/components/ProgressSun";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface ProgressCardProps {
  totalMinutes: number;
  totalSessions: number;
  gamification: any;
  schoolLevel?: string;
}

export const ProgressCard = ({ totalMinutes, totalSessions, gamification, schoolLevel = "superiori" }: ProgressCardProps) => {
  const autonomyPercent = gamification
    ? Math.min(100, Math.round(((gamification.autonomy_points || 0) / Math.max(1, (gamification.focus_points || 0) + (gamification.autonomy_points || 0))) * 100))
    : 0;

  const isUniversitario = schoolLevel === "universitario";
  const title = isUniversitario ? "Efficienza studio" : "Progressi generali";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-foreground text-sm">{title}</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Show autonomy for superiori+, hide for medie */}
        {schoolLevel !== "medie" && (
          <div className="text-center">
            <div className="flex justify-center mb-1.5">
              <ProgressSun progress={autonomyPercent / 100} size={36} />
            </div>
            <p className="font-display font-bold text-foreground text-sm">{autonomyPercent}%</p>
            <p className="text-[10px] text-muted-foreground">Autonomia</p>
          </div>
        )}
        <div className="text-center">
          <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-1.5">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <p className="font-display font-bold text-foreground text-sm">{totalMinutes}m</p>
          <p className="text-[10px] text-muted-foreground">Concentrazione</p>
        </div>
        <div className="text-center">
          <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-1.5">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <p className="font-display font-bold text-foreground text-sm">{totalSessions}</p>
          <p className="text-[10px] text-muted-foreground">Sessioni</p>
        </div>
        {/* For medie: show streak instead of autonomy */}
        {schoolLevel === "medie" && gamification && (
          <div className="text-center">
            <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-1.5">
              <Flame className="w-4 h-4 text-primary" />
            </div>
            <p className="font-display font-bold text-foreground text-sm">{gamification.streak || 0}</p>
            <p className="text-[10px] text-muted-foreground">Giorni di fila</p>
          </div>
        )}
      </div>

      {gamification && schoolLevel !== "medie" && (
        <div className="border-t border-border pt-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="flex flex-col items-center gap-1">
              <Target className="w-3.5 h-3.5 text-primary" />
              <p className="font-display font-bold text-foreground text-sm">{gamification.focus_points || 0}</p>
              <p className="text-[10px] text-muted-foreground">Concentrazione</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <p className="font-display font-bold text-foreground text-sm">{gamification.autonomy_points || 0}</p>
              <p className="text-[10px] text-muted-foreground">Autonomia</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-primary" />
              <p className="font-display font-bold text-foreground text-sm">{gamification.streak || 0}</p>
              <p className="text-[10px] text-muted-foreground">Costanza</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
