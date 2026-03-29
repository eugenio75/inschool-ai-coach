import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { getDailyThought } from "@/lib/pensieriBene";
import { useLang } from "@/contexts/LangContext";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface PensieroDiBeneProps {
  schoolLevel: string | null | undefined;
}

export function PensieroDiBene({ schoolLevel }: PensieroDiBeneProps) {
  const { lang, t } = useLang();
  const thought = getDailyThought(schoolLevel, lang);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.16 }}
      className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3"
    >
      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {t("pensiero_del_giorno")}
        </p>
        <p className="text-sm text-foreground leading-relaxed italic">"{thought}"</p>
      </div>
    </motion.div>
  );
}
