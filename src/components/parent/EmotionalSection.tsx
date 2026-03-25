import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronDown, ShieldAlert, AlertTriangle, Info, Sparkles, Lightbulb, Eye, MessageCircle, Brain, Clock, Star, Smile, Frown, Meh } from "lucide-react";
import { Loader2 } from "lucide-react";
import { markAlertRead } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const iconMap: Record<string, any> = {
  lightbulb: Lightbulb,
  eye: Eye,
  message: MessageCircle,
  brain: Brain,
  heart: Heart,
  clock: Clock,
  star: Star,
};

const emotionEmojis: Record<string, { icon: any; label: string; color: string }> = {
  felice: { icon: Smile, label: "Felice", color: "text-green-500" },
  sereno: { icon: Smile, label: "Sereno", color: "text-sage-dark" },
  neutro: { icon: Meh, label: "Neutro", color: "text-muted-foreground" },
  stanco: { icon: Frown, label: "Stanco", color: "text-amber-500" },
  frustrato: { icon: Frown, label: "Frustrato", color: "text-destructive" },
  triste: { icon: Frown, label: "Triste", color: "text-blue-500" },
  ansioso: { icon: Frown, label: "Ansioso", color: "text-destructive" },
  non_registrata: { icon: Meh, label: "Non registrata", color: "text-muted-foreground" },
};

interface EmotionalSectionProps {
  selectedProfile: any;
  sessions: any[];
  emotionalAlerts: any[];
  setEmotionalAlerts: (fn: (prev: any[]) => any[]) => void;
  emotionalInsights: any[];
  insightsLoading: boolean;
}

const EmotionalSection = ({
  selectedProfile,
  sessions,
  emotionalAlerts,
  setEmotionalAlerts,
  emotionalInsights,
  insightsLoading,
}: EmotionalSectionProps) => {
  const [expanded, setExpanded] = useState(true);

  const unreadAlerts = emotionalAlerts.filter(a => !a.read);

  // Emotion patterns from sessions
  const emotionCounts: Record<string, number> = {};
  for (const s of sessions) {
    const e = s.emotion || "non_registrata";
    emotionCounts[e] = (emotionCounts[e] || 0) + 1;
  }
  const sortedEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);
  const totalEmotions = Object.values(emotionCounts).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.1 }}
      className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground">Area Emotiva & Benessere</h3>
            <p className="text-xs text-muted-foreground">Emozioni, alert e supporto</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadAlerts.length > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unreadAlerts.length} alert
            </span>
          )}
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
              {/* Emotion Distribution */}
              {sortedEmotions.length > 0 && totalEmotions > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pattern Emotivo</h4>
                  <div className="space-y-2">
                    {sortedEmotions.filter(([e]) => e !== "non_registrata").map(([emotion, count]) => {
                      const config = emotionEmojis[emotion] || emotionEmojis.non_registrata;
                      const IconComp = config.icon;
                      const percentage = Math.round((count / totalEmotions) * 100);
                      return (
                        <div key={emotion} className="flex items-center gap-3">
                          <IconComp className={`w-4 h-4 ${config.color} flex-shrink-0`} />
                          <span className="text-xs text-foreground w-20">{config.label}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                              className="h-full rounded-full bg-primary/60"
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Emotional Alerts */}
              {unreadAlerts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Alert Attivi</h4>
                  <div className="space-y-3">
                    {unreadAlerts.map((alert) => {
                      const levelConfig: Record<string, { bg: string; border: string; icon: any; text: string }> = {
                        high: { bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, text: "text-destructive" },
                        medium: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle, text: "text-amber-600 dark:text-amber-400" },
                        low: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Info, text: "text-blue-600 dark:text-blue-400" },
                      };
                      const config = levelConfig[alert.alert_level] || levelConfig.low;
                      const IconComp = config.icon;
                      return (
                        <div key={alert.id} className={`${config.bg} border ${config.border} rounded-xl p-4`}>
                          <div className="flex gap-3">
                            <IconComp className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className={`font-semibold text-sm ${config.text}`}>{alert.title}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${config.bg} ${config.text} font-medium uppercase`}>
                                  {alert.alert_level === "high" ? "Importante" : alert.alert_level === "medium" ? "Attenzione" : "Info"}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed mb-2">{alert.message}</p>
                              <button
                                onClick={async () => {
                                  await markAlertRead(alert.id);
                                  setEmotionalAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a));
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Ho letto ✓
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Emotional Insights */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consigli su benessere e motivazione</h4>
                </div>
                {insightsLoading ? (
                  <div className="flex items-center gap-2 py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    <p className="text-xs text-muted-foreground">Analizzo il benessere...</p>
                  </div>
                ) : emotionalInsights.length > 0 ? (
                  <div className="space-y-3">
                    {emotionalInsights.map((insight, i) => {
                      const IconComponent = iconMap[insight.icon] || Heart;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring, delay: 0.05 * i }}
                          className="flex gap-3 bg-muted/30 rounded-xl p-4"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-4 h-4 text-rose-500" />
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
                  <p className="text-xs text-muted-foreground text-center py-4">Nessun consiglio emotivo disponibile.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EmotionalSection;
