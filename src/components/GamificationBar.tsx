import { motion } from "framer-motion";
import { Flame, Star, Zap, Target } from "lucide-react";
import { mockGamification } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

export const GamificationBar = () => {
  const g = mockGamification;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.15 }}
      className="flex items-center gap-4 overflow-x-auto pb-1"
    >
      {/* Streak */}
      <div className="flex items-center gap-1.5 bg-terracotta-light rounded-xl px-3 py-2 flex-shrink-0">
        <Flame className="w-4 h-4 text-terracotta" />
        <span className="text-sm font-display font-bold text-terracotta">{g.streak}</span>
        <span className="text-xs text-terracotta/80">giorni</span>
      </div>

      {/* Focus points */}
      <div className="flex items-center gap-1.5 bg-sage-light rounded-xl px-3 py-2 flex-shrink-0">
        <Zap className="w-4 h-4 text-sage-dark" />
        <span className="text-sm font-display font-bold text-sage-dark">{g.focusPoints}</span>
        <span className="text-xs text-sage-dark/80">focus</span>
      </div>

      {/* Autonomy */}
      <div className="flex items-center gap-1.5 bg-clay-light rounded-xl px-3 py-2 flex-shrink-0">
        <Star className="w-4 h-4 text-clay-dark" />
        <span className="text-sm font-display font-bold text-clay-dark">{g.autonomyPoints}</span>
        <span className="text-xs text-clay-dark/80">autonomia</span>
      </div>

      {/* Consistency */}
      <div className="flex items-center gap-1.5 bg-muted rounded-xl px-3 py-2 flex-shrink-0">
        <Target className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-display font-bold text-muted-foreground">{g.consistencyPoints}</span>
        <span className="text-xs text-muted-foreground/80">costanza</span>
      </div>
    </motion.div>
  );
};

export const DailyMissions = () => {
  const missions = mockGamification.dailyMissions;

  return (
    <div className="space-y-2">
      {missions.map((mission) => (
        <div
          key={mission.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            mission.done
              ? "bg-sage-light/30 border border-primary/10"
              : "bg-card border border-border shadow-soft"
          }`}
        >
          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
            mission.done ? "bg-primary" : "border-2 border-border"
          }`}>
            {mission.done && (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`text-sm flex-1 ${mission.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {mission.text}
          </span>
          <span className="text-xs font-medium text-muted-foreground">+{mission.points}</span>
        </div>
      ))}
    </div>
  );
};

export const BadgeGrid = () => {
  const badges = mockGamification.badges;

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: i * 0.06 }}
          className={`text-center p-4 rounded-2xl border transition-all ${
            badge.earned
              ? "bg-card border-primary/20 shadow-soft"
              : "bg-muted/50 border-border opacity-50"
          }`}
        >
          <span className="text-2xl block mb-1">{badge.emoji}</span>
          <p className="text-xs font-display font-semibold text-foreground leading-tight">{badge.name}</p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{badge.description}</p>
        </motion.div>
      ))}
    </div>
  );
};
