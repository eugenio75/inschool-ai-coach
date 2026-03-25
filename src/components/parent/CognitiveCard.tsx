import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Lightbulb, Eye, MessageCircle, Heart, Clock, Star, ChevronDown, Loader2, Sparkles } from "lucide-react";

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

const categoryColors: Record<string, { bg: string; text: string }> = {
  metodo: { bg: "bg-primary/10", text: "text-primary" },
  emotivo: { bg: "bg-destructive/10", text: "text-destructive" },
  autonomia: { bg: "bg-primary/10", text: "text-primary" },
  motivazione: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
};

interface CognitiveCardProps {
  childName: string;
  insights: any[];
  insightsLoading: boolean;
  memoryItems: any[];
}

export const CognitiveCard = ({ childName, insights, insightsLoading, memoryItems }: CognitiveCardProps) => {
  const [expanded, setExpanded] = useState(true);

  // Compute weak concepts
  const weakConcepts = memoryItems.filter(m => (m.strength || 0) < 60);
  const strongConcepts = memoryItems.filter(m => (m.strength || 0) >= 80);

  // Group weak by subject
  const weakBySubject: Record<string, number> = {};
  for (const c of weakConcepts) {
    weakBySubject[c.subject] = (weakBySubject[c.subject] || 0) + 1;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.15 }}
      className="bg-card rounded-2xl border border-border p-5 shadow-soft"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-semibold text-foreground text-sm">Area cognitiva</h3>
            <p className="text-[11px] text-muted-foreground">
              {weakConcepts.length > 0 ? `${weakConcepts.length} concett${weakConcepts.length === 1 ? "o" : "i"} da rafforzare` : "Tutto in ordine"}
            </p>
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
            {/* Concept strength overview */}
            {memoryItems.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 mb-3">
                <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                  <p className="font-display font-bold text-foreground text-lg">{strongConcepts.length}</p>
                  <p className="text-[10px] text-muted-foreground">Concetti solidi</p>
                </div>
                <div className={`${weakConcepts.length > 0 ? "bg-amber-500/10" : "bg-muted/50"} rounded-xl p-3 text-center`}>
                  <p className="font-display font-bold text-foreground text-lg">{weakConcepts.length}</p>
                  <p className="text-[10px] text-muted-foreground">Da rafforzare</p>
                </div>
              </div>
            )}

            {/* Weak by subject */}
            {Object.keys(weakBySubject).length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2">Lacune per materia</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(weakBySubject).sort(([, a], [, b]) => b - a).map(([subject, count]) => (
                    <span key={subject} className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                      {subject} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-medium text-foreground">Consigli per {childName}</p>
              </div>

              {insightsLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Analizzo i dati...</p>
                </div>
              ) : insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.map((insight, i) => {
                    const IconComponent = iconMap[insight.icon] || Lightbulb;
                    const colors = categoryColors[insight.category] || categoryColors.metodo;
                    return (
                      <div key={i} className="flex gap-2.5 py-2">
                        <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <IconComponent className={`w-3.5 h-3.5 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground mb-0.5">{insight.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">Nessun consiglio disponibile al momento</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
