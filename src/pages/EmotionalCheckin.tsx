import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Loader2, ArrowRight, PenLine, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveEmotionalCheckin } from "@/lib/database";
import { getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };
const CHECKIN_DATE_KEY = "inschool-last-checkin-date";

export function shouldShowCheckin(): boolean {
  const lastDate = localStorage.getItem(CHECKIN_DATE_KEY);
  const today = new Date().toISOString().split("T")[0];
  return lastDate !== today;
}

export function markCheckinDone() {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(CHECKIN_DATE_KEY, today);
}

// ─── Profile configs ────────────────────────────────────
interface MoodOption {
  id: string;
  label: string;
  emoji?: string;
}

interface ProfileCheckinConfig {
  moodQuestion: string;
  moodOptions: MoodOption[];
  useEmoji: boolean;
  contextualQuestion: (moodStreak: number) => string | null;
  freeTextPrompt: string;
  skipLabel: string;
}

function getJuniorConfig(): ProfileCheckinConfig {
  return {
    moodQuestion: "Com'è la tua energia oggi?",
    moodOptions: [
      { id: "great", label: "Benissimo", emoji: "😄" },
      { id: "good", label: "Bene", emoji: "🙂" },
      { id: "ok", label: "Così così", emoji: "😐" },
      { id: "sad", label: "Un po' triste", emoji: "😔" },
      { id: "tired", label: "Stanco", emoji: "😴" },
    ],
    useEmoji: true,
    contextualQuestion: (moodStreak) =>
      moodStreak >= 1
        ? "Ieri sembrava una giornata pesante. Oggi come stai?"
        : null,
    freeTextPrompt: "Vuoi raccontarmi qualcosa prima di iniziare?",
    skipLabel: "Iniziamo",
  };
}

function getSuperioriConfig(): ProfileCheckinConfig {
  return {
    moodQuestion: "Come stai oggi?",
    moodOptions: [
      { id: "focused", label: "Concentrato" },
      { id: "tired", label: "Stanco" },
      { id: "pressured", label: "Sotto pressione" },
      { id: "notgreat", label: "Non benissimo" },
    ],
    useEmoji: false,
    contextualQuestion: (moodStreak) =>
      moodStreak >= 1
        ? "Ieri sembrava una giornata pesante. Come stai adesso?"
        : null,
    freeTextPrompt: "Vuoi dirmi qualcosa prima di iniziare?",
    skipLabel: "Inizia",
  };
}

function getUniversityConfig(): ProfileCheckinConfig {
  return {
    moodQuestion: "Come stai?",
    moodOptions: [
      { id: "good", label: "Bene" },
      { id: "tired", label: "Stanco" },
      { id: "distracted", label: "Distratto" },
      { id: "notgreat", label: "Non benissimo" },
    ],
    useEmoji: false,
    contextualQuestion: (moodStreak) =>
      moodStreak >= 3
        ? "Nelle ultime settimane sembra esserci qualcosa che pesa. Tutto ok?"
        : null,
    freeTextPrompt: "",
    skipLabel: "Continua",
  };
}

function getConfigForLevel(schoolLevel: string | undefined): ProfileCheckinConfig {
  switch (schoolLevel) {
    case "superiori":
      return getSuperioriConfig();
    case "universitario":
      return getUniversityConfig();
    case "alunno":
    case "medie":
    default:
      return getJuniorConfig();
  }
}

// Map mood option IDs to emotional_tone / energy_level
function deriveToneAndEnergy(moodId: string): {
  emotional_tone: "positive" | "neutral" | "low";
  energy_level: "high" | "medium" | "low";
  signals: string[];
} {
  const map: Record<string, { emotional_tone: "positive" | "neutral" | "low"; energy_level: "high" | "medium" | "low"; signals: string[] }> = {
    great: { emotional_tone: "positive", energy_level: "high", signals: [] },
    good: { emotional_tone: "positive", energy_level: "medium", signals: [] },
    ok: { emotional_tone: "neutral", energy_level: "medium", signals: [] },
    sad: { emotional_tone: "low", energy_level: "medium", signals: ["sadness_reported"] },
    tired: { emotional_tone: "neutral", energy_level: "low", signals: ["low_energy"] },
    focused: { emotional_tone: "positive", energy_level: "high", signals: [] },
    pressured: { emotional_tone: "low", energy_level: "medium", signals: ["anxiety"] },
    notgreat: { emotional_tone: "low", energy_level: "low", signals: ["distress_combined"] },
    distracted: { emotional_tone: "neutral", energy_level: "medium", signals: ["difficulty_reported"] },
  };
  return map[moodId] || { emotional_tone: "neutral", energy_level: "medium", signals: [] };
}

const EmotionalCheckin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [moodAnswer, setMoodAnswer] = useState<{ id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [customAnswer, setCustomAnswer] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [moodStreak, setMoodStreak] = useState(0);

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
  const schoolLevel = (childSession?.profile?.school_level || savedProfile?.school_level) as string | undefined;
  const profileId = childSession?.profileId || savedProfile?.id;

  const config = useMemo(() => getConfigForLevel(schoolLevel), [schoolLevel]);

  // Load mood_streak
  useEffect(() => {
    if (!profileId) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("user_preferences")
        .select("mood_streak")
        .eq("profile_id", profileId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.mood_streak) setMoodStreak(data.mood_streak);
        });
    });
  }, [profileId]);

  // Steps: 0 = mood, 1 = contextual (optional, auto-skipped), 2 = free text
  const contextualQ = useMemo(() => config.contextualQuestion(moodStreak), [config, moodStreak]);
  const hasContextual = !!contextualQ;
  // Determine actual step count: mood → (contextual?) → free text
  const totalSteps = hasContextual ? 3 : 2;

  const handleMoodSelect = (opt: MoodOption) => {
    setMoodAnswer(opt);
    if (hasContextual) {
      setStep(1);
    } else {
      setStep(2);
    }
  };

  const handleCustomMood = () => {
    if (!customAnswer.trim()) return;
    setMoodAnswer({ id: "custom", label: customAnswer.trim() });
    if (hasContextual) {
      setStep(1);
    } else {
      setStep(2);
    }
  };

  const handleSkip = async () => {
    markCheckinDone();
    navigate("/dashboard", { replace: true });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { emotional_tone, energy_level, signals } = moodAnswer
        ? deriveToneAndEnergy(moodAnswer.id)
        : { emotional_tone: "neutral" as const, energy_level: "medium" as const, signals: [] as string[] };

      const allResponses = [
        { question: config.moodQuestion, answer: moodAnswer?.label || "skipped", answerId: moodAnswer?.id || "skipped" },
        ...(freeText ? [{ question: config.freeTextPrompt || "Spazio libero", answer: freeText, answerId: "free_text" }] : []),
      ];

      await saveEmotionalCheckin({
        responses: allResponses,
        emotional_tone,
        energy_level,
        signals,
      });

      markCheckinDone();
    } catch (err) {
      console.error("Failed to save check-in:", err);
      markCheckinDone();
    } finally {
      navigate("/dashboard", { replace: true });
    }
  };

  // Determine which visual step we're on for progress dots
  const progressStep = step === 0 ? 0 : step >= 2 ? (totalSteps - 1) : 1;

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
        {/* STEP 0 — Mood question */}
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={spring}
            className="max-w-sm w-full text-center"
          >
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
              Ciao {name}!
            </h2>
            <p className="text-muted-foreground mb-8 text-sm">
              {config.moodQuestion}
            </p>

            <div className={`grid ${config.useEmoji ? "grid-cols-1 gap-3" : "grid-cols-2 gap-3"}`}>
              {config.moodOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleMoodSelect(opt)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:bg-muted hover:border-primary/30 transition-all ${
                    config.useEmoji ? "justify-start" : "justify-center flex-col gap-2"
                  }`}
                >
                  {config.useEmoji && opt.emoji && (
                    <span className="text-2xl">{opt.emoji}</span>
                  )}
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </button>
              ))}
              <button
                onClick={() => setShowCustom(true)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                  showCustom ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted hover:border-primary/30"
                } ${config.useEmoji ? "justify-start" : "justify-center flex-col gap-2"}`}
              >
                <PenLine className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Altro...</span>
              </button>
            </div>

            {showCustom && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  placeholder="Scrivi come ti senti..."
                  className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={!customAnswer.trim()}
                  onClick={handleCustomMood}
                  className="rounded-2xl px-4"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            <button onClick={handleSkip} className="mt-6 text-xs text-muted-foreground hover:text-foreground">
              Salta per oggi
            </button>
          </motion.div>
        )}

        {/* STEP 1 — Contextual question (only if hasContextual) */}
        {step === 1 && hasContextual && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={spring}
            className="max-w-sm w-full text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
              <Star className="w-7 h-7 text-accent-foreground" />
            </div>
            <p className="text-muted-foreground mb-8 text-sm">{contextualQ}</p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Scrivi qui se ti va..."
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20 mb-4"
            />
            <Button
              onClick={() => setStep(2)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl py-5"
            >
              Avanti <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <button onClick={() => setStep(2)} className="mt-4 text-xs text-muted-foreground hover:text-foreground">
              Salta →
            </button>
          </motion.div>
        )}

        {/* STEP 2 — Free text */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={spring}
            className="max-w-sm w-full text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-7 h-7 text-muted-foreground" />
            </div>
            {config.freeTextPrompt ? (
              <>
                <h2 className="font-display text-lg font-bold text-foreground mb-2">
                  Un'ultima cosa...
                </h2>
                <p className="text-muted-foreground mb-6 text-sm">{config.freeTextPrompt}</p>
              </>
            ) : (
              <h2 className="font-display text-lg font-bold text-foreground mb-6">
                Qualcosa da aggiungere?
              </h2>
            )}
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={config.freeTextPrompt ? "Scrivi qui se ti va... (facoltativo)" : "Scrivi qui..."}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-24 mb-4"
            />
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl py-5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {config.skipLabel} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-8 flex gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i <= progressStep ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default EmotionalCheckin;
