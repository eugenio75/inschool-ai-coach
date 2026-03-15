import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ChevronUp, ChevronDown } from "lucide-react";

const spring = { type: "spring", stiffness: 260, damping: 30 };

interface GuidanceCardProps {
  emotion: string;
}

const coachResponses: Record<string, string[]> = {
  stuck: [
    "Nessun problema! Rileggiamo insieme la consegna. Cosa ti chiede di fare esattamente?",
    "Facciamo un passo indietro. Qual è la prima cosa che noti nell'esercizio?",
  ],
  hint: [
    "Prova a pensare: hai già visto qualcosa di simile? Quando?",
    "Un piccolo indizio: guarda i numeri. Cosa hanno in comune?",
  ],
  gotit: [
    "Fantastico! Spiegami con parole tue cosa hai capito. Così vediamo se ci siamo.",
    "Bravo! Adesso prova a fare il prossimo passo da solo. Se serve, ci sono.",
  ],
};

const thinkingPaths = [
  { id: "stuck", label: "Sono bloccato", variant: "sage" as const },
  { id: "hint", label: "Dammi un indizio", variant: "clay" as const },
  { id: "gotit", label: "Credo di aver capito", variant: "muted" as const },
];

const variantClasses = {
  sage: "bg-sage-light text-sage-dark hover:bg-accent",
  clay: "bg-clay-light text-clay-dark hover:bg-accent",
  muted: "bg-muted text-muted-foreground hover:bg-accent",
};

export const GuidanceCard = ({ emotion }: GuidanceCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [activeResponse, setActiveResponse] = useState<string | null>(null);
  const [responseIndex, setResponseIndex] = useState(0);

  const initialMessage = emotion === "frustrated" || emotion === "worried"
    ? "Capisco che può sembrare difficile. Facciamo il primo piccolo passo insieme — solo quello."
    : emotion === "tired"
    ? "Sei stanco, è normale. Facciamo solo un micro-passo, poi vediamo come va."
    : "Perfetto, iniziamo! Leggi la consegna dell'esercizio. Cosa ti chiede di fare?";

  const handlePath = (pathId: string) => {
    const responses = coachResponses[pathId];
    setActiveResponse(responses[responseIndex % responses.length]);
    setResponseIndex((i) => i + 1);
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="fixed bottom-0 left-0 right-0 z-40"
    >
      <div className="max-w-2xl mx-auto px-4 pb-4">
        <div className="bg-card rounded-2xl shadow-hover border border-primary/10 overflow-hidden">
          {/* Toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sage-light flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-sage-dark" />
              </div>
              <span className="text-sm font-display font-semibold text-foreground">Coach AI</span>
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4">
                  {/* Coach message */}
                  <div className="bg-sage-light/50 rounded-xl px-4 py-3 mb-4">
                    <p className="text-sm text-foreground leading-relaxed">
                      {activeResponse || initialMessage}
                    </p>
                  </div>

                  {/* Thinking paths */}
                  <div className="flex flex-wrap gap-2">
                    {thinkingPaths.map((path) => (
                      <button
                        key={path.id}
                        onClick={() => handlePath(path.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${variantClasses[path.variant]}`}
                      >
                        {path.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
