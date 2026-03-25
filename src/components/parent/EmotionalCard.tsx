import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShieldAlert, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { markAlertRead } from "@/lib/database";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const levelConfig: Record<string, { bg: string; border: string; icon: any; text: string; label: string }> = {
  high: { bg: "bg-destructive/10", border: "border-destructive/30", icon: ShieldAlert, text: "text-destructive", label: "Importante" },
  medium: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle, text: "text-amber-600 dark:text-amber-400", label: "Attenzione" },
  low: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Info, text: "text-blue-600 dark:text-blue-400", label: "Info" },
};

interface EmotionalCardProps {
  alerts: any[];
  onAlertRead: (alertId: string) => void;
  sessions: any[];
}

export const EmotionalCard = ({ alerts, onAlertRead, sessions }: EmotionalCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const unreadAlerts = alerts.filter(a => !a.read);

  // Compute recent emotion distribution
  const recentSessions = sessions.slice(0, 20);
  const emotionCounts: Record<string, number> = {};
  for (const s of recentSessions) {
    const e = s.emotion || "non_registrata";
    emotionCounts[e] = (emotionCounts[e] || 0) + 1;
  }

  const emotionLabels: Record<string, { label: string; color: string }> = {
    happy: { label: "Sereno", color: "bg-emerald-500" },
    proud: { label: "Soddisfatto", color: "bg-emerald-400" },
    calm: { label: "Tranquillo", color: "bg-blue-400" },
    neutral: { label: "Neutrale", color: "bg-slate-400" },
    tired: { label: "Stanco", color: "bg-amber-400" },
    frustrated: { label: "Frustrato", color: "bg-orange-500" },
    confused: { label: "Confuso", color: "bg-red-400" },
  };

  const totalEmotions = Object.entries(emotionCounts).filter(([k]) => k !== "non_registrata").reduce((a, [, v]) => a + v, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.1 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Heart className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground text-sm">Benessere emotivo</h3>
            {unreadAlerts.length > 0 && (
              <p className="text-[11px] text-destructive font-medium">{unreadAlerts.length} segnalazion{unreadAlerts.length === 1 ? "e" : "i"}</p>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Emotion distribution */}
            {totalEmotions > 0 && (
              <div className="mt-4 mb-3">
                <p className="text-xs text-muted-foreground mb-2">Emozioni recenti</p>
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                  {Object.entries(emotionCounts)
                    .filter(([k]) => k !== "non_registrata")
                    .sort(([, a], [, b]) => b - a)
                    .map(([emotion, count]) => {
                      const info = emotionLabels[emotion] || { color: "bg-slate-300", label: emotion };
                      return (
                        <div
                          key={emotion}
                          className={`${info.color} rounded-sm`}
                          style={{ width: `${(count / totalEmotions) * 100}%` }}
                          title={`${info.label}: ${count}`}
                        />
                      );
                    })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {Object.entries(emotionCounts)
                    .filter(([k]) => k !== "non_registrata")
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([emotion, count]) => {
                      const info = emotionLabels[emotion] || { color: "bg-slate-300", label: emotion };
                      return (
                        <div key={emotion} className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${info.color}`} />
                          <span className="text-[10px] text-muted-foreground">{info.label} ({count})</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Alerts */}
            {unreadAlerts.length > 0 && (
              <div className="space-y-2 mt-3">
                {unreadAlerts.map((alert) => {
                  const config = levelConfig[alert.alert_level] || levelConfig.low;
                  const IconComp = config.icon;
                  return (
                    <div key={alert.id} className={`${config.bg} border ${config.border} rounded-xl p-3`}>
                      <div className="flex gap-2">
                        <IconComp className={`w-4 h-4 ${config.text} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className={`font-medium text-xs ${config.text}`}>{alert.title}</h4>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${config.bg} ${config.text} font-medium`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/70 leading-relaxed mb-2">{alert.message}</p>
                          <button
                            onClick={async () => {
                              await markAlertRead(alert.id);
                              onAlertRead(alert.id);
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
                          >
                            Ho letto ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {unreadAlerts.length === 0 && totalEmotions === 0 && (
              <p className="text-xs text-muted-foreground mt-4 text-center py-2">Nessun segnale emotivo rilevato al momento</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
