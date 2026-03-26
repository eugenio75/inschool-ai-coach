import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2, GraduationCap, Clock, TrendingUp, Brain } from "lucide-react";
import { getActiveChildProfileId, getChildProfile, getFocusSessions, getGamification, getMemoryItems, getTasks, getDailyMissions, getEmotionalAlerts } from "@/lib/database";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

import { DailySnapshotCard } from "@/components/parent/DailySnapshotCard";
import { ProgressCard } from "@/components/parent/ProgressCard";
import { EmotionalCard } from "@/components/parent/EmotionalCard";
import { CognitiveCard } from "@/components/parent/CognitiveCard";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function getSchoolLevel(profile: any): string {
  return profile?.school_level || "superiori";
}

const StudentReport = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [emotionalAlerts, setEmotionalAlerts] = useState<any[]>([]);
  // University-specific
  const [esami, setEsami] = useState<any[]>([]);
  const [sessioniStudio, setSessioniStudio] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      let profileData: any = null;
      if (isChildSession()) {
        const session = getChildSession();
        profileData = session?.profile || null;
      } else {
        const profileId = getActiveChildProfileId();
        if (!profileId) { navigate(-1); return; }
        profileData = await getChildProfile(profileId);
      }
      if (!profileData) { navigate(-1); return; }
      setProfile(profileData);

      const [g, s, m, t, dm, alerts] = await Promise.all([
        getGamification(profileData.id),
        getFocusSessions(profileData.id),
        getMemoryItems(profileData.id),
        getTasks(profileData.id),
        getDailyMissions(profileData.id),
        getEmotionalAlerts(profileData.id),
      ]);
      setGamification(g);
      setSessions(s);
      setMemoryItems(m);
      setTasks(t);
      setMissions(dm);
      setEmotionalAlerts(alerts);

      // University: load exams and study sessions
      if (getSchoolLevel(profileData) === "universitario") {
        const [esamiRes, sessStudioRes] = await Promise.all([
          (supabase as any).from("esami_utente").select("*").eq("profile_id", profileData.id).eq("completato", false).order("data_prevista", { ascending: true }),
          (supabase as any).from("sessioni_studio").select("*").eq("profile_id", profileData.id).order("created_at", { ascending: false }).limit(50),
        ]);
        setEsami(esamiRes.data || []);
        setSessioniStudio(sessStudioRes.data || []);
      }

      setLoading(false);
    };
    load();
  }, [navigate]);

  // Fetch AI insights once data is loaded
  useEffect(() => {
    if (!profile || loading) return;

    const fetchInsights = async () => {
      setInsightsLoading(true);
      setAiInsights([]);
      try {
        const totalMinutes = sessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);
        const recentSessions = sessions.slice(0, 15).map(s => {
          const task = tasks.find(t => t.id === s.task_id);
          const expectedMinutes = task?.estimated_minutes || 15;
          const actualMinutes = Math.round((s.duration_seconds || 0) / 60);
          return { ...s, subject: task?.subject || "N/A", task_title: task?.title || "N/A", expected_minutes: expectedMinutes, actual_minutes: actualMinutes, studied_extra: actualMinutes > expectedMinutes };
        });
        const allConcepts = memoryItems.map(m => ({ ...m, is_weak: (m.strength || 0) < 60, is_strong: (m.strength || 0) >= 80 }));
        const subjectStats: Record<string, { sessions: number; totalMinutes: number; completed: number; total: number }> = {};
        for (const task of tasks) {
          if (!subjectStats[task.subject]) subjectStats[task.subject] = { sessions: 0, totalMinutes: 0, completed: 0, total: 0 };
          subjectStats[task.subject].total++;
          if (task.completed) subjectStats[task.subject].completed++;
        }
        for (const s of sessions) {
          const task = tasks.find(t => t.id === s.task_id);
          const subject = task?.subject || "Altro";
          if (!subjectStats[subject]) subjectStats[subject] = { sessions: 0, totalMinutes: 0, completed: 0, total: 0 };
          subjectStats[subject].sessions++;
          subjectStats[subject].totalMinutes += Math.round((s.duration_seconds || 0) / 60);
        }
        const missionsData = { total: missions.length, completed: missions.filter((m: any) => m.completed).length, challengesCompleted: missions.filter((m: any) => m.completed && m.mission_type === "coach_challenge").length, types: missions.map((m: any) => ({ type: m.mission_type, title: m.title, completed: m.completed, date: m.mission_date })) };
        const emotionCounts: Record<string, number> = {};
        for (const s of sessions) { const e = s.emotion || "non_registrata"; emotionCounts[e] = (emotionCounts[e] || 0) + 1; }
        const extendedSessions = recentSessions.filter(s => s.studied_extra).length;

        const schoolLevel = getSchoolLevel(profile);

        const { data, error } = await supabase.functions.invoke("parent-insights", {
          body: {
            childProfile: profile,
            gamification,
            sessionsCount: sessions.length,
            totalMinutes,
            recentSessions,
            allConcepts,
            subjectStats,
            missionsData,
            emotionPatterns: emotionCounts,
            extendedSessionsCount: extendedSessions,
            schoolLevel,
          },
        });
        if (error) throw error;
        if (data?.insights) setAiInsights(data.insights);
      } catch (e) {
        console.error("Failed to fetch AI insights:", e);
      } finally {
        setInsightsLoading(false);
      }
    };
    fetchInsights();
  }, [profile, loading, sessions, gamification, memoryItems, tasks, missions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const schoolLevel = getSchoolLevel(profile);
  const totalMinutes = sessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);

  const pageTitle = schoolLevel === "universitario" ? "Feedback strategico" : "Il tuo andamento";
  const pageSubtitle = schoolLevel === "medie"
    ? "Ecco come sta andando il tuo studio — sei sulla strada giusta!"
    : schoolLevel === "universitario"
    ? "Analisi strategica delle tue sessioni di studio"
    : "Uno sguardo su come stai andando, senza giudizi.";

  // University: compute efficiency
  const efficiencyData = sessioniStudio.length > 0
    ? (() => {
        const byMateria: Record<string, { total: number; count: number }> = {};
        for (const s of sessioniStudio) {
          const m = s.materia || "Altro";
          if (!byMateria[m]) byMateria[m] = { total: 0, count: 0 };
          byMateria[m].total += s.durata_minuti || 0;
          byMateria[m].count++;
        }
        return Object.entries(byMateria).map(([materia, data]) => ({
          materia,
          totalMinutes: data.total,
          avgMinutes: Math.round(data.total / data.count),
          sessions: data.count,
        }));
      })()
    : [];

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-semibold text-foreground">{pageTitle}</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-xl font-bold text-foreground mb-0.5">
              {schoolLevel === "medie" ? `Ciao ${profile?.name || "—"}, stai andando bene!` : `Ciao ${profile?.name || "—"}, ecco i tuoi progressi`}
            </h1>
            <p className="text-muted-foreground text-sm">{pageSubtitle}</p>
          </motion.div>
        </div>
      </div>

      {/* Cards */}
      <div className="px-6 mt-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <DailySnapshotCard
            childName={profile?.name || "—"}
            sessions={sessions}
            tasks={tasks}
            missions={missions}
          />

          <ProgressCard
            totalMinutes={totalMinutes}
            totalSessions={sessions.length}
            gamification={gamification}
            schoolLevel={schoolLevel}
          />

          <EmotionalCard
            alerts={emotionalAlerts}
            onAlertRead={(alertId) => {
              setEmotionalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
            }}
            sessions={sessions}
            insights={aiInsights}
            insightsLoading={insightsLoading}
          />

          <CognitiveCard
            childName={profile?.name || "—"}
            insights={aiInsights}
            insightsLoading={insightsLoading}
            memoryItems={memoryItems}
            schoolLevel={schoolLevel}
          />

          {/* University: Exam Progress */}
          {schoolLevel === "universitario" && esami.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-5 shadow-soft"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-sm">Andamento per esame</h3>
              </div>
              <div className="space-y-4">
                {esami.map((esame: any) => {
                  const sessPerEsame = sessioniStudio.filter((s: any) => s.materia?.toLowerCase() === esame.nome_esame?.toLowerCase());
                  const totalMin = sessPerEsame.reduce((a: number, s: any) => a + (s.durata_minuti || 0), 0);
                  const progressPct = Math.min(100, (sessPerEsame.length / 10) * 100);
                  const daysLeft = esame.data_prevista
                    ? Math.max(0, Math.ceil((new Date(esame.data_prevista).getTime() - Date.now()) / 86400000))
                    : null;

                  return (
                    <div key={esame.id} className="border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{esame.nome_esame}</p>
                          {esame.data_prevista && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(esame.data_prevista).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          )}
                        </div>
                        {daysLeft !== null && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${daysLeft < 10 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                            {daysLeft === 0 ? "Oggi" : `tra ${daysLeft}g`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progressPct} className="flex-1 h-1.5" />
                        <span className="text-xs text-muted-foreground shrink-0">{sessPerEsame.length} sessioni · {totalMin}min</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* University: Session Efficiency */}
          {schoolLevel === "universitario" && efficiencyData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.25 }}
              className="bg-card rounded-2xl border border-border p-5 shadow-soft"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-sm">Efficienza delle sessioni</h3>
              </div>
              <div className="space-y-3">
                {efficiencyData.map(d => (
                  <div key={d.materia} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium text-foreground">{d.materia}</p>
                      <p className="text-xs text-muted-foreground">{d.sessions} sessioni · media {d.avgMinutes}min</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${d.avgMinutes >= 30 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                      {d.avgMinutes >= 30 ? "Efficiente" : "Da ottimizzare"}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* University: How you're learning */}
          {schoolLevel === "universitario" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.3 }}
              className="bg-card rounded-2xl border border-border p-5 shadow-soft"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground text-sm">Come stai imparando</h3>
              </div>
              {insightsLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Analizzo le tue strategie...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {aiInsights.filter(i => i.category === "metodo" || i.category === "autonomia").map((insight, i) => (
                    <div key={i} className="flex gap-2.5 py-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{insight.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.text}</p>
                      </div>
                    </div>
                  ))}
                  {aiInsights.filter(i => i.category === "metodo" || i.category === "autonomia").length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Studia qualche sessione in più per ottenere feedback metacognitivo</p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentReport;
