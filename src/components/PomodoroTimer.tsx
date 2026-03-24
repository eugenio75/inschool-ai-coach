import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [phase, setPhase] = useState<"focus" | "break" | "break-done">("focus");
  const [cycle, setCycle] = useState(1);
  const [breakSeconds, setBreakSeconds] = useState(breakMinutes * 60);

  const totalFocusSeconds = focusMinutes * 60;

  // Auto-start after first user message
  useEffect(() => {
    if (userMessageCount >= 1 && !hasAutoStarted.current && !isRunning && phase === "focus" && seconds === totalFocusSeconds) {
      hasAutoStarted.current = true;
      setIsRunning(true);
    }
  }, [userMessageCount, isRunning, phase, seconds, totalFocusSeconds]);

  // Focus countdown
  useEffect(() => {
    if (!isRunning || phase !== "focus" || seconds <= 0) return;
    const id = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, phase, seconds]);

  // Focus ended → break (with sound)
  useEffect(() => {
    if (phase === "focus" && seconds <= 0 && isRunning) {
      setIsRunning(false);
      playPomodoroSound("break");
      if (cycle >= maxCycles) return;
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

  // Break ended → wait for user to resume
  useEffect(() => {
    if (phase === "break" && breakSeconds <= 0) {
      playPomodoroSound("focus");
      setPhase("break-done");
    }
  }, [phase, breakSeconds]);

  const handleResume = useCallback(() => {
    setCycle(c => c + 1);
    setSeconds(totalFocusSeconds);
    setPhase("focus");
    setIsRunning(true);
  }, [totalFocusSeconds]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progress = phase === "focus"
    ? 1 - seconds / totalFocusSeconds
    : phase === "break"
      ? 1 - breakSeconds / (breakMinutes * 60)
      : 1;

  const toggleRunning = useCallback(() => {
    if (phase === "focus" && seconds <= 0) {
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

  const circleSize = compact ? 72 : 96;
  const svgViewBox = compact ? "0 0 72 72" : "0 0 36 36";
  const svgR = compact ? 31 : 15;
  const svgCx = compact ? 36 : 18;
  const svgStroke = compact ? 4 : 2;
  const circumference = 2 * Math.PI * svgR;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Circular progress — bigger */}
        <div className="relative flex items-center justify-center" style={{ width: circleSize, height: circleSize }}>
          <svg className="-rotate-90" width={circleSize} height={circleSize} viewBox={svgViewBox}>
            <circle cx={svgCx} cy={svgCx} r={svgR} fill="none" stroke="hsl(var(--muted))" strokeWidth={svgStroke} />
            <motion.circle
              cx={svgCx} cy={svgCx} r={svgR} fill="none"
              stroke={phase === "focus" ? "hsl(var(--primary))" : "hsl(var(--accent))"}
              strokeWidth={svgStroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: circumference * (1 - progress) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-base font-mono font-bold text-foreground leading-none">
              {phase === "break" ? formatTime(breakSeconds) : phase === "break-done" ? "0:00" : formatTime(seconds)}
            </span>
            {phase === "break" && (
              <span className="text-[9px] text-accent font-semibold mt-0.5">PAUSA</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {/* Break done — show "Riprendi" button */}
          <AnimatePresence mode="wait">
            {phase === "break-done" ? (
              <motion.button
                key="resume"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleResume}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5" /> Riprendi
              </motion.button>
            ) : (
              <motion.div key="controls" className="flex items-center gap-1.5">
                <button
                  onClick={toggleRunning}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
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
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                  title="Reset timer"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>

                {phase === "break" && (
                  <Coffee className="w-5 h-5 text-accent animate-pulse" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cycle dots */}
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: maxCycles }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i < cycle ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="2" />
          <motion.circle
            cx="18" cy="18" r="15" fill="none"
            stroke={phase === "focus" ? "hsl(var(--primary))" : "hsl(var(--accent))"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={94.25}
            animate={{ strokeDashoffset: 94.25 * (1 - progress) }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-mono font-bold text-foreground">
            {phase === "break" ? formatTime(breakSeconds) : phase === "break-done" ? "0:00" : formatTime(seconds)}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {phase === "break" ? "Pausa ☕" : phase === "break-done" ? "Pausa finita!" : `Ciclo ${cycle}/${maxCycles}`}
      </p>
      <div className="flex gap-2">
        {phase === "break-done" ? (
          <button onClick={handleResume} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            Riprendi
          </button>
        ) : (
          <button onClick={toggleRunning} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
            {isRunning ? "Pausa" : "Avvia"}
          </button>
        )}
        <button onClick={reset} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground">
          Reset
        </button>
      </div>
    </div>
  );
}
