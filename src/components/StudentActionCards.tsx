import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, MessageSquare, Brain, Target } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { getPrepLabelKey } from "@/lib/schoolTerms";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface StudentActionCardsProps {
  hasTasks: boolean;
  schoolLevel?: string;
  coachName?: string;
}

export function StudentActionCards({ hasTasks, schoolLevel = "medie", coachName }: StudentActionCardsProps) {
  const navigate = useNavigate();
  const { t } = useLang();

  const coachLabel = coachName
    ? `${t("action_study_with")} ${coachName}`
    : t("action_free_study");

  const cards = [
    {
      id: "tasks",
      emoji: "📚",
      icon: BookOpen,
      label: t("action_my_tasks"),
      desc: t("action_my_tasks_desc"),
      action: () => navigate(hasTasks ? "/study-tasks" : "/add-homework"),
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      id: "coach",
      emoji: "💬",
      icon: MessageSquare,
      label: coachLabel,
      desc: t("action_free_study_desc"),
      action: () => navigate("/us?type=study"),
      color: "bg-sage-light",
      iconColor: "text-sage-dark",
    },
    {
      id: "review",
      emoji: "🔄",
      icon: Brain,
      label: t("nav_review"),
      desc: t("action_review_desc"),
      action: () => navigate("/memory"),
      color: "bg-clay-light",
      iconColor: "text-clay-dark",
    },
    {
      id: "prep",
      emoji: "🎯",
      icon: Target,
      label: t(getPrepLabelKey(schoolLevel)),
      desc: t("action_prep_desc"),
      action: () => navigate("/prep"),
      color: "bg-amber-50 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map((card, i) => (
        <motion.button
          key={card.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.08 + i * 0.04 }}
          onClick={card.action}
          className="flex flex-col items-start p-3.5 rounded-2xl border border-border/60 bg-card hover:shadow-soft transition-all text-left group"
        >
          <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center mb-2`}>
            <card.icon className={`w-4 h-4 ${card.iconColor}`} />
          </div>
          <p className="text-[13px] font-semibold text-foreground leading-tight mb-0.5">{card.label}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{card.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}
