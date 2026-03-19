import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Flame, BookOpen, Timer, Brain, Zap, Sliders,
  Play, Pause, RotateCcw, CalendarCheck, Plus,
  Target, BarChart3, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  format, subDays, isToday, isTomorrow, isPast, formatDistanceToNow,
} from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RecentConversations } from "@/components/shared/RecentConversations";
import { LogoutButton } from "@/components/shared/LogoutButton";

const TIMER_CONFIGS = {
  pomodoro:   { seconds: 25 * 60, label: "Pomodoro — 25 min" },
  deep_work:  { seconds: 50 * 60, label: "Deep Work — 50 min" },
  ultra_focus: { seconds: 90 * 60, label: "Ultra Focus — 90 min" },
} as const;

type TimerType = keyof typeof TIMER_CONFIGS;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function fmtTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* AudioContext non supportato */ }
}

export default function DashboardSuperiori() {
  const navigate = useNavigate();
  
  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;

  const [onboarding, setOnboarding] = useState<any>({});
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState<{ giorno: string; minuti: number }[]>([]);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState(false);

  const [timerType, setTimerType] = useState<TimerType>("pomodoro");
  const [secondsLeft, setSecondsLeft] = useState(TIMER_CONFIGS.pomodoro.seconds);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMateria, setTimerMateria] = useState("");
  const [timerStarted, setTimerStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", subject: "", due_date: "" });
  const [savingTask, setSavingTask] = useState(false);

  const od = onboarding;
  const materie: string[] = od?.materie_critiche || [];
  const indirizzo: string = od?.superiori_indirizzo || "";
  const anno: string = od?.superiori_anno || "";

  useEffect(() => {
    if (!profileId) return;
    loadAll();
  }, [profileId]);

  async function loadAll() {
    setLoadingPrefs(true);
    setTasksLoading(true);
    try {
      const { data: prefs } = await (supabase as any)
        .from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
      const d = prefs?.data || {};
      setOnboarding(d);

      const thirtyAgo = subDays(new Date(), 30).toISOString();
      const { data: sessions } = await (supabase as any)
        .from("sessioni_studio").select("created_at, durata_minuti")
        .eq("profile_id", profileId).gte("created_at", thirtyAgo)
        .order("created_at", { ascending: false });

      if (sessions) {
        const days = new Set<string>(sessions.map((s: any) => format(new Date(s.created_at), "yyyy-MM-dd")));
        let st = 0;
        let check = new Date();
        while (days.has(format(check, "yyyy-MM-dd"))) { st++; check = subDays(check, 1); }
        setStreak(st);

        setWeekData(Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const ds = format(date, "yyyy-MM-dd");
          const mins = sessions
            .filter((s: any) => format(new Date(s.created_at), "yyyy-MM-dd") === ds)
            .reduce((sum: number, s: any) => sum + (s.durata_minuti || 0), 0);
          return { giorno: format(date, "EEE", { locale: it }), minuti: mins };
        }));
      }

      const { data: t } = await supabase.from("homework_tasks").select("*")
        .eq("child_profile_id", profileId).eq("completed", false)
        .order("due_date", { ascending: true }).limit(5);
      setTasks(t || []);

      if (d?.materie_critiche?.length) {
        generateChallenge(d.materie_critiche, d.superiori_indirizzo || "", d.superiori_anno || "");
      }
    } finally {
      setLoadingPrefs(false);
      setTasksLoading(false);
    }
  }

  async function generateChallenge(m: string[], indir: string, a: string) {
    setChallengeLoading(true);
    setChallengeError(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            stream: false,
            maxTokens: 120,
            systemPrompt: `Sei un coach di studio per uno studente di ${indir}${a ? `, ${a} anno` : ""}. Genera UNA sfida di studio concisa per oggi, massimo 2 righe. Deve riguardare una di queste materie: ${m.join(", ")}. La sfida deve essere specifica, motivante e raggiungibile in 1 ora. Rispondi SOLO con la sfida, nessun preambolo, nessun titolo.`,
            messages: [{ role: "user", content: "Genera la sfida di oggi." }],
          }),
        }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChallenge(data.choices?.[0]?.message?.content?.trim() || null);
    } catch {
      setChallengeError(true);
    } finally {
      setChallengeLoading(false);
    }
  }

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerRunning(false);
            handleTimerComplete();
            return TIMER_CONFIGS[timerType].seconds;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerType]);

  async function handleTimerComplete() {
    playBeep();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("InSchool — Sessione completata!", {
        body: `${TIMER_CONFIGS[timerType].label}${timerMateria ? ` su ${timerMateria}` : ""} completata.`,
      });
    }
    const durata = Math.round(TIMER_CONFIGS[timerType].seconds / 60);
    if (profileId && timerMateria) {
      await (supabase as any).from("sessioni_studio").insert({
        profile_id: profileId, materia: timerMateria, durata_minuti: durata, tipo: timerType,
      });
    }
    toast.success(`Sessione completata! ${durata} minuti registrati${timerMateria ? ` su ${timerMateria}` : ""}.`);
    setTimerStarted(false);
  }

  function toggleTimer() {
    if (!timerStarted) {
      setTimerStarted(true);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    setTimerRunning(r => !r);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerStarted(false);
    setSecondsLeft(TIMER_CONFIGS[timerType].seconds);
  }

  async function completeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("homework_tasks").update({ completed: true } as any).eq("id", id);
    toast.success("Task completato!");
  }

  async function saveNewTask() {
    if (!newTask.title.trim() || !profileId) return;
    setSavingTask(true);
    const { error } = await supabase.from("homework_tasks").insert({
      child_profile_id: profileId,
      title: newTask.title,
      subject: newTask.subject || null,
      due_date: newTask.due_date || null,
      completed: false,
    } as any);
    setSavingTask(false);
    if (!error) {
      toast.success("Task aggiunto!");
      setShowTaskModal(false);
      setNewTask({ title: "", subject: "", due_date: "" });
      const { data: t } = await supabase.from("homework_tasks").select("*")
        .eq("child_profile_id", profileId).eq("completed", false)
        .order("due_date", { ascending: true }).limit(5);
      setTasks(t || []);
    } else {
      toast.error("Errore nel salvataggio del task.");
    }
  }

  function dueDateLabel(dueDate: string): { label: string; cls: string } {
    const d = new Date(dueDate);
    if (isToday(d)) return { label: "Oggi", cls: "text-orange-500 font-medium" };
    if (isTomorrow(d)) return { label: "Domani", cls: "text-yellow-600 font-medium" };
    if (isPast(d)) return { label: `Scaduto ${formatDistanceToNow(d, { locale: it })} fa`, cls: "text-red-500 font-medium" };
    return { label: format(d, "d MMM", { locale: it }), cls: "text-slate-400" };
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {getGreeting()}, {profile?.name?.split(" ")[0] || ""}
            </h1>
            {(indirizzo || anno) && (
              <p className="text-muted-foreground mt-1 text-sm">
                {[indirizzo, anno && `${anno} anno`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2 shrink-0">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="font-bold text-orange-600">{streak}</span>
              <span className="text-xs text-orange-500 hidden sm:block">giorni</span>
            </div>
            <LogoutButton showLabel />
          </div>
        </motion.div>

        {/* MATERIE IN FOCUS */}
        {loadingPrefs ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : materie.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Le tue materie</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {materie.slice(0, 3).map((m, i) => (
                <motion.button key={m} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => navigate(`/challenge/new?subject=${encodeURIComponent(m)}`)}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between group hover:border-primary/40 hover:shadow-md transition-all text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{m}</p>
                      <p className="text-xs text-muted-foreground">Studia ora</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </motion.button>
              ))}
            </div>
          </section>
        ) : null}

        {/* SFIDA DEL GIORNO */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sfida del giorno</h2>
          <div className="bg-card border border-border rounded-2xl p-5">
            {challengeLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
            ) : challengeError ? (
              <p className="text-muted-foreground text-sm">
                Impossibile generare la sfida oggi.{" "}
                <button onClick={() => generateChallenge(materie, indirizzo, anno)} className="text-primary underline">Riprova</button>
              </p>
            ) : challenge ? (
              <div className="flex gap-3">
                <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-foreground leading-relaxed">{challenge}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Completa l'onboarding per ricevere sfide personalizzate.</p>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* TIMER POMODORO */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Timer className="w-4 h-4 text-primary" /> Timer di Studio
            </h2>
            <div className="space-y-3">
              <Select value={timerType} disabled={timerRunning}
                onValueChange={(v) => {
                  const k = v as TimerType;
                  setTimerType(k);
                  setSecondsLeft(TIMER_CONFIGS[k].seconds);
                  setTimerStarted(false);
                }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIMER_CONFIGS) as [TimerType, { seconds: number; label: string }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {k === "pomodoro" ? <Timer className="w-4 h-4 inline mr-2 text-red-500" /> :
                       k === "deep_work" ? <Brain className="w-4 h-4 inline mr-2 text-blue-500" /> :
                       <Zap className="w-4 h-4 inline mr-2 text-purple-500" />}
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {materie.length > 0 && (
                <Select value={timerMateria} disabled={timerRunning} onValueChange={setTimerMateria}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona materia (opzionale)" /></SelectTrigger>
                  <SelectContent>
                    {materie.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="text-center py-6">
              <span className="text-6xl font-mono font-bold text-foreground tabular-nums">
                {fmtTime(secondsLeft)}
              </span>
              {timerStarted && (
                <p className="text-xs text-muted-foreground mt-2">
                  {timerRunning ? "In corso" : "In pausa"}{timerMateria ? ` · ${timerMateria}` : ""}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={toggleTimer}
                className={`flex-1 rounded-xl font-semibold ${timerRunning ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                {timerRunning
                  ? <><Pause className="w-4 h-4 mr-1.5" />Pausa</>
                  : <><Play className="w-4 h-4 mr-1.5" />{timerStarted ? "Riprendi" : "Avvia"}</>}
              </Button>
              <Button variant="outline" onClick={resetTimer} className="rounded-xl">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </section>

          {/* TASK IN SCADENZA */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary" /> Task in scadenza
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowTaskModal(true)} className="h-7 text-xs rounded-lg">
                <Plus className="w-3 h-3 mr-1" />Aggiungi
              </Button>
            </div>
            {tasksLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CalendarCheck className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Nessun task in scadenza</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ottimo lavoro!</p>
                <Button variant="outline" size="sm" className="mt-3 rounded-xl text-xs" onClick={() => setShowTaskModal(true)}>
                  <Plus className="w-3 h-3 mr-1" />Aggiungi task
                </Button>
              </div>
            ) : (
              <ul className="space-y-1">
                {tasks.map(task => {
                  const due = task.due_date ? dueDateLabel(task.due_date) : null;
                  return (
                    <li key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors">
                      <button onClick={() => completeTask(task.id)}
                        className="w-5 h-5 rounded-full border-2 border-border hover:border-primary hover:bg-primary/10 transition-colors shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        {task.subject && <Badge variant="secondary" className="text-xs mt-0.5">{task.subject}</Badge>}
                      </div>
                      {due && <span className={`text-xs shrink-0 ${due.cls}`}>{due.label}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* PROGRESSI SETTIMANALI */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" /> Progressi questa settimana
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekData} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="giorno" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="m" />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number) => [`${v} min`, "Studio"]}
              />
              <Bar dataKey="minuti" fill="#2563eb" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
          {weekData.every(d => d.minuti === 0) && (
            <p className="text-center text-xs text-slate-400 mt-3">
              Usa il Timer di Studio per registrare le tue sessioni e vedere i progressi
            </p>
          )}
        </section>

        {/* CONVERSAZIONI RECENTI */}
        <RecentConversations profileId={profileId} />

      </div>

      {/* MODAL AGGIUNGI TASK */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Aggiungi Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Titolo *</Label>
              <Input placeholder="es. Studiare la termodinamica per venerdì"
                value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                className="mt-1 rounded-xl" />
            </div>
            {materie.length > 0 && (
              <div>
                <Label>Materia</Label>
                <Select value={newTask.subject} onValueChange={v => setNewTask(p => ({ ...p, subject: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Seleziona materia" /></SelectTrigger>
                  <SelectContent>{materie.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Scadenza</Label>
              <Input type="date" value={newTask.due_date}
                onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                className="mt-1 rounded-xl" min={format(new Date(), "yyyy-MM-dd")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)} className="rounded-xl">Annulla</Button>
            <Button onClick={saveNewTask} disabled={!newTask.title.trim() || savingTask}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
              {savingTask ? "Salvataggio..." : "Salva task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
