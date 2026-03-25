import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Clock, BookOpen, ChevronDown, Sparkles, Lightbulb, Eye, MessageCircle, Heart, Star, Target } from "lucide-react";
import { ProgressSun } from "@/components/ProgressSun";
import { Loader2 } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const iconMap: Record<string, any> = {
  lightbulb: Lightbulb,
  eye: Eye,
  message: MessageCircle,
  brain: Brain,
  heart: Heart,
  clock: Clock,
  star: Star,
  target: Target,
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  metodo: { bg: "bg-sage-light", text: "text-sage-dark" },
  autonomia: { bg: "bg-primary/10", text: "text-primary" },
  motivazione: { bg: "bg-amber-100", text: "text-amber-700" },
};

interface CognitiveSectionProps {
  selectedProfile: any;
  gamification: any;
  sessions: any[];
  tasks: any[];
  missions: any[];
  memoryItems: any[];
  cognitiveInsights: any[];
  insightsLoading: boolean;
}

const CognitiveSection = ({
  selectedProfile,
  gamification,
  sessions,
  tasks,
  missions,
  memoryItems,
  cognitiveInsights,
  insightsLoading,
}: CognitiveSectionProps) => {
  const [expanded, setExpanded] = useState(true);

  const totalMinutes = sessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);
  const totalSessions = sessions.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completedMissions = missions.filter((m: any) => m.completed).length;

  // Subject stats
  const subjectStats: Record<string, { sessions: number; totalMinutes: number; completed: number; total: number }> = {};
  for (const task of tasks) {
    if (!subjectStats[task.subject]) subjectStats[task.subject] = { sessions: 0, totalMinutes: 0, completed: 0, total: 0 };
    subjectStats[task.subject].total++;
    if (task.completed) subjectStats[task.subject].completed++;
  }
  for (const s of sessions) {
    const task = tasks.find(t => t.id === s.task_id);
    const subject = task?.subject || "Altro";
    if (!subjectStats[subject]) subjectStats[subject] = { sessions: 0, totalMinutes: 0, completed: 0, total: 0 };
    subjectStats[subject].sessions++;
    subjectStats[subject].totalMinutes += Math.round((s.duration_seconds || 0) / 60);
  }

  const weakConcepts = memoryItems.filter(m => (m.strength || 0) < 60);
  const strongConcepts = memoryItems.filter(m => (m.strength || 0) >= 80);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground">Area Cognitiva & Scolastica</h3>
            <p className="text-xs text-muted-foreground">Studio, progressi e metodo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{totalMinutes}m</span> studio
            <span className="mx-1">·</span>
            <span className="font-medium text-foreground">{totalSessions}</span> sessioni
          </div>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5 border-t border-border pt-5">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <div className="flex justify-center mb-1"><ProgressSun progress={0.72} size={32} /></div>
                  <p className="text-[10px] text-muted-foreground">Autonomia</p>
                  <p className="font-display font-bold text-sm text-foreground">72%</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <Clock className="w-4 h-4 text-sage-dark mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Focus</p>
                  <p className="font-display font-bold text-sm text-foreground">{totalMinutes}m</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <BookOpen className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Compiti</p>
                  <p className="font-display font-bold text-sm text-foreground">{completedTasks}/{tasks.length}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <Target className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Missioni</p>
                  <p className="font-display font-bold text-sm text-foreground">{completedMissions}/{missions.length}</p>
                </div>
              </div>

              {/* Gamification */}
              {gamification && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Punti & Streak</h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-lg font-display font-bold text-sage-dark">{gamification.focus_points || 0}</p><p className="text-[10px] text-muted-foreground">Focus</p></div>
                    <div><p className="text-lg font-display font-bold text-primary">{gamification.autonomy_points || 0}</p><p className="text-[10px] text-muted-foreground">Autonomia</p></div>
                    <div><p className="text-lg font-display font-bold text-amber-500">{gamification.streak || 0}</p><p className="text-[10px] text-muted-foreground">Streak</p></div>
                  </div>
                </div>
              )}

              {/* Subject Progress */}
              {Object.keys(subjectStats).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Progressi per Materia</h4>
                  <div className="space-y-2">
                    {Object.entries(subjectStats).map(([subject, stats]) => (
                      <div key={subject} className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{subject}</span>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{stats.totalMinutes}m</span>
                          <span>{stats.sessions} sess.</span>
                          <span className="text-foreground font-medium">{stats.completed}/{stats.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Concepts */}
              {(weakConcepts.length > 0 || strongConcepts.length > 0) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Concetti</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {weakConcepts.length > 0 && (
                      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                        <p className="text-xs font-semibold text-destructive mb-2">Da rinforzare ({weakConcepts.length})</p>
                        <div className="space-y-1">
                          {weakConcepts.slice(0, 4).map(c => (
                            <p key={c.id} className="text-xs text-foreground/70 truncate">{c.concept}</p>
                          ))}
                          {weakConcepts.length > 4 && <p className="text-[10px] text-muted-foreground">+{weakConcepts.length - 4} altri</p>}
                        </div>
                      </div>
                    )}
                    {strongConcepts.length > 0 && (
                      <div className="bg-sage-light/50 border border-sage-dark/20 rounded-xl p-3">
                        <p className="text-xs font-semibold text-sage-dark mb-2">Acquisiti ({strongConcepts.length})</p>
                        <div className="space-y-1">
                          {strongConcepts.slice(0, 4).map(c => (
                            <p key={c.id} className="text-xs text-foreground/70 truncate">{c.concept}</p>
                          ))}
                          {strongConcepts.length > 4 && <p className="text-[10px] text-muted-foreground">+{strongConcepts.length - 4} altri</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Cognitive Insights */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consigli su metodo e studio</h4>
                </div>
                {insightsLoading ? (
                  <div className="flex items-center gap-2 py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Analizzo i progressi...</p>
                  </div>
                ) : cognitiveInsights.length > 0 ? (
                  <div className="space-y-3">
                    {cognitiveInsights.map((insight, i) => {
                      const IconComponent = iconMap[insight.icon] || Lightbulb;
                      const colors = categoryColors[insight.category] || categoryColors.metodo;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring, delay: 0.05 * i }}
                          className="flex gap-3 bg-muted/30 rounded-xl p-4"
                        >
                          <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground mb-0.5">{insight.title}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Nessun consiglio disponibile.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CognitiveSection;
