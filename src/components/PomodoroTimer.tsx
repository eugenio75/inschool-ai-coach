import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Pause, Play, Coffee, RotateCcw } from "lucide-react";
import { playPomodoroSound } from "@/lib/pomodoroSound";

interface PomodoroTimerProps {
  focusMinutes?: number;
  breakMinutes?: number;
  maxCycles?: number;
  compact?: boolean;
  /** Number of user messages — timer auto-starts when this reaches 1 */
  userMessageCount?: number;
}

export function PomodoroTimer({
  focusMinutes = 25,
  breakMinutes = 5,
  maxCycles = 3,
  compact = false,
  userMessageCount = 0,
}: PomodoroTimerProps) {
  const [seconds, setSeconds] = useState(focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const hasAutoStarted = useRef(false);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [cycle, setCycle] = useState(1);
  const [breakSeconds, setBreakSeconds] = useState(breakMinutes * 60);

  const totalFocusSeconds = focusMinutes * 60;

  // Focus countdown
  useEffect(() => {
    if (!isRunning || phase !== "focus" || seconds <= 0) return;
    const id = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, phase, seconds]);

  // Focus ended → break
  useEffect(() => {
    if (phase === "focus" && seconds <= 0 && isRunning) {
      setIsRunning(false);
      if (cycle >= maxCycles) {
        // Done — just stop
        return;
      }
      setPhase("break");
      setBreakSeconds(breakMinutes * 60);
    }
  }, [seconds, phase, isRunning, cycle, maxCycles, breakMinutes]);

  // Break countdown
  useEffect(() => {
    if (phase !== "break" || breakSeconds <= 0) return;
    const id = setInterval(() => setBreakSeconds(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [phase, breakSeconds]);

  // Break ended → next focus
  useEffect(() => {
    if (phase === "break" && breakSeconds <= 0) {
      setCycle(c => c + 1);
      setSeconds(totalFocusSeconds);
      setPhase("focus");
      setIsRunning(true);
    }
  }, [phase, breakSeconds, totalFocusSeconds]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progress = phase === "focus"
    ? 1 - seconds / totalFocusSeconds
    : 1 - breakSeconds / (breakMinutes * 60);

  const toggleRunning = useCallback(() => {
    if (phase === "focus" && seconds <= 0) {
      // Reset
      setSeconds(totalFocusSeconds);
      setCycle(1);
      setIsRunning(true);
    } else {
      setIsRunning(r => !r);
    }
  }, [phase, seconds, totalFocusSeconds]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setPhase("focus");
    setSeconds(totalFocusSeconds);
    setCycle(1);
    setBreakSeconds(breakMinutes * 60);
  }, [totalFocusSeconds, breakMinutes]);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        {/* Circular progress */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
            <motion.circle
              cx="28" cy="28" r="24" fill="none"
              stroke={phase === "break" ? "hsl(var(--accent))" : "hsl(var(--primary))"}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={150.8}
              animate={{ strokeDashoffset: 150.8 * (1 - progress) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <span className="absolute text-sm font-mono font-bold text-foreground">
            {phase === "break" ? formatTime(breakSeconds) : formatTime(seconds)}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleRunning}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title={isRunning ? "Pausa" : "Avvia"}
            >
              {isRunning ? (
                <Pause className="w-5 h-5 text-foreground" />
              ) : (
                <Play className="w-5 h-5 text-foreground" />
              )}
            </button>

            <button
              onClick={reset}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Reset timer"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </button>

            {phase === "break" && (
              <Coffee className="w-4 h-4 text-accent animate-pulse" />
            )}
          </div>

          {/* Cycle dots */}
          <div className="flex gap-1 justify-center">
            {Array.from({ length: maxCycles }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < cycle ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Full version (not used in chat, but available)
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="2" />
          <motion.circle
            cx="18" cy="18" r="15" fill="none"
            stroke={phase === "break" ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={94.25}
            animate={{ strokeDashoffset: 94.25 * (1 - progress) }}
          />
        </svg>
        <span className="absolute text-lg font-mono font-bold text-foreground">
          {phase === "break" ? formatTime(breakSeconds) : formatTime(seconds)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {phase === "break" ? "Pausa ☕" : `Ciclo ${cycle}/${maxCycles}`}
      </p>
      <div className="flex gap-2">
        <button onClick={toggleRunning} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          {isRunning ? "Pausa" : "Avvia"}
        </button>
        <button onClick={reset} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground">
          Reset
        </button>
      </div>
    </div>
  );
}
