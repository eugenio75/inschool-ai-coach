import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, X, Loader2, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressSun } from "@/components/ProgressSun";
import { GuidanceCard, ChatMessage } from "@/components/GuidanceCard";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { getTask, saveFocusSession, updateTask, getActiveChildProfileId, getMemoryItems, getDailyMissions, completeMission } from "@/lib/database";
import { isChildSession, getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type Phase = "checkin" | "breathing" | "focus" | "break" | "recap";

const BREAK_SECONDS = 5 * 60; // 5 minutes
const MAX_POMODORO_CYCLES = 3;

const emotionOptions = [
  { id: "ready", emoji: "😊", label: "Pronto" },
  { id: "tired", emoji: "😴", label: "Stanco" },
  { id: "worried", emoji: "😟", label: "Preoccupato" },
  { id: "bored", emoji: "😐", label: "Annoiato" },
  { id: "frustrated", emoji: "😤", label: "Frustrato" },
];

const breakMessages = [
  "Hai lavorato bene! Riposa gli occhi 👀",
  "Pausa meritata! Alzati e fai due passi 🚶",
  "Bevi un po' d'acqua e rilassati 💧",
  "Guarda fuori dalla finestra per un momento 🌿",
  "Fai qualche respiro profondo 🌬️",
];

const SESSION_KEY_PREFIX = "focus-session-";
const SESSION_VERSION = "v3"; // Bump to invalidate old sessions with stuck greeting

function getSessionState(taskId: string) {
  try {
    const saved = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${taskId}`);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed._version !== SESSION_VERSION) {
      clearSessionState(taskId);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveSessionState(taskId: string, state: any) {
  sessionStorage.setItem(`${SESSION_KEY_PREFIX}${taskId}`, JSON.stringify({ ...state, _version: SESSION_VERSION }));
}

function clearSessionState(taskId: string) {
  sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${taskId}`);
  sessionStorage.removeItem(`focus-chat-${taskId}`);
}

// Generate a soft chime sound using Web Audio API
function playChimeSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 - gentle chord
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 1.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 1.5);
    });
    
    // Clean up context after sounds finish
    setTimeout(() => ctx.close(), 3000);
  } catch (e) {
    console.warn("Could not play chime:", e);
  }
}

const FocusSession = () => {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [weakConcepts, setWeakConcepts] = useState<any[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const chatMessagesRef = useRef<ChatMessage[]>([]);

  // Restore state from sessionStorage if available
  const restored = taskId ? getSessionState(taskId) : null;
  const [phase, setPhase] = useState<Phase>(restored?.phase || "checkin");
  const [emotion, setEmotion] = useState(restored?.emotion || "");
  const [profile, setProfile] = useState<any>(null);
  const [pomodoroCount, setPomodoroCount] = useState(restored?.pomodoroCount || 1);
  const [breakSeconds, setBreakSeconds] = useState(BREAK_SECONDS);
  const [breakMessage] = useState(() => breakMessages[Math.floor(Math.random() * breakMessages.length)]);

  useEffect(() => {
    const load = async () => {
      if (taskId) {
        const t = await getTask(taskId);
        setTask(t);
        // Fetch weak memory items for this subject to reinforce during coaching
        if (t?.subject) {
          const allMemory = await getMemoryItems();
          const weak = allMemory
            .filter((m: any) => m.subject === t.subject && (m.strength || 0) < 60)
            .slice(0, 3);
          setWeakConcepts(weak);
        }
      }
      const saved = localStorage.getItem("inschool-profile");
      if (saved) try { setProfile(JSON.parse(saved)); } catch {}
      setLoading(false);
    };
    load();
  }, [taskId]);

  const focusMinutes = profile?.focusTime ? parseInt(profile.focusTime) : (task?.estimated_minutes || 15);
  const [seconds, setSeconds] = useState(restored?.seconds ?? focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(restored?.isRunning || false);
  const [breathCount, setBreathCount] = useState(0);

  // Only reset seconds when focusMinutes changes AND there's no restored state
  useEffect(() => {
    if (!restored) setSeconds(focusMinutes * 60);
  }, [focusMinutes]);

  const totalSeconds = focusMinutes * 60;
  const totalWorkedSeconds = (pomodoroCount - 1) * totalSeconds + (totalSeconds - seconds);
  const progress = 1 - seconds / totalSeconds;

  // Focus timer countdown
  useEffect(() => {
    if (!isRunning || seconds <= 0 || phase !== "focus") return;
    const interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning, seconds, phase]);

  // Detect timer reaching 0 → trigger break
  useEffect(() => {
    if (phase === "focus" && seconds <= 0 && isRunning) {
      setIsRunning(false);
      if (pomodoroCount >= MAX_POMODORO_CYCLES) {
        // Max cycles reached, suggest ending
        endSession();
      } else {
        // Start break
        playChimeSound();
        setPhase("break");
        setBreakSeconds(BREAK_SECONDS);
      }
    }
  }, [seconds, phase, isRunning, pomodoroCount]);

  // Break timer countdown
  useEffect(() => {
    if (phase !== "break" || breakSeconds <= 0) return;
    const interval = setInterval(() => setBreakSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [phase, breakSeconds]);

  // Break timer reaching 0 → restart focus
  useEffect(() => {
    if (phase === "break" && breakSeconds <= 0) {
      playChimeSound();
      resumeAfterBreak();
    }
  }, [breakSeconds, phase]);

  // Persist state on every change
  useEffect(() => {
    if (taskId && phase !== "recap") {
      saveSessionState(taskId, { phase, emotion, seconds, isRunning, pomodoroCount });
    }
  }, [phase, emotion, seconds, isRunning, taskId, pomodoroCount]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const startBreathing = () => {
    setPhase("breathing");
    setBreathCount(0);
    const timer = setInterval(() => {
      setBreathCount((c) => {
        if (c >= 3) { clearInterval(timer); setPhase("focus"); setIsRunning(true); return c; }
        return c + 1;
      });
    }, 4000);
  };

  const resumeAfterBreak = () => {
    setPomodoroCount((c: number) => c + 1);
    setSeconds(totalSeconds);
    setPhase("focus");
    setIsRunning(true);
  };

  const handleMessagesChange = useCallback((msgs: ChatMessage[]) => {
    chatMessagesRef.current = msgs;
  }, []);

  const extractAndSaveConcepts = async () => {
    const messages = chatMessagesRef.current;
    if (messages.length < 3) return;

    setExtracting(true);
    try {
      const childSession = getChildSession();
      const childProfileId = getActiveChildProfileId();

      const body: any = {
        chatMessages: messages.map(m => ({ role: m.role, text: m.text })),
        taskSubject: task?.subject,
        taskTitle: task?.title,
      };

      const headers: any = {
        "Content-Type": "application/json",
      };

      if (childSession) {
        body.accessCode = childSession.accessCode;
        body.childProfileId = childSession.profileId;
      } else {
        body.childProfileId = childProfileId;
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      headers.apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-concepts`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );
    } catch (err) {
      console.error("Failed to extract concepts:", err);
    } finally {
      setExtracting(false);
    }
  };

  const handleExit = () => {
    if (taskId) clearSessionState(taskId);
    navigate("/dashboard");
  };

  const endSession = async () => {
    setIsRunning(false);
    const minutesWorked = Math.round(totalWorkedSeconds / 60);

    if (minutesWorked < 5) {
      handleExit();
      return;
    }
    
    setPhase("recap");
    setShowCelebration(true);
    await saveFocusSession({
      task_id: task?.id,
      emotion,
      duration_seconds: totalWorkedSeconds,
      focus_points: minutesWorked * 2,
      autonomy_points: Math.round(minutesWorked * 0.5),
      consistency_points: 1,
    });

    if (task?.id) {
      await updateTask(task.id, { completed: true });
    }

    await extractAndSaveConcepts();

    try {
      const missions = await getDailyMissions();
      for (const mission of missions) {
        if (mission.completed) continue;
        const t = mission.mission_type;
        if (t === "study_session") {
          await completeMission(mission.id, mission.points_reward);
        }
        if (t === "complete_task" && task?.id) {
          await completeMission(mission.id, mission.points_reward);
        }
        if (t === "study_minutes" && minutesWorked >= 10) {
          await completeMission(mission.id, mission.points_reward);
        }
      }
    } catch (err) {
      console.error("Mission completion error:", err);
    }

    if (taskId) clearSessionState(taskId);
  };

  const minutesWorked = Math.round(totalWorkedSeconds / 60);
  const studentName = profile?.name || "campione";
  const taskTitle = task?.title || "il tuo compito";
  const taskSubject = task?.subject || "";

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <CelebrationOverlay 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        points={minutesWorked * 2}
        schoolLevel={profile?.schoolLevel || profile?.school_level}
      />
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{taskSubject}</p>
          <p className="text-sm font-display font-semibold text-foreground">{taskTitle}</p>
        </div>
        <button onClick={handleExit} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
      </div>

      {/* Break overlay */}
      <AnimatePresence>
        {phase === "break" && (
          <motion.div
            key="break-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={spring}
              className="text-center max-w-sm mx-auto px-6"
            >
              {/* Pulsating coffee icon */}
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mx-auto mb-6"
              >
                <Coffee className="w-10 h-10 text-accent-foreground" />
              </motion.div>

              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Fai una pausa! ☕
              </h2>
              <p className="text-muted-foreground mb-6">{breakMessage}</p>

              {/* Break countdown */}
              <div className="bg-card rounded-2xl border border-border px-6 py-4 mb-6">
                <p className="text-xs text-muted-foreground mb-1">La pausa finisce tra</p>
                <p className="font-display text-4xl font-bold text-foreground tabular-nums">
                  {formatTime(breakSeconds)}
                </p>
              </div>

              {/* Pomodoro cycle indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {Array.from({ length: MAX_POMODORO_CYCLES }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      i < pomodoroCount ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  Ciclo {pomodoroCount}/{MAX_POMODORO_CYCLES}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={resumeAfterBreak}
                  className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base"
                >
                  Riprendi subito
                </Button>
                <Button
                  onClick={endSession}
                  variant="outline"
                  className="rounded-2xl py-5 border-border"
                >
                  Ho finito, termina sessione
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase !== "focus" && phase !== "break" ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start sm:justify-center px-4 sm:px-6 pt-3 pb-16">
          <AnimatePresence mode="wait">
            {phase === "checkin" && (
              <motion.div key="checkin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={spring} className="max-w-md w-full text-center pb-3">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-1.5">Come ti senti adesso?</h2>
                <p className="text-muted-foreground mb-4 sm:mb-6">Non c'è una risposta giusta. Dimmi come stai.</p>
                <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                  {emotionOptions.map((e) => (
                    <button key={e.id} onClick={() => setEmotion(e.id)} className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border transition-all ${emotion === e.id ? "border-primary bg-sage-light shadow-soft" : "border-border bg-card hover:bg-muted"}`}>
                      <span className="text-xl sm:text-2xl">{e.emoji}</span>
                      <span className="text-xs font-medium text-foreground">{e.label}</span>
                    </button>
                  ))}
                </div>
                <Button onClick={startBreathing} disabled={!emotion} className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl px-8 py-4 sm:py-5 text-base disabled:opacity-40">Sono pronto</Button>
              </motion.div>
            )}

            {phase === "breathing" && (
              <motion.div key="breathing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring} className="text-center">
                <h2 className="font-display text-xl font-bold text-foreground mb-8">Facciamo 3 respiri profondi</h2>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="w-32 h-32 rounded-full bg-sage-light border-2 border-primary/30 mx-auto flex items-center justify-center">
                  <span className="text-3xl font-display font-bold text-primary animate-pulse-soft">{breathCount + 1}</span>
                </motion.div>
                <p className="text-muted-foreground mt-6">Inspira... ed espira...</p>
              </motion.div>
            )}

            {phase === "recap" && (
              <motion.div key="recap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={spring} className="text-center max-w-md w-full">
                <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-6"><span className="text-3xl">🌟</span></div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">Bravissimo, {studentName}!</h2>
                <p className="text-muted-foreground mb-2">
                  Hai lavorato per {minutesWorked} minuti su {taskTitle}
                  {pomodoroCount > 1 ? ` (${pomodoroCount} cicli)` : ""}.
                </p>
                
                {extracting && (
                  <div className="flex items-center justify-center gap-2 my-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvo i concetti nella tua memoria...</span>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-3 my-6">
                  <div className="bg-sage-light rounded-xl p-3 text-center">
                    <p className="text-lg font-display font-bold text-sage-dark">+{minutesWorked * 2}</p>
                    <p className="text-[10px] text-sage-dark/80">impegno</p>
                  </div>
                  <div className="bg-clay-light rounded-xl p-3 text-center">
                    <p className="text-lg font-display font-bold text-clay-dark">+{Math.round(minutesWorked * 0.5)}</p>
                    <p className="text-[10px] text-clay-dark/80">indipendenza</p>
                  </div>
                  <div className="bg-terracotta-light rounded-xl p-3 text-center">
                    <p className="text-lg font-display font-bold text-terracotta">+1</p>
                    <p className="text-[10px] text-terracotta/80">costanza</p>
                  </div>
                </div>
                <p className="text-sm text-sage-dark font-medium mb-4">Hai dimostrato costanza e impegno. 🌱</p>
                
                {!extracting && (
                  <p className="text-xs text-muted-foreground mb-4">I concetti studiati sono stati salvati in Memoria e Ripasso 🧠</p>
                )}
                
                <div className="flex flex-col gap-3">
                  <Button onClick={() => navigate("/memory")} variant="outline" className="rounded-2xl py-5 border-border">
                    <span className="mr-2">🧠</span> Vai a Memoria e Ripasso
                  </Button>
                  <Button onClick={() => navigate(`/homework/${task?.id}`)} variant="outline" className="rounded-2xl py-5 border-border">Vedi dettagli compito</Button>
                  <Button onClick={() => navigate("/dashboard")} className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5">Torna ai compiti</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : phase === "focus" ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Timer + controls - compact row at top */}
          <motion.div
            key="focus"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="px-4 pt-2 pb-3 shrink-0"
          >
            <div className="flex flex-col gap-3 items-center">
              <div className="flex items-center justify-center gap-3">
                <ProgressSun progress={progress} size={56} />
                <div className="text-left">
                  <p className="font-display text-3xl font-bold text-foreground tabular-nums">{formatTime(seconds)}</p>
                  <p className="text-xs text-muted-foreground">
                    {pomodoroCount > 1 && <span className="text-primary font-medium mr-1">Ciclo {pomodoroCount}</span>}
                    {progress < 0.25 ? "Stai andando benissimo." : progress < 0.5 ? "Ottimo ritmo!" : progress < 0.75 ? "Più di metà! 💪" : "Quasi finito!"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 w-full">
                <Button variant="outline" size="sm" onClick={() => setIsRunning(!isRunning)} className="rounded-lg border-border px-3 py-1.5 text-xs h-auto">
                  {isRunning ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                  {isRunning ? "Pausa" : "Riprendi"}
                </Button>
                <Button size="sm" onClick={endSession} className="bg-primary text-primary-foreground hover:bg-sage-dark rounded-lg px-3 py-1.5 text-xs h-auto">Fine</Button>
              </div>
            </div>
          </motion.div>

          {/* Coach card - inline, not fixed overlay */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            <GuidanceCard
              emotion={emotion}
              taskTitle={taskTitle}
              taskSubject={taskSubject}
              sessionKey={taskId}
              onMessagesChange={handleMessagesChange}
              weakConcepts={weakConcepts}
              taskContext={task ? {
                title: task.title,
                subject: task.subject,
                description: task.description,
                sourceType: task.source_type,
                keyConcepts: task.key_concepts,
                microSteps: task.micro_steps,
                difficulty: task.difficulty,
                sourceImageUrl: task.source_image_url,
              } : undefined}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FocusSession;
