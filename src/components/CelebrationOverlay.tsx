import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const softColors = [
  "hsl(var(--primary))",
  "hsl(var(--sage))",
  "hsl(var(--clay))",
];

// Calm, meaningful messages — no hype, just warm acknowledgment
const celebrationMessages = [
  { emoji: "🌟", text: "Ce l'hai fatta!" },
  { emoji: "🌱", text: "Un passo in più." },
  { emoji: "🧠", text: "Ottimo lavoro." },
  { emoji: "📚", text: "Compito completato." },
  { emoji: "✨", text: "Ben fatto." },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
}

interface CelebrationOverlayProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
  points?: number;
}

export const CelebrationOverlay = ({ show, onComplete, message, points }: CelebrationOverlayProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [celebration] = useState(() => 
    celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)]
  );

  useEffect(() => {
    if (!show) return;
    
    // Fewer, softer particles — calm celebration, not overstimulating
    const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * 40, // centered cluster
      y: 20 + Math.random() * 40,
      color: softColors[Math.floor(Math.random() * softColors.length)],
      size: Math.random() * 6 + 3,
      rotation: Math.random() * 180,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => {
      onComplete?.();
    }, 2500);
    return () => clearTimeout(timer);
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          {/* Confetti particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ 
                x: "50vw", 
                y: "50vh", 
                scale: 0,
                rotate: 0,
              }}
              animate={{ 
                x: `${p.x}vw`, 
                y: `${p.y}vh`,
                scale: [0, 1, 0],
                rotate: p.rotation,
                opacity: [0, 0.7, 0],
              }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute rounded-full"
              style={{ 
                width: p.size, 
                height: p.size, 
                backgroundColor: p.color,
              }}
            />
          ))}

          {/* Central message */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
            className="bg-card rounded-3xl shadow-lg px-8 py-6 text-center border border-border"
          >
            <span className="text-5xl block mb-2">{celebration.emoji}</span>
            <p className="font-display text-xl font-bold text-foreground">
              {message || celebration.text}
            </p>
            {points && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm font-bold text-primary mt-1"
              >
                +{points} punti
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Social proof messages - simulated peer activity
const socialProofMessages = [
  "3 studenti stanno studiando in questo momento 📚",
  "Marco ha appena completato una sfida di matematica! 🎯",
  "Oggi 12 studenti hanno già fatto i compiti 💪",
  "Sofia ha raggiunto una streak di 5 giorni! 🔥",
  "I tuoi compagni stanno migliorando, unisciti a loro! 🌟",
  "7 studenti hanno completato le missioni oggi ⚡",
  "Luca ha sbloccato il badge 'Esploratore' 🏅",
  "Oggi è un giorno perfetto per studiare insieme! 🌈",
];

export const SocialProofBanner = () => {
  const [messageIndex, setMessageIndex] = useState(() => 
    Math.floor(Math.random() * socialProofMessages.length)
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMessageIndex(prev => (prev + 1) % socialProofMessages.length);
        setVisible(true);
      }, 500);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 bg-accent/50 rounded-xl px-3 py-2"
        >
          <span className="text-xs text-accent-foreground/80">
            {socialProofMessages[messageIndex]}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Streak shield display
export const StreakShieldBadge = ({ shields }: { shields: number }) => {
  if (shields <= 0) return null;
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="flex items-center gap-1 bg-secondary/20 rounded-xl px-2 py-1"
      title={`${shields} scud${shields === 1 ? 'o' : 'i'} protezione streak`}
    >
      <span className="text-xs">🛡️</span>
      <span className="text-[10px] font-bold text-secondary">{shields}</span>
    </motion.div>
  );
};
