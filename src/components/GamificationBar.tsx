import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Star, Zap, Target, Loader2, Brain, MessageCircle, ArrowRight } from "lucide-react";
import { getGamification, getDailyMissions, completeMission, getTasks, getActiveChildProfileId } from "@/lib/database";
import { getChildSession, isChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { StreakShieldBadge } from "@/components/CelebrationOverlay";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

export const GamificationKPI = () => {
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
  const shields = (g as any).streak_shields || 0;
  const nextShieldAt = (g as any).next_shield_at || 7;
  const streak = g.streak || 0;
  const daysToShield = Math.max(0, nextShieldAt - streak);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Streak */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Streak</span>
          <div className="w-7 h-7 bg-terracotta-light rounded-lg flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-terracotta" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-foreground">{streak}</p>
        <p className="text-[10px] text-muted-foreground">giorni</p>
      </div>

      {/* Punti totali */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Punti</span>
          <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
            <Star className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-foreground">{total}</p>
        {shields > 0 && <StreakShieldBadge shields={shields} />}
        {shields === 0 && streak > 0 && daysToShield <= 3 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Scudo tra {daysToShield}g</p>
        )}
      </div>

      {/* Impegno */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Impegno</span>
          <div className="w-7 h-7 bg-sage-light rounded-lg flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-sage-dark" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-foreground">{g.focus_points || 0}</p>
      </div>

      {/* Costanza */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Costanza</span>
          <div className="w-7 h-7 bg-clay-light rounded-lg flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-clay-dark" />
          </div>
        </div>
        <p className="font-display text-2xl font-bold text-foreground">{g.consistency_points || 0}</p>
      </div>
    </div>
  );
};

export const GamificationBar = GamificationKPI;

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

    if (mission.mission_type === "coach_challenge") {
      navigate(`/challenge/${mission.id}`);
      return;
    }
    
    try {
      const tasks = await getTasks();
      const incompleteTasks = tasks.filter((t: any) => !t.completed);
      
      if (incompleteTasks.length === 0) {
        toast({ title: "Nessun compito disponibile", description: "Chiedi al genitore di aggiungere dei compiti." });
        return;
      }
      
      const metadata = mission.metadata || {};
      let targetTask = incompleteTasks[0];
      
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
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-soft">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-foreground text-sm">Missioni del giorno</h3>
      </div>
      <div className="space-y-2">
        {missions.map((mission) => (
          <button
            key={mission.id}
            onClick={() => handleMissionClick(mission)}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
              mission.completed
                ? "bg-muted/50"
                : "bg-muted/30 hover:bg-accent"
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
    </div>
  );
};

export const BadgeGrid = () => {
  return (
    <div className="grid grid-cols-3 gap-3">
      <p className="col-span-3 text-center text-xs text-muted-foreground py-4">I badge arriveranno presto.</p>
    </div>
  );
};
