import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Target, Brain, TrendingUp, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession, isChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export default function StudentProgress() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "alunno";
  const profileId = getChildSession()?.profileId || profile?.id;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    streak: 0,
    completedTasks: 0,
    totalSessions: 0,
    subjectData: [] as { subject: string; sessions: number; avgBloom: number }[],
    errorTypes: [] as { type: string; count: number }[],
    weeklyActivity: [] as { day: string; sessions: number }[],
  });

  useEffect(() => {
    if (!profileId) return;
    loadStats();
  }, [profileId]);

  async function loadStats() {
    setLoading(true);
    const userId = user?.id || profileId;

    const [gamRes, taskRes, sessRes, errRes] = await Promise.all([
      supabase.from("gamification").select("streak").eq("child_profile_id", profileId).maybeSingle(),
      supabase.from("homework_tasks").select("id, completed, subject").eq("child_profile_id", profileId),
      (supabase as any).from("guided_sessions").select("id, homework_id, bloom_level_reached, completed_at, status").eq("user_id", userId).eq("status", "completed").order("completed_at", { ascending: true }).limit(50),
      (supabase as any).from("learning_errors").select("error_type").eq("user_id", userId),
    ]);

    const streak = gamRes.data?.streak || 0;
    const tasks = taskRes.data || [];
    const completedTasks = tasks.filter((t: any) => t.completed).length;
    const sessions = sessRes.data || [];
    const errors = errRes.data || [];

    // Subject breakdown
    const subjectMap: Record<string, { sessions: number; totalBloom: number }> = {};
    for (const s of sessions) {
      const task = tasks.find((t: any) => t.id === s.homework_id);
      const subj = task?.subject || "Altro";
      if (!subjectMap[subj]) subjectMap[subj] = { sessions: 0, totalBloom: 0 };
      subjectMap[subj].sessions++;
      subjectMap[subj].totalBloom += s.bloom_level_reached || 0;
    }
    const subjectData = Object.entries(subjectMap).map(([subject, d]) => ({
      subject, sessions: d.sessions, avgBloom: d.sessions > 0 ? Math.round(d.totalBloom / d.sessions) : 0,
    }));

    // Error types
    const errMap: Record<string, number> = {};
    for (const e of errors) {
      const t = e.error_type || "altro";
      errMap[t] = (errMap[t] || 0) + 1;
    }
    const errorTypes = Object.entries(errMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

    // Weekly activity (last 7 days)
    const weeklyActivity = [];
    const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const count = sessions.filter((s: any) => s.completed_at?.startsWith(dayStr)).length;
      weeklyActivity.push({ day: dayNames[d.getDay()], sessions: count });
    }

    setStats({ streak, completedTasks, totalSessions: sessions.length, subjectData, errorTypes, weeklyActivity });
    setLoading(false);
  }

  const errColors: Record<string, string> = {
    distrazione: "bg-slate-200 text-slate-700",
    incomprensione: "bg-amber-100 text-amber-700",
    metodo: "bg-orange-100 text-orange-700",
    memoria: "bg-blue-100 text-blue-700",
    ragionamento: "bg-purple-100 text-purple-700",
    fretta: "bg-pink-100 text-pink-700",
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    </div>
  );

  // MEDIE view: simple, encouraging
  if (schoolLevel === "alunno" || schoolLevel === "medie") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
        <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <h1 className="font-display text-lg font-bold text-slate-900">I tuoi progressi</h1>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
              <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-slate-900">{stats.streak}</p>
              <p className="text-xs text-slate-500">giorni di fila</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-slate-900">{stats.completedTasks}</p>
              <p className="text-xs text-slate-500">compiti fatti</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center shadow-sm">
              <BookOpen className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="font-display text-2xl font-bold text-slate-900">{stats.totalSessions}</p>
              <p className="text-xs text-slate-500">sessioni</p>
            </div>
          </motion.div>

          {stats.subjectData.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-sm mb-3">Le tue materie</h2>
              <div className="space-y-3">
                {stats.subjectData.map(s => (
                  <div key={s.subject}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{s.subject}</span>
                      <span className="text-slate-400">{s.sessions} sessioni</span>
                    </div>
                    <Progress value={Math.min(100, s.sessions * 15)} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.errorTypes.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-sm mb-3">Dove puoi migliorare</h2>
              <p className="text-xs text-slate-500 mb-3">Il tuo coach ti aiuterà a rinforzare queste aree</p>
              <div className="flex flex-wrap gap-2">
                {stats.errorTypes.slice(0, 3).map(e => (
                  <span key={e.type} className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize ${errColors[e.type] || 'bg-slate-100 text-slate-600'}`}>
                    {e.type} ({e.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // SUPERIORI view: method & strategy
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <h1 className="font-display text-lg font-bold text-slate-900">
          {schoolLevel === "universitario" ? "Feedback strategico" : "I tuoi progressi"}
        </h1>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <Flame className="w-5 h-5 text-orange-500 mb-2" />
            <p className="font-display text-2xl font-bold text-slate-900">{stats.streak}</p>
            <p className="text-xs text-slate-500">giorni di fila</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
            <p className="font-display text-2xl font-bold text-slate-900">{stats.completedTasks}</p>
            <p className="text-xs text-slate-500">compiti completati</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <Target className="w-5 h-5 text-blue-500 mb-2" />
            <p className="font-display text-2xl font-bold text-slate-900">{stats.totalSessions}</p>
            <p className="text-xs text-slate-500">sessioni studio</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
            <p className="font-display text-2xl font-bold text-slate-900">
              {stats.subjectData.length > 0 ? Math.round(stats.subjectData.reduce((s, d) => s + d.avgBloom, 0) / stats.subjectData.length) : 0}
            </p>
            <p className="text-xs text-slate-500">livello Bloom medio</p>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Attività della settimana</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="sessions" stroke="#0070C0" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per materia */}
        {stats.subjectData.length > 0 && (
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-sm mb-4">Andamento per materia</h2>
            <div className="space-y-3">
              {stats.subjectData.map(s => (
                <div key={s.subject} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium text-slate-700">{s.subject}</p>
                    <Progress value={Math.min(100, s.avgBloom * 16.7)} className="h-1.5 mt-1" />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{s.sessions}</p>
                    <p className="text-xs text-slate-400">sessioni</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errori ricorrenti */}
        {stats.errorTypes.length > 0 && (
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-sm mb-2">Errori ricorrenti</h2>
            <p className="text-xs text-slate-500 mb-4">
              {schoolLevel === "universitario"
                ? "Pattern identificati nelle tue sessioni — lavora su questi per migliorare l'efficienza"
                : "Il coach ti aiuterà a lavorare su queste aree"}
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.errorTypes.map(e => (
                <span key={e.type} className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize ${errColors[e.type] || 'bg-slate-100 text-slate-600'}`}>
                  {e.type} ({e.count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty states */}
        {stats.totalSessions === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
            <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-500 mb-1">Nessuna sessione ancora</p>
            <p className="text-sm text-slate-400">Inizia a studiare per vedere i tuoi progressi qui</p>
          </div>
        )}
      </div>
    </div>
  );
}
