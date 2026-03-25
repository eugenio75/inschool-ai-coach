import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { getActiveChildProfileId, getChildProfile, getFocusSessions, getGamification, getMemoryItems, getTasks, getDailyMissions, getEmotionalAlerts } from "@/lib/database";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";

import { DailySnapshotCard } from "@/components/parent/DailySnapshotCard";
import { ProgressCard } from "@/components/parent/ProgressCard";
import { EmotionalCard } from "@/components/parent/EmotionalCard";
import { CognitiveCard } from "@/components/parent/CognitiveCard";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

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

        const { data, error } = await supabase.functions.invoke("parent-insights", {
          body: { childProfile: profile, gamification, sessionsCount: sessions.length, totalMinutes, recentSessions, allConcepts, subjectStats, missionsData, emotionPatterns: emotionCounts, extendedSessionsCount: extendedSessions },
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

  const totalMinutes = sessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);

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
              <span className="font-display text-lg font-semibold text-foreground">Il tuo andamento</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-xl font-bold text-foreground mb-0.5">
              Ciao {profile?.name || "—"}, ecco i tuoi progressi
            </h1>
            <p className="text-muted-foreground text-sm">Uno sguardo su come stai andando, senza giudizi.</p>
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
          />
        </div>
      </div>
    </div>
  );
};

export default StudentReport;
