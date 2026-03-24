import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, PenLine, Brain, GraduationCap } from "lucide-react";
import { isChildSession, getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function getPrepLabel(schoolLevel: string): string {
  switch (schoolLevel) {
    case "alunno": return "Prepara l'interrogazione";
    case "medie": return "Prepara l'interrogazione";
    case "superiori": return "Prepara la verifica";
    case "universitario": return "Prepara l'esame";
    default: return "Prepara la prova";
  }
}

interface SessionEntryCardsProps {
  hasTasks: boolean;
}

export function SessionEntryCards({ hasTasks }: SessionEntryCardsProps) {
  const navigate = useNavigate();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";

  const sessions = [
    {
      id: "guided",
      label: "Studia un compito",
      desc: "Apri un compito e il coach ti guida passo passo",
      icon: PenLine,
      color: "bg-primary/10 text-primary",
      iconColor: "text-primary",
      action: () => navigate("/study-tasks"),
      disabled: false,
    },
    {
      id: "study",
      label: "Studio libero",
      desc: "Scegli un argomento e approfondisci con il coach",
      icon: BookOpen,
      color: "bg-sage-light text-sage-dark",
      iconColor: "text-sage-dark",
      action: () => navigate("/us?type=study"),
      disabled: false,
    },
    {
      id: "review",
      label: "Ripasso",
      desc: "Rivedi quello che hai studiato e rafforza la memoria",
      icon: Brain,
      color: "bg-clay-light text-clay-dark",
      iconColor: "text-clay-dark",
      action: () => navigate("/memory"),
      disabled: false,
    },
    {
      id: "prep",
      label: getPrepLabel(schoolLevel),
      desc: "Simulazione calibrata sui tuoi punti deboli",
      icon: GraduationCap,
      color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      iconColor: "text-amber-600 dark:text-amber-400",
      action: () => navigate("/us?type=prep"),
      disabled: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {sessions.map((s, i) => (
        <motion.button
          key={s.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 + i * 0.05 }}
          onClick={s.action}
          disabled={s.disabled}
          className={`flex flex-col items-start p-3.5 rounded-2xl border border-border/60 bg-card hover:shadow-soft transition-all text-left group disabled:opacity-40`}
        >
          <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-2.5`}>
            <s.icon className={`w-4.5 h-4.5 ${s.iconColor}`} />
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight mb-0.5">{s.label}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{s.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}
