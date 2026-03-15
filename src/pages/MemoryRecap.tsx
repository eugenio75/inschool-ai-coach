import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, RefreshCw, ChevronDown, ChevronUp, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockRecapItems, subjectColors, type RecapItem } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const StrengthBar = ({ strength }: { strength: number }) => {
  const color = strength >= 70 ? "bg-primary" : strength >= 40 ? "bg-secondary" : "bg-terracotta";
  const label = strength >= 70 ? "Forte" : strength >= 40 ? "Da rivedere" : "Da rafforzare";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          transition={spring}
        />
      </div>
      <span className="text-xs text-muted-foreground w-24 text-right">{label}</span>
    </div>
  );
};

const RecapCard = ({ item }: { item: RecapItem }) => {
  const [expanded, setExpanded] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answered, setAnswered] = useState(false);
  const colors = subjectColors[item.subject] || subjectColors.Matematica;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-4 p-5 text-left"
      >
        <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Brain className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{item.subject}</span>
          </div>
          <h3 className="font-display font-semibold text-foreground">{item.concept}</h3>
          <div className="mt-2">
            <StrengthBar strength={item.strength} />
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
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
            <div className="px-5 pb-5 space-y-4">
              {/* Summary */}
              <div className="bg-sage-light/50 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-sage-dark uppercase tracking-wider mb-1">Riassunto</p>
                <p className="text-sm text-foreground leading-relaxed">{item.summary}</p>
              </div>

              {/* Quiz mode */}
              {!quizMode ? (
                <Button
                  onClick={() => { setQuizMode(true); setCurrentQ(0); setAnswered(false); }}
                  variant="outline"
                  className="w-full rounded-xl border-border"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Testa la tua memoria
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-clay-light/50 rounded-xl px-4 py-3">
                    <p className="text-xs font-medium text-clay-dark uppercase tracking-wider mb-1">
                      Domanda {currentQ + 1} di {item.recallQuestions.length}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {item.recallQuestions[currentQ]}
                    </p>
                  </div>

                  {!answered ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setAnswered(true)}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Lo so!
                      </Button>
                      <Button
                        onClick={() => setAnswered(true)}
                        variant="outline"
                        className="flex-1 rounded-xl border-border"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Non ricordo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Prova a rispondere ad alta voce o nella tua testa, poi passa alla prossima.
                      </p>
                      {currentQ < item.recallQuestions.length - 1 ? (
                        <Button
                          onClick={() => { setCurrentQ(c => c + 1); setAnswered(false); }}
                          className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl"
                        >
                          Prossima domanda
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setQuizMode(false)}
                          className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl"
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Fatto! Bravo!
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Ultimo ripasso: {new Date(item.lastReviewed).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MemoryRecap = () => {
  const navigate = useNavigate();
  const weak = mockRecapItems.filter(i => i.strength < 50);
  const strong = mockRecapItems.filter(i => i.strength >= 50);

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Memoria e Ripasso</span>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">
              Quello che hai imparato 🧠
            </h1>
            <p className="text-muted-foreground text-sm">
              Ripassa i concetti per ricordarli meglio. La ripetizione è la chiave!
            </p>
          </motion.div>
        </div>
      </div>

      {/* Weak concepts - priority */}
      {weak.length > 0 && (
        <div className="px-6 mt-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-4 h-4 text-terracotta" />
              <h2 className="font-display font-semibold text-foreground">Da rafforzare</h2>
              <span className="text-xs bg-terracotta-light text-terracotta px-2 py-0.5 rounded-full font-medium">
                {weak.length}
              </span>
            </div>
            <div className="space-y-3">
              {weak.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: i * 0.08 }}
                >
                  <RecapCard item={item} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strong concepts */}
      {strong.length > 0 && (
        <div className="px-6 mt-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-sage-dark" />
              <h2 className="font-display font-semibold text-foreground">Concetti solidi</h2>
            </div>
            <div className="space-y-3">
              {strong.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.2 + i * 0.08 }}
                >
                  <RecapCard item={item} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryRecap;
