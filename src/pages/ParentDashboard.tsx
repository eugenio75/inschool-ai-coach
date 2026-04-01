import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Loader2, Lock, Bell, Trash2 } from "lucide-react";
import { getChildProfiles, getFocusSessions, getGamification, getParentSettings, getMemoryItems, getTasks, getDailyMissions, getEmotionalAlerts, setActiveChildProfileId } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLang } from "@/contexts/LangContext";

import { DailySummaryCard } from "@/components/parent/DailySummaryCard";
import { ProgressCard } from "@/components/parent/ProgressCard";
import { EmotionalCard } from "@/components/parent/EmotionalCard";
import { CognitiveCard } from "@/components/parent/CognitiveCard";
import { AccessCodeCard } from "@/components/parent/AccessCodeCard";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [correctPin, setCorrectPin] = useState("0000");
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [emotionalAlerts, setEmotionalAlerts] = useState<any[]>([]);
  const [parentNotifications, setParentNotifications] = useState<any[]>([]);

  // Delete child profile state
  const [deleteChildTarget, setDeleteChildTarget] = useState<any>(null);
  const [deleteChildStep, setDeleteChildStep] = useState<1 | 2>(1);
  const [deleteChildConfirmName, setDeleteChildConfirmName] = useState("");
  const [deletingChild, setDeletingChild] = useState(false);

  useEffect(() => {
    const load = async () => {
      const settings = await getParentSettings();
      if (settings) setCorrectPin(settings.parent_pin || "0000");
      const kids = await getChildProfiles();
      setChildren(kids);
      if (kids.length > 0) {
        setSelectedChild(kids[0].id);
        setActiveChildProfileId(kids[0].id);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Load parent notifications for all children
  useEffect(() => {
    if (children.length === 0) return;
    const loadNotifications = async () => {
      const childIds = children.map((c: any) => c.id);
      const { data } = await supabase
        .from("parent_notifications")
        .select("*")
        .in("child_profile_id", childIds)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      setParentNotifications(data || []);
    };
    loadNotifications();
  }, [children]);

  useEffect(() => {
    if (!selectedChild) return;
    const loadChild = async () => {
      const [g, s, m, t, dm, alerts] = await Promise.all([
        getGamification(selectedChild),
        getFocusSessions(selectedChild),
        getMemoryItems(selectedChild),
        getTasks(selectedChild),
        getDailyMissions(selectedChild),
        getEmotionalAlerts(selectedChild),
      ]);
      setGamification(g);
      setSessions(s);
      setMemoryItems(m);
      setTasks(t);
      setMissions(dm);
      setEmotionalAlerts(alerts);
    };
    loadChild();
  }, [selectedChild]);

  // Fetch AI insights
  useEffect(() => {
    if (!selectedChild || !unlocked) return;
    const selectedProfile = children.find(c => c.id === selectedChild);
    if (!selectedProfile) return;

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
          body: { childProfile: selectedProfile, gamification, sessionsCount: sessions.length, totalMinutes, recentSessions, allConcepts, subjectStats, missionsData, emotionPatterns: emotionCounts, extendedSessionsCount: extendedSessions },
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
  }, [selectedChild, unlocked, sessions, gamification, memoryItems, tasks, missions]);

  const checkPin = () => {
    if (pinInput === correctPin) { setUnlocked(true); setPinError(false); }
    else { setPinError(true); setPinInput(""); }
  };

  const markNotificationRead = async (notifId: string) => {
    await supabase.from("parent_notifications").update({ read: true }).eq("id", notifId);
    setParentNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const openDeleteChild = (child: any) => {
    setDeleteChildTarget(child);
    setDeleteChildStep(1);
    setDeleteChildConfirmName("");
  };

  const handleDeleteChild = async () => {
    if (!deleteChildTarget || deleteChildConfirmName !== deleteChildTarget.name) return;
    setDeletingChild(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { action: "delete_child_profile", child_profile_id: deleteChildTarget.id },
      });
      if (error) throw error;
      setChildren(prev => prev.filter(c => c.id !== deleteChildTarget.id));
      if (selectedChild === deleteChildTarget.id) {
        const remaining = children.filter(c => c.id !== deleteChildTarget.id);
        const newId = remaining.length > 0 ? remaining[0].id : null;
        setSelectedChild(newId);
        if (newId) setActiveChildProfileId(newId);
      }
      toast.success(t("delete_child_success"));
      setDeleteChildTarget(null);
    } catch (e: any) {
      toast.error(t("delete_child_error"));
    } finally {
      setDeletingChild(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  // PIN lock screen
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="w-full max-w-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Area Genitori</h2>
          <p className="text-sm text-muted-foreground mb-8">Inserisci il PIN per accedere</p>

          {/* Show notification badge on PIN screen */}
          {parentNotifications.length > 0 && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {parentNotifications.length} {parentNotifications.length === 1 ? "notifica" : "notifiche"}
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Sblocca per vedere i dettagli
              </p>
            </div>
          )}

          <input
            type="password"
            value={pinInput}
            onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(false); }}
            onKeyDown={(e) => e.key === "Enter" && checkPin()}
            maxLength={4}
            placeholder="• • • •"
            className={`w-full text-center text-2xl tracking-[0.5em] font-mono px-4 py-4 rounded-2xl border ${pinError ? "border-destructive bg-destructive/5" : "border-border bg-card"} text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4`}
          />
          {pinError && <p className="text-sm text-destructive mb-4">PIN non corretto</p>}
          <button onClick={checkPin} disabled={pinInput.length !== 4} className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-medium disabled:opacity-40">Sblocca</button>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-muted-foreground hover:text-foreground">← Torna indietro</button>
        </motion.div>
      </div>
    );
  }

  const selectedProfile = children.find(c => c.id === selectedChild);
  const totalMinutes = sessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);
  const totalSessions = sessions.length;

  // Filter notifications for selected child
  const childNotifications = parentNotifications.filter(n => n.child_profile_id === selectedChild);

  return (
    <>
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/profiles")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-semibold text-foreground">Area Genitori</span>
            </div>
          </div>

          {/* Child selector */}
          {children.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => { setSelectedChild(child.id); setActiveChildProfileId(child.id); }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    selectedChild === child.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                    {child.name?.charAt(0)?.toUpperCase() || "S"}
                  </span>
                  {child.last_name ? `${child.name} ${child.last_name}` : child.name}
                </button>
              ))}
            </div>
          )}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-xl font-bold text-foreground mb-0.5">
              Progressi di {selectedProfile?.name || "—"}
            </h1>
            <p className="text-muted-foreground text-sm">Niente voti, solo crescita.</p>
          </motion.div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="px-6 mt-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Parent notifications — silent alerts */}
          {childNotifications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
              className="space-y-3"
            >
              {childNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`rounded-2xl border p-4 ${
                    notif.alert_level === "urgent"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                      : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Bell className={`w-4 h-4 ${
                          notif.alert_level === "urgent" ? "text-amber-600" : "text-blue-600"
                        }`} />
                        <span className={`text-sm font-semibold ${
                          notif.alert_level === "urgent" ? "text-amber-800 dark:text-amber-200" : "text-blue-800 dark:text-blue-200"
                        }`}>
                          {notif.title}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${
                        notif.alert_level === "urgent" ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"
                      }`}>
                        {notif.message}
                      </p>
                    </div>
                    <button
                      onClick={() => markNotificationRead(notif.id)}
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-1"
                    >
                      ✓ Letto
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Progress */}
          <ProgressCard
            totalMinutes={totalMinutes}
            totalSessions={totalSessions}
            gamification={gamification}
          />

          {/* Unified daily summary */}
          {selectedChild && (
            <DailySummaryCard
              childProfileId={selectedChild}
              childName={selectedProfile?.name || "—"}
              missions={missions}
            />
          )}

          {/* Emotional wellbeing */}
          <EmotionalCard
            alerts={emotionalAlerts}
            onAlertRead={(alertId) => {
              setEmotionalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
            }}
            sessions={sessions}
            insights={aiInsights}
            insightsLoading={insightsLoading}
          />

          {/* Cognitive area */}
          <CognitiveCard
            childName={selectedProfile?.name || "—"}
            insights={aiInsights}
            insightsLoading={insightsLoading}
            memoryItems={memoryItems}
          />

          {/* Access code */}
          {selectedProfile && (
            <AccessCodeCard
              profile={selectedProfile}
              onProfileUpdate={(id, updates) => {
                setChildren(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
              }}
            />
          )}

          {/* Danger zone — delete child profile */}
          {selectedProfile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.3 }}
              className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
            >
              <h3 className="font-display font-semibold text-destructive text-sm mb-1">
                {t("delete_child_zone_title").replace("{name}", selectedProfile.name)}
              </h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {t("delete_child_zone_desc")}
              </p>
              <button
                onClick={() => openDeleteChild(selectedProfile)}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                {t("delete_child_zone_button")}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>

      {/* Delete child — Step 1 */}
      <AlertDialog open={!!deleteChildTarget && deleteChildStep === 1} onOpenChange={(open) => { if (!open) setDeleteChildTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_child_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_child_step1_desc").replace("{name}", deleteChildTarget?.name || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" onClick={() => setDeleteChildTarget(null)}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setDeleteChildStep(2)}
            >
              {t("continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete child — Step 2 */}
      <AlertDialog open={!!deleteChildTarget && deleteChildStep === 2} onOpenChange={(open) => { if (!open) { setDeleteChildTarget(null); setDeleteChildConfirmName(""); } }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_child_step2_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_child_step2_desc").replace("{name}", deleteChildTarget?.name || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteChildConfirmName}
            onChange={(e) => setDeleteChildConfirmName(e.target.value)}
            placeholder={deleteChildTarget?.name || ""}
            className="rounded-xl text-center"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" onClick={() => { setDeleteChildTarget(null); setDeleteChildConfirmName(""); }}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteChildConfirmName !== deleteChildTarget?.name || deletingChild}
              onClick={handleDeleteChild}
            >
              {deletingChild ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("delete_permanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ParentDashboard;
