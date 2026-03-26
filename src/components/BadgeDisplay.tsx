import { motion } from "framer-motion";
import { useEarnedBadges, EarnedBadge } from "@/hooks/useEarnedBadges";

type Variant = "elementari" | "medie" | "superiori" | "universitario";

interface BadgeDisplayProps {
  variant?: Variant;
}

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function BadgeItem({ badge, variant }: { badge: EarnedBadge; variant: Variant }) {
  const isYoung = variant === "elementari" || variant === "medie";

  if (isYoung) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring}
        className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3"
      >
        <span className="text-xl">{badge.emoji}</span>
        <span className="text-sm font-semibold text-foreground">{badge.label}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl px-3 py-2"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      <span className="text-xs font-medium text-muted-foreground">{badge.label}</span>
    </motion.div>
  );
}

export function BadgeDisplay({ variant = "elementari" }: BadgeDisplayProps) {
  const { badges, loading } = useEarnedBadges();

  if (loading || badges.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {badges.map((b) => (
        <BadgeItem key={b.id} badge={b} variant={variant} />
      ))}
    </div>
  );
}
