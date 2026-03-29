import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PointsEarned {
  focus: number;
  autonomy: number;
  consistency: number;
}

interface SessionCelebrationProps {
  isVisible: boolean;
  onClose: () => void;
  onGoToReview?: () => void;
  studentName: string;
  bloomLevel: number;
  subject: string;
  isJunior?: boolean;
  pointsEarned?: PointsEarned;
  totalPoints?: number;
  previousTotalPoints?: number;
  maxPointsPossible?: number;
  streak?: number;
}

const CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "#F59E0B",
  "#22C55E",
  "#EF4444",
  "#8B5CF6",
  "#0EA5E9",
];

function AnimatedCounter({ value, duration = 1000, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value <= 0) { setDisplay(0); return; }
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, duration, delay]);
  return <>{display}</>;
}

function getSessionLabel(total: number) {
  if (total >= 35) return { text: "Sessione perfetta! ⭐", tier: "gold" as const };
  if (total >= 25) return { text: "Ottimo lavoro! 💪", tier: "green" as const };
  return { text: "Continua così! 🚀", tier: "blue" as const };
}

const tierGradients = {
  gold: "from-amber-400 to-yellow-500",
  green: "from-emerald-400 to-green-500",
  blue: "from-sky-400 to-blue-500",
};

export function SessionCelebration({
  isVisible,
  onClose,
  onGoToReview,
  studentName,
  bloomLevel,
  subject,
  isJunior = false,
  pointsEarned,
  totalPoints,
  previousTotalPoints,
  maxPointsPossible = 40,
  streak,
}: SessionCelebrationProps) {
  const hasPoints = !!pointsEarned;
  const earnedTotal = pointsEarned ? pointsEarned.focus + pointsEarned.autonomy + pointsEarned.consistency : 0;
  const isPerfect = earnedTotal >= 35;
  const particleCount = isPerfect ? 30 : isJunior ? 20 : 12;

  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100 - 50,
        y: -(Math.random() * 200 + 100),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.4,
        rotation: Math.random() * 720 - 360,
        size: Math.random() * 6 + 4,
      })),
    [particleCount]
  );

  const flyingTexts = useMemo(() => {
    if (!isPerfect) return [];
    return [
      { text: `+${earnedTotal}!`, x: -80, delay: 0.3 },
      { text: "⭐", x: 0, delay: 0.5 },
      { text: "TOP!", x: 80, delay: 0.7 },
    ];
  }, [isPerfect, earnedTotal]);

  const Icon = isJunior ? Trophy : Star;
  const title = "Sessione completata!";
  const body = isJunior
    ? `Fantastico! Hai ragionato alla grande oggi!`
    : `${studentName}, hai ragionato davvero bene oggi.`;

  const sessionLabel = hasPoints ? getSessionLabel(earnedTotal) : null;

  const pointBadges = hasPoints
    ? [
        { label: "Concentrazione", value: pointsEarned!.focus, emoji: "🎯" },
        { label: "Autonomia", value: pointsEarned!.autonomy, emoji: "🧠" },
        { label: "Costanza", value: pointsEarned!.consistency, emoji: "🔥" },
      ]
    : [];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm"
        >
          {/* Confetti particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
              animate={{
                x: p.x * 4,
                y: p.y,
                opacity: [1, 1, 0],
                rotate: p.rotation,
                scale: [0, 1.2, 0.8],
              }}
              transition={{ duration: 2, delay: p.delay, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 rounded-sm"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
            />
          ))}

          {/* Flying texts for perfect score */}
          {flyingTexts.map((ft, i) => (
            <motion.div
              key={`fly-${i}`}
              initial={{ y: 0, opacity: 1, scale: 0.5 }}
              animate={{ y: -250, opacity: [1, 1, 0], scale: [0.5, 1.5, 1] }}
              transition={{ duration: 2, delay: ft.delay, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 text-3xl font-black text-amber-400 pointer-events-none z-20"
              style={{ marginLeft: ft.x }}
            >
              {ft.text}
            </motion.div>
          ))}

          {/* Central card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-card rounded-2xl shadow-2xl p-8 max-w-md w-[95vw] text-center relative z-10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated icon */}
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`mx-auto mb-3 flex items-center justify-center rounded-2xl bg-amber-100 ${isJunior ? "w-[72px] h-[72px]" : "w-16 h-16"}`}
            >
              <Icon className={`text-amber-500 ${isJunior ? "w-10 h-10" : "w-8 h-8"}`} />
            </motion.div>

            <h2 className="font-display text-2xl font-bold text-foreground mb-1">{title}</h2>
            <p className="text-muted-foreground text-sm mb-3">{body}</p>

            {subject && (
              <p className="text-xs text-muted-foreground mb-3">
                {subject} · Bloom L{bloomLevel} raggiunto
              </p>
            )}

            {/* Bloom progress bar */}
            {bloomLevel > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>L1</span>
                  <span>L6</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(bloomLevel / 6) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
                <p className="text-xs text-primary font-semibold mt-1">Bloom L{bloomLevel}</p>
              </div>
            )}

            {/* Points section — only if pointsEarned is provided */}
            {hasPoints && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mb-4"
              >
                {/* Three point badges */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {pointBadges.map((badge, idx) => (
                    <motion.div
                      key={badge.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9 + idx * 0.15 }}
                      className="bg-muted/50 rounded-xl p-2.5 flex flex-col items-center gap-1"
                    >
                      <span className="text-lg">{badge.emoji}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{badge.label}</span>
                      <span className="text-xl font-black text-foreground">
                        +<AnimatedCounter value={badge.value} delay={1000 + idx * 150} />
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Streak badge */}
                {streak !== undefined && streak >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.4 }}
                    className="flex items-center justify-center gap-1.5 mb-3 text-sm font-semibold text-foreground"
                  >
                    <span>🔥</span>
                    <span>Streak: {streak} giorni</span>
                  </motion.div>
                )}

                {/* Session progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Punti sessione</span>
                    <span>
                      <AnimatedCounter value={earnedTotal} delay={1200} /> / {maxPointsPossible}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((earnedTotal / maxPointsPossible) * 100, 100)}%` }}
                      transition={{ duration: 1.2, delay: 1, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${tierGradients[sessionLabel!.tier]}`}
                    />
                  </div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.2 }}
                    className="text-xs font-semibold mt-1.5 text-foreground"
                  >
                    {sessionLabel!.text}
                  </motion.p>
                </div>

                {/* Total points */}
                {totalPoints !== undefined && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.5 }}
                    className="text-xs text-muted-foreground"
                  >
                    Totale punti:{" "}
                    <span className="font-bold text-foreground">
                      <AnimatedCounter
                        value={totalPoints}
                        delay={2500}
                        duration={800}
                      />
                    </span>
                  </motion.p>
                )}
              </motion.div>
            )}

            <div className="flex flex-col gap-2">
              {onGoToReview && (
                <Button onClick={onGoToReview} variant="outline" className="w-full gap-2">
                  <Brain className="w-4 h-4" /> Ripassa e Rafforza
                </Button>
              )}
              <Button onClick={onClose} className="w-full">
                Torna alla home
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
