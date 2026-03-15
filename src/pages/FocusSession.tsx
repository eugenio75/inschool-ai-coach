import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressSun } from "@/components/ProgressSun";
import { GuidanceCard } from "@/components/GuidanceCard";
import { mockTasks } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type Phase = "checkin" | "breathing" | "focus" | "recap";

const emotionOptions = [
  { id: "ready", emoji: "😊", label: "Pronto" },
  { id: "tired", emoji: "😴", label: "Stanco" },
  { id: "worried", emoji: "😟", label: "Preoccupato" },
  { id: "bored", emoji: "😐", label: "Annoiato" },
  { id: "frustrated", emoji: "😤", label: "Frustrato" },
];

const FocusSession = () => {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const task = mockTasks.find(t => t.id === taskId) || mockTasks[0];

  const [phase, setPhase] = useState<Phase>("checkin");
  const [emotion, setEmotion] = useState("");
  const [profile, setProfile] = useState<any>(null);

  // Get focus time from profile
  useEffect(() => {
    const saved = localStorage.getItem("inschool-profile");
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch {}
    }
  }, []);

  const focusMinutes = profile?.focusTime ? parseInt(profile.focusTime) : task.estimatedMinutes;
  const [seconds, setSeconds] = useState(focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [breathCount, setBreathCount] = useState(0);

  useEffect(() => {
    setSeconds(focusMinutes * 60);
  }, [focusMinutes]);

  const totalSeconds = focusMinutes * 60;
  const progress = 1 - seconds / totalSeconds;

  useEffect(() => {
    if (!isRunning || seconds <= 0) return;
    const interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning, seconds]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const startBreathing = () => {
    setPhase("breathing");
    setBreathCount(0);
    const timer = setInterval(() => {
      setBreathCount((c) => {
        if (c >= 3) {
          clearInterval(timer);
          setPhase("focus");
          setIsRunning(true);
          return c;
        }
        return c + 1;
      });
    }, 4000);
  };

  const endSession = () => {
    setIsRunning(false);
    setPhase("recap");
  };

  const minutesWorked = Math.round((totalSeconds - seconds) / 60);
  const studentName = profile?.name || "campione";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{task.subject}</p>
          <p className="text-sm font-display font-semibold text-foreground">{task.title}</p>
        </div>
        <button onClick={endSession} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-48">
        <AnimatePresence mode="wait">
          {/* Check-in */}
          {phase === "checkin" && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="max-w-md w-full text-center"
            >
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Come ti senti adesso?
              </h2>
              <p className="text-muted-foreground mb-8">
                Non c'è una risposta giusta. Dimmi come stai.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {emotionOptions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEmotion(e.id)}
                    className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border transition-all ${
                      emotion === e.id
                        ? "border-primary bg-sage-light shadow-soft"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    <span className="text-2xl">{e.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{e.label}</span>
                  </button>
                ))}
              </div>
              <Button
                onClick={startBreathing}
                disabled={!emotion}
                className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-8 py-5 text-base disabled:opacity-40"
              >
                Sono pronto
              </Button>
            </motion.div>
          )}

          {/* Breathing */}
          {phase === "breathing" && (
            <motion.div
              key="breathing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={spring}
              className="text-center"
            >
              <h2 className="font-display text-xl font-bold text-foreground mb-8">
                Facciamo 3 respiri profondi
              </h2>
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-32 h-32 rounded-full bg-sage-light border-2 border-primary/30 mx-auto flex items-center justify-center"
              >
                <span className="text-3xl font-display font-bold text-primary animate-pulse-soft">
                  {breathCount + 1}
                </span>
              </motion.div>
              <p className="text-muted-foreground mt-6">Inspira... ed espira...</p>
            </motion.div>
          )}

          {/* Focus */}
          {phase === "focus" && (
            <motion.div
              key="focus"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="text-center w-full max-w-md"
            >
              <ProgressSun progress={progress} size={120} />
              <p className="font-display text-4xl font-bold text-foreground mt-6 tabular-nums">
                {formatTime(seconds)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {progress < 0.25
                  ? "Stai andando benissimo. Un passo alla volta."
                  : progress < 0.5
                  ? "Ottimo ritmo! Continua così."
                  : progress < 0.75
                  ? "Più di metà! Sei fortissimo. 💪"
                  : "Quasi finito! L'ultimo sprint!"}
              </p>

              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setIsRunning(!isRunning)}
                  className="rounded-xl border-border"
                >
                  {isRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {isRunning ? "Pausa" : "Riprendi"}
                </Button>
                <Button
                  onClick={endSession}
                  className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl"
                >
                  Ho finito
                </Button>
              </div>
            </motion.div>
          )}

          {/* Recap */}
          {phase === "recap" && (
            <motion.div
              key="recap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="text-center max-w-md w-full"
            >
              <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🌟</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Bravissimo, {studentName}!
              </h2>
              <p className="text-muted-foreground mb-2">
                Hai lavorato per {minutesWorked} minuti su {task.title}.
              </p>

              {/* Session stats */}
              <div className="grid grid-cols-3 gap-3 my-6">
                <div className="bg-sage-light rounded-xl p-3 text-center">
                  <p className="text-lg font-display font-bold text-sage-dark">+{minutesWorked * 2}</p>
                  <p className="text-[10px] text-sage-dark/80">punti focus</p>
                </div>
                <div className="bg-clay-light rounded-xl p-3 text-center">
                  <p className="text-lg font-display font-bold text-clay-dark">+{Math.round(minutesWorked * 0.5)}</p>
                  <p className="text-[10px] text-clay-dark/80">autonomia</p>
                </div>
                <div className="bg-terracotta-light rounded-xl p-3 text-center">
                  <p className="text-lg font-display font-bold text-terracotta">+1</p>
                  <p className="text-[10px] text-terracotta/80">costanza</p>
                </div>
              </div>

              <p className="text-sm text-sage-dark font-medium mb-8">
                Hai dimostrato costanza e impegno. È così che si cresce. 🌱
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => navigate(`/homework/${task.id}`)}
                  variant="outline"
                  className="rounded-2xl py-5 border-border"
                >
                  Vedi dettagli compito
                </Button>
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5"
                >
                  Torna ai compiti
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/dashboard")}
                  className="text-muted-foreground"
                >
                  Per oggi basta così
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guidance Card - always anchored at bottom during focus */}
      {phase === "focus" && (
        <GuidanceCard
          emotion={emotion}
          taskTitle={task.title}
          taskSubject={task.subject}
        />
      )}
    </div>
  );
};

export default FocusSession;
