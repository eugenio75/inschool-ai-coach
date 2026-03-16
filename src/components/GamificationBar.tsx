import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Star, Zap, Target, Loader2, Brain, MessageCircle } from "lucide-react";
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

const MissionIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "review_weak_concept": return <Brain className="w-3.5 h-3.5" />;
    case "coach_challenge": return <MessageCircle className="w-3.5 h-3.5" />;
    case "complete_task": return <Target className="w-3.5 h-3.5" />;
    default: return <Zap className="w-3.5 h-3.5" />;
  }
};

const MissionTag = ({ type }: { type: string }) => {
  const tags: Record<string, { label: string; className: string }> = {
    review_weak_concept: { label: "Ripasso", className: "bg-clay-light text-clay-dark" },
    coach_challenge: { label: "Sfida del Coach", className: "bg-sage-light text-sage-dark" },
    complete_task: { label: "Compito", className: "bg-terracotta-light text-terracotta" },
    study_session: { label: "Studio", className: "bg-muted text-muted-foreground" },
    study_minutes: { label: "Tempo", className: "bg-muted text-muted-foreground" },
  };
  const tag = tags[type] || tags.study_session;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${tag.className}`}>
      {tag.label}
    </span>
  );
};

export const DailyMissions = ({ onMissionComplete }: { onMissionComplete?: () => void }) => {
  const navigate = useNavigate();
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

  const handleMissionClick = (mission: any) => {
    if (mission.completed) return;
    // Navigate to relevant section based on mission type
    if (mission.mission_type === "review_weak_concept") {
      navigate("/memory");
    } else if (mission.mission_type === "coach_challenge" || mission.mission_type === "study_session") {
      navigate("/dashboard"); // They'll pick a task from there
    }
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
        <button
          key={mission.id}
          onClick={() => handleMissionClick(mission)}
          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl transition-all text-left ${
            mission.completed
              ? "bg-sage-light/30 border border-primary/10"
              : "bg-card border border-border shadow-soft hover:border-primary/20"
          }`}
        >
          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
            mission.completed ? "bg-primary" : "border-2 border-border"
          }`}>
            {mission.completed ? (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <MissionIcon type={mission.mission_type} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-sm font-medium ${mission.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {mission.title}
              </span>
              <MissionTag type={mission.mission_type} />
            </div>
            {mission.description && (
              <p className={`text-xs leading-relaxed ${mission.completed ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                {mission.description}
              </p>
            )}
          </div>
          <span className={`text-xs font-bold shrink-0 mt-0.5 ${mission.completed ? "text-primary/60" : "text-primary"}`}>
            +{mission.points_reward}
          </span>
        </button>
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