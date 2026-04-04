import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, MessageSquare, Brain, Target, Plus } from "lucide-react";
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
      emoji: hasTasks ? "📚" : "➕",
      icon: hasTasks ? BookOpen : Plus,
      label: hasTasks ? t("action_my_tasks") : t("action_add_task"),
      desc: hasTasks ? t("action_my_tasks_desc") : t("action_no_tasks_desc"),
      action: () => navigate(hasTasks ? "/study-tasks" : "/add-homework"),
      color: hasTasks ? "bg-primary/10" : "bg-muted",
      iconColor: hasTasks ? "text-primary" : "text-muted-foreground",
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
          className="flex flex-col items-center text-center p-4 min-h-[130px] rounded-2xl border border-border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
        >
          <div className={`w-12 h-12 rounded-2xl ${card.color} flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform`}>
            <card.icon className={`w-6 h-6 ${card.iconColor}`} />
          </div>
          <p className="text-sm font-bold text-foreground leading-tight mb-0.5">{card.label}</p>
          <p className="text-xs text-muted-foreground leading-snug">{card.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}
