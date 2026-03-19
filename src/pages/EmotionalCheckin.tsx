import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Loader2, Smile, Frown, Minus, Shuffle, Zap, Sun, Moon, AlertTriangle, Star, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveEmotionalCheckin } from "@/lib/database";
import { getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const CHECKIN_DATE_KEY = "inschool-last-checkin-date";

// Gender-aware text helper: returns M/F variant based on gender
function g(gender: string | undefined, male: string, female: string): string {
  if (gender === "F") return female;
  if (gender === "M") return male;
  return `${male}/${female.slice(-1)}`; // fallback: "o/a"
}

// Question pools - will be gender-adapted at render time
function getExperienceQuestions() {
  return [
    "Oggi c'è stata una cosa che ti ha fatto sorridere oppure una un po' complicata?",
    "Se ripensi alla giornata, qual è la cosa che ti è rimasta più in testa?",
    "Oggi c'è stato un momento facile o uno un po' difficile?",
    "C'è stato qualcosa di bello o di un po' strano oggi?",
    "Com'è andata la giornata? C'è qualcosa che vuoi raccontarmi?",
  ];
}

function getStateQuestions(gender?: string) {
  const ca = g(gender, "carico", "carica");
  const sa = g(gender, "scarico", "scarica");
  const pa = g(gender, "pronto", "pronta");
  const sta = g(gender, "stanco", "stanca");
  const tra = g(gender, "tranquillo", "tranquilla");
  const agi = g(gender, "agitato", "agitata");
  return [
    `E adesso come ti senti? Più ${ca} oppure un po' ${sa}?`,
    "Hai più voglia di partire oppure oggi serve andare piano piano?",
    `Ti senti ${pa} oppure un po' ${sta} oggi?`,
    `Come stai in questo momento? ${tra} o un po' ${agi}?`,
  ];
}

const optionalQuestions = [
  "C'è qualcosa che ti è rimasto in testa che vuoi raccontarmi?",
  "Ti va di dirmi qualcosa che ti ha fatto pensare oggi?",
];

// Answer options for structured responses
const experienceAnswers = [
  { id: "smile", icon: Smile, label: "Qualcosa di bello" },
  { id: "hard", icon: Frown, label: "Un po' complicata" },
  { id: "normal", icon: Minus, label: "Normale" },
  { id: "mixed", icon: Shuffle, label: "Un po' e un po'" },
];

function getStateAnswers(gender?: string) {
  return [
    { id: "charged", icon: Zap, label: g(gender, "Carico!", "Carica!") },
    { id: "calm", icon: Sun, label: g(gender, "Tranquillo", "Tranquilla") },
    { id: "tired", icon: Moon, label: `Un po' ${g(gender, "stanco", "stanca")}` },
    { id: "nervous", icon: AlertTriangle, label: `Un po' ${g(gender, "agitato", "agitata")}` },
  ];
}

export function shouldShowCheckin(): boolean {
  const lastDate = localStorage.getItem(CHECKIN_DATE_KEY);
  const today = new Date().toISOString().split("T")[0];
  return lastDate !== today;
}

export function markCheckinDone() {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(CHECKIN_DATE_KEY, today);
}

const EmotionalCheckin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ question: string; answer: string; answerId: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [freeText, setFreeText] = useState("");

  const childSession = getChildSession();
  const savedProfile = useMemo(() => {
    try {
      const stored = localStorage.getItem("inschool-profile");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);
  const name = childSession?.profile?.name || savedProfile?.name || "campione";
  const gender = (childSession?.profile?.gender || savedProfile?.gender) as string | undefined;

  const stateAnswers = useMemo(() => getStateAnswers(gender), [gender]);

  // Pick today's questions based on day-of-year for rotation
  const { q1, q2, q3 } = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const expQ = getExperienceQuestions();
    const stQ = getStateQuestions(gender);
    return {
      q1: expQ[dayOfYear % expQ.length],
      q2: stQ[dayOfYear % stQ.length],
      q3: optionalQuestions[dayOfYear % optionalQuestions.length],
    };
  }, [gender]);

  const handleAnswer = (question: string, answerId: string, label: string) => {
    setAnswers(prev => [...prev, { question, answer: label, answerId }]);
    setStep(prev => prev + 1);
  };

  const handleSkip = async () => {
    markCheckinDone();
    navigate("/dashboard", { replace: true });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Determine emotional tone and energy from answers
      const expAnswer = answers.find(a => experienceAnswers.some(e => e.id === a.answerId));
      const stateAnswer = answers.find(a => stateAnswers.some(s => s.id === a.answerId));

      let emotionalTone: "positive" | "neutral" | "low" = "neutral";
      if (expAnswer?.answerId === "smile") emotionalTone = "positive";
      else if (expAnswer?.answerId === "hard") emotionalTone = "low";

      let energyLevel: "high" | "medium" | "low" = "medium";
      if (stateAnswer?.answerId === "charged") energyLevel = "high";
      else if (stateAnswer?.answerId === "tired") energyLevel = "low";

      // Detect signals
      const signals: string[] = [];
      if (expAnswer?.answerId === "hard") signals.push("difficulty_reported");
      if (stateAnswer?.answerId === "tired") signals.push("low_energy");
      if (stateAnswer?.answerId === "nervous") signals.push("anxiety");
      if (emotionalTone === "low" && energyLevel === "low") signals.push("distress_combined");

      const allResponses = [
        ...answers.map(a => ({ question: a.question, answer: a.answer, answerId: a.answerId })),
        ...(freeText ? [{ question: q3, answer: freeText, answerId: "free_text" }] : []),
      ];

      await saveEmotionalCheckin({
        responses: allResponses,
        emotional_tone: emotionalTone,
        energy_level: energyLevel,
        signals,
      });

      markCheckinDone();
    } catch (err) {
      console.error("Failed to save check-in:", err);
      markCheckinDone(); // Don't block the child
    } finally {
      navigate("/dashboard", { replace: true });
    }
  };

  // Auto-finish after step 2 if no optional question needed
  useEffect(() => {
    if (step === 2) {
      // Check if signals suggest showing optional question
      const expAnswer = answers.find(a => experienceAnswers.some(e => e.id === a.answerId));
      const stateAnswer = answers.find(a => stateAnswers.some(s => s.id === a.answerId));
      const needsOptional = expAnswer?.answerId === "hard" || stateAnswer?.answerId === "nervous";
      if (!needsOptional) {
        handleFinish();
      }
    }
  }, [step]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6">
      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={spring}
            className="max-w-sm w-full text-center"
          >
           <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
            >
              <Smile className="w-8 h-8 text-primary" />
            </motion.div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
              Ciao {name}!
            </h2>
            <p className="text-muted-foreground mb-8 text-sm">
              {q1}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {experienceAnswers.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleAnswer(q1, opt.id, opt.label)}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-border bg-card hover:bg-muted hover:border-primary/30 transition-all"
                >
                  <opt.icon className="w-6 h-6 text-primary" />
                  <span className="text-xs font-medium text-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={handleSkip} className="mt-6 text-xs text-muted-foreground hover:text-foreground">
              Salta per oggi
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={spring}
            className="max-w-sm w-full text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6"><Star className="w-7 h-7 text-accent-foreground" /></div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground mb-2">
              Perfetto!
            </h2>
            <p className="text-muted-foreground mb-8 text-sm">
              {q2}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {stateAnswers.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleAnswer(q2, opt.id, opt.label)}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-border bg-card hover:bg-muted hover:border-primary/30 transition-all"
                >
                  <opt.icon className="w-6 h-6 text-primary" />
                  <span className="text-xs font-medium text-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={handleSkip} className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Salta →
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={spring}
            className="max-w-sm w-full text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6"><MessageSquare className="w-7 h-7 text-muted-foreground" /></div>
            <h2 className="font-display text-lg font-bold text-foreground mb-2">
              Un'ultima cosa...
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              {q3}
            </p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Scrivi qui se ti va... (facoltativo)"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-24 mb-4"
            />
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {freeText ? "Invia e inizia!" : "Vai ai compiti! 🚀"}
            </Button>
          </motion.div>
        )}

        {saving && step > 2 && (
          <motion.div
            key="saving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default EmotionalCheckin;
