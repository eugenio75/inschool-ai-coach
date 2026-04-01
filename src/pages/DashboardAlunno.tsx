import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Loader2, LogOut, FolderOpen, BarChart3 } from "lucide-react";
import { TeacherAssignments } from "@/components/TeacherAssignments";
import { Button } from "@/components/ui/button";
import { GamificationKPI } from "@/components/GamificationBar";
import { DailyMissions } from "@/components/GamificationBar";
import { StudentActionCards } from "@/components/StudentActionCards";
import { shouldShowCheckin } from "@/pages/EmotionalCheckin";
import { getTasks, getActiveChildProfileId, getChildProfile, deleteTask } from "@/lib/database";
import { isChildSession, clearChildSession, getChildSession } from "@/lib/childSession";
import { CoachPresence } from "@/components/CoachPresence";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { supabase } from "@/integrations/supabase/client";
import { JoinClassPrompt } from "@/components/JoinClassPrompt";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };


const DashboardAlunno = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isChild = isChildSession();
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    if (isChild && shouldShowCheckin()) {
      navigate("/checkin", { replace: true });
    }
  }, [isChild, navigate]);

  useEffect(() => {
    const profileId = getActiveChildProfileId();
    if (!profileId && !isChild) { navigate("/profiles"); return; }

    const load = async () => {
      let currentProfile: any = null;
      if (isChild) {
        const sess = getChildSession();
        if (sess) { currentProfile = sess.profile; setProfile(currentProfile); }
      } else {
        const p = await getChildProfile(profileId!);
        if (p) { currentProfile = p; setProfile(p); }
        else {
          const saved = localStorage.getItem("inschool-profile");
          if (saved) try { currentProfile = JSON.parse(saved); setProfile(currentProfile); } catch {}
        }
      }
      if (currentProfile?.school_level === "alunno" && profileId) {
        const { data } = await supabase.from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
        const prefs = (data?.data as any) || {};
        setShowLibrary(!!prefs.show_library);
      }
      const dbTasks = await getTasks();
      setTasks(dbTasks);
      setLoading(false);
    };
    load();
  }, [navigate, isChild]);

  const handleChildLogout = () => {
    clearChildSession();
    navigate("/auth");
  };

  const name = profile?.name || "Studente";
  const avatarName = profile?.name || "S";
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalMinutes = tasks.reduce((a: number, t: any) => a + (t.estimated_minutes || 0), 0);

  const mapTask = (t: any) => ({
    id: t.id, subject: t.subject, title: t.title, description: t.description || "",
    estimatedMinutes: t.estimated_minutes || 15, difficulty: t.difficulty || 1,
    steps: Array.isArray(t.micro_steps) ? t.micro_steps.length : 0, completed: t.completed || false,
  });

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-8 font-sans">
      <div className="bg-card border-b border-border px-4 sm:px-6 pt-5 sm:pt-6 pb-6 sm:pb-8 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg sm:text-xl font-semibold text-foreground">Inschool</span>
            </div>
            <div className="flex items-center gap-1.5">
              {showLibrary && <button onClick={() => navigate("/libreria")} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors" title="Libreria materiali"><FolderOpen className="w-4 h-4" /></button>}
              
              <button onClick={() => navigate("/student-profile")} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-accent transition-colors text-xs font-bold text-primary" title="Il mio profilo">
                {avatarName.charAt(0).toUpperCase()}
              </button>
              {isChild && (
                <button onClick={handleChildLogout} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors" title="Esci">
                  <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-1">Ciao {name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}!</h1>
                <p className="text-sm sm:text-base text-muted-foreground">{tasks.length > 0 ? "" : "Non ci sono compiti per oggi."}</p>
              </div>
            </div>
            {profile?.id && (
              <div className="mt-2">
                <JoinClassPrompt profileId={profile.id} />
              </div>
            )}
          </motion.div>

          {/* KPI cards */}
          {!loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }} className="mt-4">
              <GamificationKPI />
            </motion.div>
          )}
        </div>
      </div>

      {/* AI Coach - above session cards */}
      <div className="px-4 sm:px-6 mt-4"><div className="max-w-3xl mx-auto">
        {!loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.14 }}>
            <CoachPresence variant="home" />
          </motion.div>
        )}
      </div></div>

      {/* 4 Action Cards */}
      <div className="px-4 sm:px-6 mt-4"><div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.16 }}>
          <h3 className="font-display font-semibold text-foreground text-sm mb-3">Cosa vuoi fare?</h3>
          <StudentActionCards hasTasks={tasks.length > 0} schoolLevel={profile?.school_level || "alunno"} />
        </motion.div>
      </div></div>

      <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
        <BadgeDisplay variant="elementari" />
      </div></div>

      {/* Teacher Assignments */}
      <div className="px-4 sm:px-6 mt-4"><div className="max-w-3xl mx-auto"><TeacherAssignments /></div></div>

      {/* Daily Missions */}
      <div className="px-4 sm:px-6 mt-3"><div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 }}>
          <DailyMissions />
        </motion.div>
      </div></div>


      {/* FAB for desktop (mobile uses BottomNav) */}
      <div className="hidden sm:block fixed bottom-8 right-6 z-50">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate("/add-homework")} className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-hover flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>
      
    </div>
  );
};

export default DashboardAlunno;
