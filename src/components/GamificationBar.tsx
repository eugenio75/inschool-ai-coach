import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Star, Zap, Target, Loader2 } from "lucide-react";
import { getGamification, getDailyMissions, completeMission } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

export const GamificationBar = () => {
  const [g, setG] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const data = await getGamification();
      setG(data);
    };
    load();
  }, []);

  if (!g) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.15 }}
      className="flex items-center gap-4 overflow-x-auto pb-1"
    >
      <div className="flex items-center gap-1.5 bg-terracotta-light rounded-xl px-3 py-2 flex-shrink-0">
        <Flame className="w-4 h-4 text-terracotta" />
        <span className="text-sm font-display font-bold text-terracotta">{g.streak || 0}</span>
        <span className="text-xs text-terracotta/80">giorni</span>
      </div>
      <div className="flex items-center gap-1.5 bg-sage-light rounded-xl px-3 py-2 flex-shrink-0">
        <Zap className="w-4 h-4 text-sage-dark" />
        <span className="text-sm font-display font-bold text-sage-dark">{g.focus_points || 0}</span>
        <span className="text-xs text-sage-dark/80">focus</span>
      </div>
      <div className="flex items-center gap-1.5 bg-clay-light rounded-xl px-3 py-2 flex-shrink-0">
        <Star className="w-4 h-4 text-clay-dark" />
        <span className="text-sm font-display font-bold text-clay-dark">{g.autonomy_points || 0}</span>
        <span className="text-xs text-clay-dark/80">autonomia</span>
      </div>
      <div className="flex items-center gap-1.5 bg-muted rounded-xl px-3 py-2 flex-shrink-0">
        <Target className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-display font-bold text-muted-foreground">{g.consistency_points || 0}</span>
        <span className="text-xs text-muted-foreground/80">costanza</span>
      </div>
    </motion.div>
  );
};

export const DailyMissions = ({ onMissionComplete }: { onMissionComplete?: () => void }) => {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getDailyMissions();
      setMissions(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleComplete = async (mission: any) => {
    if (mission.completed) return;
    await completeMission(mission.id, mission.points_reward);
    setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, completed: true, completed_at: new Date().toISOString() } : m));
    onMissionComplete?.();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <div className="text-center py-3">
        <p className="text-xs text-muted-foreground">Le missioni di oggi arriveranno presto! 🌱</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {missions.map((mission) => (
        <div
          key={mission.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            mission.completed
              ? "bg-sage-light/30 border border-primary/10"
              : "bg-card border border-border shadow-soft"
          }`}
        >
          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
            mission.completed ? "bg-primary" : "border-2 border-border"
          }`}>
            {mission.completed && (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-sm ${mission.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {mission.title}
            </span>
            {mission.description && (
              <p className={`text-xs ${mission.completed ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                {mission.description}
              </p>
            )}
          </div>
          <span className="text-xs font-medium text-muted-foreground">+{mission.points_reward}</span>
        </div>
      ))}
    </div>
  );
};

export const BadgeGrid = () => {
  return (
    <div className="grid grid-cols-3 gap-3">
      <p className="col-span-3 text-center text-xs text-muted-foreground py-4">I badge arriveranno presto! 🏅</p>
    </div>
  );
};