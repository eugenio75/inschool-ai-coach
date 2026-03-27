import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Brain, FolderOpen, BarChart3, LogOut } from "lucide-react";
import { TeacherAssignments } from "@/components/TeacherAssignments";
import { GamificationKPI } from "@/components/GamificationBar";
import { DailyMissions } from "@/components/GamificationBar";
import { CoachPresence } from "@/components/CoachPresence";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { isChildSession, clearChildSession, getChildSession } from "@/lib/childSession";
import { getTasks, getActiveChildProfileId, getChildProfile } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/contexts/LangContext";
import { getPrepLabelKey } from "@/lib/schoolTerms";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function SessionEntryCardsMedie({ hasTasks }: { hasTasks: boolean }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const sessions = [
    {
      id: "guided",
      label: "Studia un compito",
      desc: hasTasks ? "Il coach ti guida passo passo" : "Aggiungi un compito per iniziare",
      color: "bg-primary/10",
      iconColor: "text-primary",
      action: () => navigate(hasTasks ? "/study-tasks" : "/add-homework"),
    },
    {
      id: "review",
      label: "Ripasso",
      desc: "Rivedi quello che hai studiato",
      color: "bg-clay-light",
      iconColor: "text-clay-dark",
      action: () => navigate("/memory"),
    },
    {
      id: "prep",
      label: t(getPrepLabelKey("medie")),
      desc: t("prep_desc"),
      color: "bg-amber-50 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      action: () => navigate("/us?type=prep"),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {sessions.map((s, i) => (
        <motion.button
          key={s.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 + i * 0.05 }}
          onClick={s.action}
          className="flex flex-col items-start p-3.5 rounded-2xl border border-border/60 bg-card hover:shadow-soft transition-all text-left"
        >
          <p className="text-sm font-semibold text-foreground leading-tight mb-0.5">{s.label}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{s.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}

export default function DashboardMedie() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const session = getChildSession();
      if (session?.profile) {
        setProfile(session.profile);
      } else {
        const profileId = getActiveChildProfileId();
        if (profileId) {
          const p = await getChildProfile(profileId);
          if (p) setProfile(p);
        }
      }
      const dbTasks = await getTasks();
      setTasks(dbTasks);
      setLoading(false);
    };
    load();
  }, []);

  const name = profile?.name || "Studente";
  const avatarInitial = (profile?.name || "S").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-8 font-sans">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 sm:px-6 pt-5 sm:pt-6 pb-6 sm:pb-8 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg sm:text-xl font-semibold text-foreground">Inschool</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/report")} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors" title="Il tuo andamento"><BarChart3 className="w-4 h-4" /></button>
              <button onClick={() => navigate("/libreria")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors" title="Libreria materiali"><FolderOpen className="w-4 h-4" /></button>
              <button onClick={() => navigate("/memory")} className="w-9 h-9 rounded-xl bg-clay-light flex items-center justify-center text-clay-dark hover:bg-accent transition-colors" title="Memoria e ripasso"><Brain className="w-4 h-4" /></button>
              <button onClick={() => navigate("/student-profile")} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-accent transition-colors text-xs font-bold text-primary" title="Il mio profilo">
                {avatarInitial}
              </button>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-1">Ciao {name}!</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length > 0 ? `Hai ${tasks.filter(t => !t.completed).length} compiti da fare` : "Nessun compito per oggi."}
            </p>
          </motion.div>

          {!loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }} className="mt-4">
              <GamificationKPI />
            </motion.div>
          )}
        </div>
      </div>

      {/* Coach */}
      <div className="px-4 sm:px-6 mt-4"><div className="max-w-3xl mx-auto">
        {!loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.14 }}>
            <CoachPresence variant="home" />
          </motion.div>
        )}
      </div></div>

      {/* Badges */}
      <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
        <BadgeDisplay variant="medie" />
      </div></div>

      {/* Session entry cards */}
      <div className="px-4 sm:px-6 mt-4"><div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }}>
          <h3 className="font-display font-semibold text-foreground text-sm mb-3">Cosa vuoi fare?</h3>
          <SessionEntryCardsMedie hasTasks={tasks.length > 0} />
        </motion.div>
      </div></div>

      {/* Teacher Assignments */}
      <div className="px-4 sm:px-6 mt-4"><div className="max-w-3xl mx-auto"><TeacherAssignments /></div></div>

      {/* Link to progress */}
      <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
        <button onClick={() => navigate("/progress")} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:border-primary/40 transition-all text-left">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">I tuoi progressi</span>
          </div>
          <span className="text-xs text-primary font-medium">Vedi →</span>
        </button>
      </div></div>

      {/* Daily Missions */}
      <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }}>
          <DailyMissions />
        </motion.div>
      </div></div>

      {/* FAB desktop */}
      <div className="hidden sm:block fixed bottom-8 right-6 z-50">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate("/add-homework")} className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-hover flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  );
}
