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
  schoolLevel?: string;
}

export const CognitiveCard = ({ childName, insights, insightsLoading, memoryItems, schoolLevel = "superiori" }: CognitiveCardProps) => {
  const [expanded, setExpanded] = useState(true);

  // Only show cognitive insights — emotional ones belong in EmotionalCard
  // Strict: only metodo, autonomia, motivazione, or unknown categories — never emotivo
  const cognitiveInsights = insights.filter(i => {
    const cat = (i.category || "").toLowerCase();
    return cat !== "emotivo";
  });

  const weakConcepts = memoryItems.filter(m => (m.strength || 0) < 60);
  const strongConcepts = memoryItems.filter(m => (m.strength || 0) >= 80);

  const isMedie = schoolLevel === "medie";
  const isUniversitario = schoolLevel === "universitario";

  const weakBySubject: Record<string, number> = {};
  for (const c of weakConcepts) {
    weakBySubject[c.subject] = (weakBySubject[c.subject] || 0) + 1;
  }
  const weakEntries = Object.entries(weakBySubject).sort(([, a], [, b]) => b - a);
  const displayedWeakEntries = isMedie ? weakEntries.slice(0, 2) : weakEntries;

  const cardTitle = isUniversitario ? "Analisi cognitiva" : "Area cognitiva";
  const cardSubtitle = isMedie
    ? (weakConcepts.length > 0 ? "Ci sono un paio di cose da rinforzare — niente di grave!" : "Tutto in ordine, continua così!")
    : isUniversitario
    ? (weakConcepts.length > 0 ? `${weakConcepts.length} concetti da consolidare — analisi strategica` : "Padronanza solida su tutti i concetti")
    : (weakConcepts.length > 0 ? `${weakConcepts.length} concett${weakConcepts.length === 1 ? "o" : "i"} da rafforzare` : "Tutto in ordine");

  const insightsLabel = isMedie
    ? "Come migliorare nello studio"
    : isUniversitario
    ? "Strategie di miglioramento"
    : "Suggerimenti didattici";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.15 }}
      className="bg-card rounded-2xl border border-border p-7 shadow-soft"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display font-bold text-foreground text-lg">{cardTitle}</h3>
            <p className="text-[13px] text-muted-foreground">{cardSubtitle}</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
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
              <div className="mt-5 grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                  <p className="font-display font-bold text-foreground text-2xl">{strongConcepts.length}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {isMedie ? "Cose che sai bene" : "Concetti solidi"}
                  </p>
                </div>
                <div className={`${weakConcepts.length > 0 ? "bg-amber-500/10" : "bg-muted/50"} rounded-xl p-4 text-center`}>
                  <p className="font-display font-bold text-foreground text-2xl">{isMedie ? Math.min(2, Object.keys(weakBySubject).length) : weakConcepts.length}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {isMedie ? "Cose da ripassare" : "Da rafforzare"}
                  </p>
                </div>
              </div>
            )}

            {/* Weak by subject */}
            {displayedWeakEntries.length > 0 && (
              <div className="mb-4">
                <p className="text-[13px] text-muted-foreground mb-2.5">
                  {isMedie ? "Dove puoi migliorare" : "Lacune per materia"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {displayedWeakEntries.map(([subject, count]) => (
                    <span key={subject} className="text-[13px] px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                      {subject}{!isMedie ? ` (${count})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-medium text-foreground">{insightsLabel}</p>
              </div>

              {insightsLoading ? (
                <div className="flex items-center gap-2 py-5 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-[13px] text-muted-foreground">Analizzo i dati...</p>
                </div>
              ) : cognitiveInsights.length > 0 ? (
                <div className="space-y-5">
                  {cognitiveInsights.map((insight, i) => {
                    const IconComponent = iconMap[insight.icon] || Lightbulb;
                    const colors = categoryColors[insight.category] || categoryColors.metodo;
                    return (
                      <div key={i} className="flex gap-3.5 py-1">
                        <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <IconComponent className={`w-4.5 h-4.5 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-bold text-foreground mb-1">{insight.title}</p>
                          <p className="text-sm text-muted-foreground leading-[1.7]">{insight.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground text-center py-4">Nessun consiglio disponibile al momento</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
