import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Star, Zap, Target, Loader2, Brain, MessageCircle, ArrowRight } from "lucide-react";
import { getGamification, getDailyMissions, completeMission, getTasks } from "@/lib/database";
import { toast } from "@/hooks/use-toast";

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

  const total = (g.focus_points || 0) + (g.autonomy_points || 0) + (g.consistency_points || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.15 }}
      className="space-y-2"
    >
      {/* Main row: streak + total */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-terracotta-light rounded-xl px-3 py-2">
          <Flame className="w-4 h-4 text-terracotta" />
          <span className="text-sm font-display font-bold text-terracotta">{g.streak || 0}</span>
          <span className="text-xs text-terracotta/80">giorni</span>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-2">
          <Star className="w-4 h-4 text-primary" />
          <span className="text-sm font-display font-bold text-primary">{total}</span>
          <span className="text-xs text-primary/80">punti</span>
        </div>
      </div>

      {/* Detail row: 3 sub-scores */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-sage-dark" />
          <span className="font-medium text-sage-dark">{g.focus_points || 0}</span>
          <span>impegno</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="w-3 h-3 text-clay-dark" />
          <span className="font-medium text-clay-dark">{g.autonomy_points || 0}</span>
          <span>indipendenza</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Target className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium">{g.consistency_points || 0}</span>
          <span>costanza</span>
        </div>
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

  const handleMissionClick = async (mission: any) => {
    if (mission.completed) return;
    
    if (mission.mission_type === "review_weak_concept" || mission.mission_type === "review_concept") {
      navigate("/memory");
      return;
    }
    
    // For coach_challenge, complete_task, study_session, study_minutes:
    // Find a matching incomplete task and navigate to its focus session
    try {
      const tasks = await getTasks();
      const incompleteTasks = tasks.filter((t: any) => !t.completed);
      
      if (incompleteTasks.length === 0) {
        toast({ title: "Nessun compito disponibile", description: "Chiedi al genitore di aggiungere dei compiti! 📚" });
        return;
      }
      
      // Try to find a task matching the mission's subject/metadata
      const metadata = mission.metadata || {};
      let targetTask = incompleteTasks[0]; // fallback to first incomplete
      
      if (metadata.subject) {
        const subjectMatch = incompleteTasks.find((t: any) => 
          metadata.subject.toLowerCase().includes(t.subject.toLowerCase())
        );
        if (subjectMatch) targetTask = subjectMatch;
      }
      
      navigate(`/focus/${targetTask.id}`);
    } catch (err) {
      console.error("Error finding task for mission:", err);
      navigate("/dashboard");
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
          <div className="flex flex-col items-end gap-1.5 shrink-0 mt-0.5">
            <span className={`text-xs font-bold ${mission.completed ? "text-primary/60" : "text-primary"}`}>
              +{mission.points_reward}
            </span>
            {!mission.completed && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                Inizia <ArrowRight className="w-3 h-3" />
              </span>
            )}
          </div>
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