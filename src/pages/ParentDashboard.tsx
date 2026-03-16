import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, BookOpen, Brain, Lightbulb, Lock, Loader2, Eye, MessageCircle, Heart, Star, Sparkles, KeyRound, RefreshCw, Copy, Check } from "lucide-react";
import { ProgressSun } from "@/components/ProgressSun";
import { BadgeGrid } from "@/components/GamificationBar";
import { getChildProfiles, getFocusSessions, getGamification, getParentSettings, updateChildProfile, getMemoryItems, getTasks, getDailyMissions } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const iconMap: Record<string, any> = {
  lightbulb: Lightbulb,
  eye: Eye,
  message: MessageCircle,
  brain: Brain,
  heart: Heart,
  clock: Clock,
  star: Star,
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  metodo: { bg: "bg-sage-light", text: "text-sage-dark" },
  emotivo: { bg: "bg-clay-light", text: "text-clay-dark" },
  autonomia: { bg: "bg-primary/10", text: "text-primary" },
  motivazione: { bg: "bg-amber-100", text: "text-amber-700" },
};

const ParentDashboard = () => {
  const navigate = useNavigate();
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
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const settings = await getParentSettings();
      if (settings) setCorrectPin(settings.parent_pin || "0000");
      const kids = await getChildProfiles();
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0].id);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    const loadChild = async () => {
      const [g, s, m, t] = await Promise.all([
        getGamification(selectedChild),
        getFocusSessions(selectedChild),
        getMemoryItems(selectedChild),
        getTasks(selectedChild),
      ]);
      setGamification(g);
      setSessions(s);
      setMemoryItems(m);
      setTasks(t);
    };
    loadChild();
  }, [selectedChild]);

  // Fetch AI insights when child data is loaded
  useEffect(() => {
    if (!selectedChild || !unlocked) return;
    const selectedProfile = children.find(c => c.id === selectedChild);
    if (!selectedProfile) return;

    const fetchInsights = async () => {
      setInsightsLoading(true);
      setAiInsights([]);
      try {
        const totalMinutes = sessions.reduce((a, s) => a + Math.round((s.duration_seconds || 0) / 60), 0);
        
        // Prepare recent sessions with task subject info
        const recentSessions = sessions.slice(0, 10).map(s => {
          const task = tasks.find(t => t.id === s.task_id);
          return { ...s, subject: task?.subject || "N/A" };
        });

        // Get weak concepts (strength < 60)
        const weakConcepts = memoryItems.filter(m => (m.strength || 0) < 60);

        // Build subject stats
        const subjectStats: Record<string, { sessions: number; totalMinutes: number; completed: number; total: number }> = {};
        for (const task of tasks) {
          if (!subjectStats[task.subject]) {
            subjectStats[task.subject] = { sessions: 0, totalMinutes: 0, completed: 0, total: 0 };
          }
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

        const { data, error } = await supabase.functions.invoke("parent-insights", {
          body: {
            childProfile: selectedProfile,
            gamification,
            sessionsCount: sessions.length,
            totalMinutes,
            recentSessions,
            weakConcepts,
            subjectStats,
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
  }, [selectedChild, unlocked, sessions, gamification, memoryItems, tasks]);

  const checkPin = () => {
    if (pinInput === correctPin) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  // PIN lock screen
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="w-full max-w-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-6">
            <Lock className="w-7 h-7 text-sage-dark" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Area Genitori</h2>
          <p className="text-sm text-muted-foreground mb-8">Inserisci il PIN per accedere</p>
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

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate("/profiles")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-primary-foreground" /></div>
              <span className="font-display text-lg font-semibold text-foreground">Area Genitori</span>
            </div>
          </div>

          {/* Child selector */}
          {children.length > 1 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {children.map((child) => (
                <button key={child.id} onClick={() => setSelectedChild(child.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedChild === child.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                  <span>{child.avatar_emoji || "🧒"}</span> {child.name}
                </button>
              ))}
            </div>
          )}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">
              Progressi di {selectedProfile?.name || "—"} {selectedProfile?.avatar_emoji || ""}
            </h1>
            <p className="text-muted-foreground text-sm">Niente voti, solo crescita.</p>
          </motion.div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 -mt-4"><div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-soft">
            <div className="flex justify-center mb-2"><ProgressSun progress={0.72} size={40} /></div>
            <p className="text-xs text-muted-foreground">Autonomia</p>
            <p className="font-display font-bold text-foreground">72%</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-soft">
            <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center mx-auto mb-2"><Clock className="w-5 h-5 text-sage-dark" /></div>
            <p className="text-xs text-muted-foreground">Focus totale</p>
            <p className="font-display font-bold text-foreground">{totalMinutes}m</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-soft">
            <div className="w-10 h-10 rounded-xl bg-clay-light flex items-center justify-center mx-auto mb-2"><Brain className="w-5 h-5 text-clay-dark" /></div>
            <p className="text-xs text-muted-foreground">Sessioni</p>
            <p className="font-display font-bold text-foreground">{totalSessions}</p>
          </div>
        </div>
      </div></div>

      {/* Gamification */}
      {gamification && (
        <div className="px-6 mt-6"><div className="max-w-3xl mx-auto">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <h3 className="font-display font-semibold text-foreground mb-4">Punti e streak</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-lg font-display font-bold text-sage-dark">{gamification.focus_points || 0}</p><p className="text-xs text-muted-foreground">Focus</p></div>
              <div><p className="text-lg font-display font-bold text-clay-dark">{gamification.autonomy_points || 0}</p><p className="text-xs text-muted-foreground">Autonomia</p></div>
              <div><p className="text-lg font-display font-bold text-terracotta">🔥 {gamification.streak || 0}</p><p className="text-xs text-muted-foreground">Streak</p></div>
            </div>
          </div>
        </div></div>
      )}

      {/* Child Access Code */}
      {selectedProfile && (
        <div className="px-6 mt-6"><div className="max-w-3xl mx-auto">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-foreground text-sm">Codice accesso di {selectedProfile.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Condividi questo codice con {selectedProfile.name} per farlo entrare direttamente nella sua area.</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-xl px-5 py-3 text-center">
                <span className="font-display text-2xl font-bold tracking-widest text-foreground">
                  {selectedProfile.access_code || "—"}
                </span>
              </div>
              <button
                onClick={() => {
                  if (selectedProfile.access_code) {
                    navigator.clipboard.writeText(selectedProfile.access_code);
                    setCopiedCode(selectedProfile.id);
                    setTimeout(() => setCopiedCode(null), 2000);
                  }
                }}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                title="Copia codice"
              >
                {copiedCode === selectedProfile.id ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
              <button
                onClick={async () => {
                  setRegeneratingCode(selectedProfile.id);
                  try {
                    const { data: newCode } = await supabase.rpc("generate_child_access_code");
                    if (newCode) {
                      await updateChildProfile(selectedProfile.id, { access_code: newCode });
                      setChildren(prev => prev.map(c => c.id === selectedProfile.id ? { ...c, access_code: newCode } : c));
                      toast({ title: `Nuovo codice generato: ${newCode}` });
                    }
                  } catch (e) {
                    toast({ title: "Errore nella rigenerazione", variant: "destructive" });
                  } finally {
                    setRegeneratingCode(null);
                  }
                }}
                disabled={regeneratingCode === selectedProfile.id}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-40"
                title="Genera nuovo codice"
              >
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${regeneratingCode === selectedProfile.id ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div></div>
      )}

      {/* AI Personalized Insights */}
      <div className="px-6 mt-8"><div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Consigli personalizzati per {selectedProfile?.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Generati dall'AI in base ai dati reali di studio</p>

        {insightsLoading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analizzo i progressi di {selectedProfile?.name}...</p>
          </div>
        ) : aiInsights.length > 0 ? (
          aiInsights.map((insight, i) => {
            const IconComponent = iconMap[insight.icon] || Lightbulb;
            const colors = categoryColors[insight.category] || categoryColors.metodo;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.1 + i * 0.08 }}
                className="bg-card rounded-2xl border border-border p-5 shadow-soft"
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-1">{insight.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nessun consiglio disponibile al momento.</p>
          </div>
        )}
      </div></div>
    </div>
  );
};

export default ParentDashboard;
