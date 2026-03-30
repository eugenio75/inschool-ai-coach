import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Laptop, Users, Briefcase } from "lucide-react";

export type AuthRole = "studente_scuola" | "universitario" | "docente" | "genitore" | "adulto";

interface RoleSelectorProps {
  onSelect: (role: AuthRole) => void;
}

const roles: { id: AuthRole; icon: React.ReactNode; title: string; description: string; color: string }[] = [
  {
    id: "studente_scuola",
    icon: <BookOpen className="w-7 h-7" />,
    title: "Studente Scuola",
    description: "Elementari, medie o superiori — gestito dal genitore o autonomo se hai più di 14 anni",
    color: "bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-400 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  },
  {
    id: "universitario",
    icon: <GraduationCap className="w-7 h-7" />,
    title: "Studente Universitario",
    description: "Maggiorenne, gestione autonoma del tuo percorso accademico",
    color: "bg-violet-50 text-violet-600 border-violet-200 hover:border-violet-400 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  },
  {
    id: "docente",
    icon: <Laptop className="w-7 h-7" />,
    title: "Docente / Insegnante",
    description: "Gestisci classi, materiali didattici e monitora i tuoi studenti",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-400 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  {
    id: "genitore",
    icon: <Users className="w-7 h-7" />,
    title: "Genitore",
    description: "Crea e gestisci i profili dei tuoi figli, monitora i loro progressi",
    color: "bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-400 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },
  {
    id: "adulto",
    icon: <Briefcase className="w-7 h-7" />,
    title: "Adulto / Professionista",
    description: "Uso personale per formazione continua e aggiornamento professionale",
    color: "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800",
  },
];

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

export function RoleSelector({ onSelect }: RoleSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Chi sei?
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Scegli il tuo profilo per iniziare la registrazione
        </p>
      </div>

      <div className="space-y-3">
        {roles.map((role, i) => (
          <motion.button
            key={role.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: i * 0.06 }}
            onClick={() => onSelect(role.id)}
            className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all duration-150 text-left ${role.color}`}
          >
            <div className="shrink-0 mt-0.5">{role.icon}</div>
            <div className="min-w-0">
              <p className="font-semibold text-[15px] leading-tight">{role.title}</p>
              <p className="text-xs mt-1 opacity-75 leading-relaxed">{role.description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
