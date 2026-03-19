import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles, BookOpen, Brain, Lightbulb, Trophy, Shield } from "lucide-react";

const softColors = [
  "hsl(var(--primary))",
  "hsl(var(--sage))",
  "hsl(var(--clay))",
];

// Age-appropriate celebration messages
const primaryMessages = [
  { icon: Star, text: "Ce l'hai fatta!" },
  { icon: Sparkles, text: "Fantastico!" },
  { icon: Trophy, text: "Bravissimo!" },
  { icon: Star, text: "Che campione!" },
  { icon: Sparkles, text: "Stupendo!" },
  { icon: Trophy, text: "Super lavoro!" },
];

const middleMessages = [
  { icon: Sparkles, text: "Ottimo lavoro." },
  { icon: BookOpen, text: "Esercizio completato." },
  { icon: Brain, text: "Ben fatto." },
  { icon: Star, text: "Un passo in più." },
  { icon: Lightbulb, text: "Obiettivo raggiunto." },
];

function isPrimary(schoolLevel?: string): boolean {
  if (!schoolLevel) return false;
  const s = schoolLevel.toLowerCase();
  return s.includes("primaria") || s.includes("elementar");
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  shape: "circle" | "star" | "square";
}

interface CelebrationOverlayProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
  points?: number;
  schoolLevel?: string;
}

export const CelebrationOverlay = ({ show, onComplete, message, points, schoolLevel }: CelebrationOverlayProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const primary = isPrimary(schoolLevel);
  
  const messages = primary ? primaryMessages : middleMessages;
  const [celebration] = useState(() => 
    messages[Math.floor(Math.random() * messages.length)]
  );

  useEffect(() => {
    if (!show) return;
    
    const particleCount = primary ? 16 : 8;
    const spread = primary ? 20 : 30;
    const shapes: Array<"circle" | "star" | "square"> = primary 
      ? ["circle", "star", "square"] 
      : ["circle"];
    
    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: spread + Math.random() * (100 - spread * 2),
      y: 10 + Math.random() * 60,
      color: softColors[Math.floor(Math.random() * softColors.length)],
      size: primary ? Math.random() * 10 + 4 : Math.random() * 6 + 3,
      rotation: Math.random() * 360,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    }));
    setParticles(newParticles);

    const duration = primary ? 3200 : 2200;
    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, onComplete, primary]);

  const getParticleStyle = (p: Particle) => {
    const base: React.CSSProperties = { backgroundColor: p.color };
    if (p.shape === "star") {
      return {
        ...base,
        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
        width: p.size * 1.5,
        height: p.size * 1.5,
      };
    }
    if (p.shape === "square") {
      return { ...base, borderRadius: 2, width: p.size, height: p.size };
    }
    return { ...base, borderRadius: "50%", width: p.size, height: p.size };
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          {/* Particles */}
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
                scale: primary ? [0, 1.2, 0] : [0, 1, 0],
                rotate: p.rotation,
                opacity: primary ? [0, 0.9, 0] : [0, 0.7, 0],
              }}
              transition={{ 
                duration: primary ? 2.5 : 2, 
                ease: "easeOut",
                delay: primary ? Math.random() * 0.3 : 0,
              }}
              className="absolute"
              style={getParticleStyle(p)}
            />
          ))}

          {/* Central message */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: primary ? 0.5 : 0.6, ease: "easeOut" }}
            className="bg-card rounded-3xl shadow-lg px-8 py-6 text-center border border-border"
          >
            <motion.div 
              className={`flex items-center justify-center mb-2 ${primary ? "w-16 h-16" : "w-14 h-14"} rounded-2xl bg-primary/10 mx-auto`}
              animate={primary ? { 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <celebration.icon className={`${primary ? "w-8 h-8" : "w-7 h-7"} text-primary`} />
            </motion.div>
            <p className={`font-display font-bold text-foreground ${primary ? "text-2xl" : "text-xl"}`}>
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

// Social proof — cooperative, class-oriented, never competitive
const socialProofMessages = [
  "La tua classe ha completato 18 missioni questa settimana 📚",
  "Insieme avete studiato per 3 ore oggi! 🌱",
  "I tuoi compagni stanno lavorando sodo — unisciti a loro! 💪",
  "La classe ha ripassato 12 concetti questa settimana 🧠",
  "Oggi è un buon giorno per studiare insieme! 🌈",
  "Insieme si impara meglio — la tua classe sta crescendo! ✨",
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
