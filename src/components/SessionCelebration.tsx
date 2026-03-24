import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionCelebrationProps {
  isVisible: boolean;
  onClose: () => void;
  onGoToReview?: () => void;
  studentName: string;
  bloomLevel: number;
  subject: string;
  isJunior?: boolean;
}

const CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "#F59E0B",
  "#22C55E",
  "#EF4444",
  "#8B5CF6",
  "#0EA5E9",
];

export function SessionCelebration({
  isVisible,
  onClose,
  onGoToReview,
  studentName,
  bloomLevel,
  subject,
  isJunior = false,
}: SessionCelebrationProps) {
  const particleCount = isJunior ? 20 : 12;

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

  const Icon = isJunior ? Trophy : Star;
  const title = "Sessione completata!";
  const body = isJunior
    ? `Fantastico! Hai ragionato alla grande oggi!`
    : `${studentName}, hai ragionato davvero bene oggi.`;

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

          {/* Central card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-card rounded-2xl shadow-2xl p-10 max-w-md text-center relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated icon */}
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`mx-auto mb-4 flex items-center justify-center rounded-2xl bg-amber-100 ${isJunior ? "w-[72px] h-[72px]" : "w-16 h-16"}`}
            >
              <Icon className={`text-amber-500 ${isJunior ? "w-10 h-10" : "w-8 h-8"}`} />
            </motion.div>

            <h2 className="font-display text-2xl font-bold text-foreground mb-2">{title}</h2>
            <p className="text-muted-foreground text-sm mb-4">{body}</p>

            {subject && (
              <p className="text-xs text-muted-foreground mb-4">
                {subject} · Bloom L{bloomLevel} raggiunto
              </p>
            )}

            {/* Bloom progress bar */}
            {bloomLevel > 0 && (
              <div className="mb-6">
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
                <p className="text-xs text-primary font-semibold mt-1.5">Bloom L{bloomLevel}</p>
              </div>
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
