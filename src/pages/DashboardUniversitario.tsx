import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Lightbulb, ClipboardCheck, Search, Mic,
  PenLine, MessageSquare, Zap, Plus, Brain, Sliders, Timer,
  CheckCircle2, CalendarDays, TrendingUp, BookMarked,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";

import { format, differenceInDays, formatDistanceToNow, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
  } catch { }
}

const AI_ACTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; prompt: string }> = {
  spiegazione: {
    label: "Spiega un concetto", icon: Lightbulb,
    prompt: "Sei un professore universitario. Spiega il concetto che ti indicherò in modo chiaro, approfondito e con esempi pratici. Adatta il livello a uno studente universitario.",
  },
  ripasso: {
    label: "Crea un quiz", icon: ClipboardCheck,
    prompt: "Genera un quiz di autovalutazione sull'argomento indicato. 8 domande con risposta corretta e spiegazione. Inizia direttamente con le domande.",
  },
  ricerca: {
    label: "Ricerca bibliografica", icon: Search,
    prompt: "Effettua una ricerca bibliografica approfondita sull'argomento indicato. Fornisci 5-8 fonti accademiche con autore, anno, titolo e abstract breve.",
  },
  orale: {
    label: "Preparazione orale", icon: Mic,
    prompt: "Simula un esaminatore universitario. Fai domande progressive dal livello base a quello avanzato. Dopo ogni risposta dai feedback dettagliato.",
  },
  correzione: {
    label: "Revisione elaborato", icon: PenLine,
    prompt: "Sei un professore universitario. Analizza l'elaborato che ti mostrerò e fornisci feedback dettagliato su: struttura, argomentazione, correttezza e stile accademico.",
  },
};

export default function DashboardUniversitario() {
  const navigate = useNavigate();
  
  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;

  const [onboarding, setOnboarding] = useState<any>({});
  const [esami, setEsami] = useState<any[]>([]);
  const [ricerche, setRicerche] = useState<any[]>([]);
  const [loadingEsami, setLoadingEsami] = useState(true);
  const [loadingRicerche, setLoadingRicerche] = useState(true);

  // KPI
  const [kpi, setKpi] = useState({ sessioni: 0, ore: 0, esamiCount: 0 });

  // Sessioni per progress bar
  const [sessioniPerMateria, setSessioniPerMateria] = useState<Record<string, number>>({});

  // Tunnel Focus
  const [focusDuration, setFocusDuration] = useState(50);
  const [focusCustom, setFocusCustom] = useState("");
  const [focusMateria, setFocusMateria] = useState("");
  const [focusActive, setFocusActive] = useState(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(50 * 60);
  const [focusTotalSeconds, setFocusTotalSeconds] = useState(50 * 60);
  const [showFocusConfirm, setShowFocusConfirm] = useState(false);
  const [showFocusComplete, setShowFocusComplete] = useState(false);
  const focusInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add esame modal
  const [showEsameModal, setShowEsameModal] = useState(false);
  const [newEsame, setNewEsame] = useState({ nome_esame: "", data_prevista: "" });
  const [savingEsame, setSavingEsame] = useState(false);

  const od = onboarding;
  const materie: string[] = od?.uni_esami?.map((e: any) => e.nome) || [];
  const serveAi: string[] = od?.serve_ai || [];
  const aiKeys = [...serveAi.filter(k => k in AI_ACTIONS), "libero"];

  useEffect(() => { if (!profileId) return; loadAll(); }, [profileId]);

  async function loadAll() {
    setLoadingEsami(true);
    setLoadingRicerche(true);
    try {
      // Onboarding
      const { data: prefs } = await (supabase as any)
        .from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
      const d = prefs?.data || {};
      setOnboarding(d);

      // Esami
      const { data: e } = await (supabase as any)
        .from("esami_utente").select("*").eq("profile_id", profileId)
        .eq("completato", false).order("data_prevista", { ascending: true });
      setEsami(e || []);
      setKpi(prev => ({ ...prev, esamiCount: e?.length || 0 }));

      // Sessioni settimana KPI + per materia
      const sevenAgo = subDays(new Date(), 7).toISOString();
      const { data: sessions } = await (supabase as any)
        .from("sessioni_studio").select("durata_minuti, materia")
        .eq("profile_id", profileId).gte("created_at", sevenAgo);
      if (sessions) {
        const sess = sessions.length;
        const ore = sessions.reduce((s: number, x: any) => s + (x.durata_minuti || 0), 0) / 60;
        setKpi(prev => ({ ...prev, sessioni: sess, ore: Math.round(ore * 10) / 10 }));
        const spm: Record<string, number> = {};
        sessions.forEach((s: any) => { if (s.materia) spm[s.materia] = (spm[s.materia] || 0) + 1; });
        setSessioniPerMateria(spm);
      }

      // Ricerche bibliografiche
      const { data: r } = await (supabase as any)
        .from("ricerche_bibliografiche").select("*").eq("profile_id", profileId)
        .order("created_at", { ascending: false }).limit(3);
      setRicerche(r || []);
    } finally {
      setLoadingEsami(false);
      setLoadingRicerche(false);
    }
  }

  function examBadge(dataPrevista: string | null): { label: string; cls: string } {
    if (!dataPrevista) return { label: "Data da definire", cls: "bg-muted text-muted-foreground" };
    const days = differenceInDays(new Date(dataPrevista), new Date());
    if (days < 0) return { label: "Concluso", cls: "bg-muted text-muted-foreground" };
    if (days < 10) return { label: `tra ${days} giorni`, cls: "bg-red-100 text-red-700" };
    if (days < 30) return { label: `tra ${days} giorni`, cls: "bg-yellow-100 text-yellow-700" };
    return { label: `tra ${days} giorni`, cls: "bg-green-100 text-green-700" };
  }

  function startFocus() {
    const dur = focusDuration === 0 ? parseInt(focusCustom) || 25 : focusDuration;
    const total = dur * 60;
    setFocusTotalSeconds(total);
    setFocusSecondsLeft(total);
    setFocusActive(true);
    focusInterval.current = setInterval(() => {
      setFocusSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(focusInterval.current!);
          setFocusActive(false);
          setShowFocusComplete(true);
          handleFocusComplete(dur);
          return total;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleFocusComplete(dur: number) {
    playBeep();
    if (profileId && focusMateria) {
      await (supabase as any).from("sessioni_studio").insert({
        profile_id: profileId, materia: focusMateria, durata_minuti: dur, tipo: "focus",
      });
    }
  }

  function stopFocus() {
    if (focusInterval.current) clearInterval(focusInterval.current);
    setFocusActive(false);
    setFocusSecondsLeft(focusTotalSeconds);
    setShowFocusConfirm(false);
  }

  async function saveEsame() {
    if (!newEsame.nome_esame.trim() || !profileId) return;
    setSavingEsame(true);
    const { error } = await (supabase as any).from("esami_utente").insert({
      profile_id: profileId, nome_esame: newEsame.nome_esame, data_prevista: newEsame.data_prevista || null, completato: false,
    });
    setSavingEsame(false);
    if (!error) {
      toast.success("Esame aggiunto!");
      setShowEsameModal(false);
      setNewEsame({ nome_esame: "", data_prevista: "" });
      loadAll();
    } else {
      toast.error("Errore nel salvataggio.");
    }
  }

  function openAiAction(key: string) {
    if (key === "libero") {
      navigate("/challenge/new");
      return;
    }
    const action = AI_ACTIONS[key];
    if (action) {
      localStorage.setItem("inschool-ai-prompt", action.prompt);
      navigate("/challenge/new");
    }
  }

  const focusProgress = focusActive ? Math.round(((focusTotalSeconds - focusSecondsLeft) / focusTotalSeconds) * 100) : 0;

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
            {(od?.uni_corso || od?.uni_nome || od?.uni_anno) && (
              <p className="text-muted-foreground mt-1 text-sm">
                {[od.uni_corso, od.uni_nome, od.uni_anno].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {[
                { label: `${kpi.sessioni} sessioni questa settimana`, icon: <Brain className="w-3.5 h-3.5" /> },
                { label: `${kpi.ore} ore totali`, icon: <Timer className="w-3.5 h-3.5" /> },
                { label: `${kpi.esamiCount} esami configurati`, icon: <GraduationCap className="w-3.5 h-3.5" /> },
              ].map((k, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5">
                  <span className="text-primary">{k.icon}</span>{k.label}
                </div>
              ))}
            </div>
          </div>
          <LogoutButton showLabel />
        </motion.div>

        {/* ESAMI IN VISTA */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Esami in vista</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setShowEsameModal(true)}>
              <Plus className="w-3 h-3 mr-1" />Aggiungi
            </Button>
          </div>
          {loadingEsami ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : esami.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Nessun esame configurato</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Aggiungili per tracciare i tuoi progressi</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl text-xs" onClick={() => setShowEsameModal(true)}>
                <Plus className="w-3 h-3 mr-1" />Aggiungi esame
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {esami.map((esame, i) => {
                const badge = examBadge(esame.data_prevista);
                const sessioni = sessioniPerMateria[esame.nome_esame] || 0;
                const progressPct = Math.min(100, (sessioni / 10) * 100);
                return (
                  <motion.div key={esame.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{esame.nome_esame}</p>
                        {esame.data_prevista && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {format(new Date(esame.data_prevista), "d MMMM yyyy", { locale: it })}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          <Progress value={progressPct} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground shrink-0">{sessioni}/10 sessioni</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                        <Button size="sm" variant="outline" className="rounded-xl text-xs h-8"
                          onClick={() => navigate(`/challenge/new?subject=${encodeURIComponent(esame.nome_esame)}`)}>
                          Studia
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* AZIONI RAPIDE AI */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Azioni rapide AI</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {aiKeys.map((key) => {
              if (key === "libero") {
                return (
                  <button key="libero" onClick={() => navigate("/challenge/new")}
                    className="bg-card border border-border rounded-2xl p-4 flex flex-col items-start gap-2 hover:border-primary/40 hover:shadow-md transition-all text-left">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <p className="text-sm font-medium text-foreground">Chat libera</p>
                  </button>
                );
              }
              const action = AI_ACTIONS[key];
              if (!action) return null;
              const Icon = action.icon;
              return (
                <button key={key} onClick={() => openAiAction(key)}
                  className="bg-card border border-border rounded-2xl p-4 flex flex-col items-start gap-2 hover:border-primary/40 hover:shadow-md transition-all text-left">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* TUNNEL DI FOCUS */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" /> Tunnel di Focus
          </h2>
          <AnimatePresence mode="wait">
            {!focusActive ? (
              <motion.div key="inactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-3">
                <p className="text-sm text-muted-foreground">Blocca le distrazioni e studia in profondità</p>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={String(focusDuration)} onValueChange={v => setFocusDuration(Number(v))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 minuti — Pomodoro</SelectItem>
                      <SelectItem value="50">50 minuti — Deep Work</SelectItem>
                      <SelectItem value="90">90 minuti — Ultra Focus</SelectItem>
                      <SelectItem value="0">Personalizzato</SelectItem>
                    </SelectContent>
                  </Select>
                  {focusDuration === 0 && (
                    <Input type="number" min="5" max="180" placeholder="Minuti" value={focusCustom}
                      onChange={e => setFocusCustom(e.target.value)} className="rounded-xl" />
                  )}
                </div>
                {esami.length > 0 && (
                  <Select value={focusMateria} onValueChange={setFocusMateria}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Collega un esame (opzionale)" /></SelectTrigger>
                    <SelectContent>{esami.map(e => <SelectItem key={e.id} value={e.nome_esame}>{e.nome_esame}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button onClick={startFocus} className="w-full rounded-xl font-semibold">
                  Avvia sessione
                </Button>
              </motion.div>
            ) : (
              <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{focusMateria || "Sessione Focus"}</p>
                <span className="text-7xl font-mono font-bold text-foreground tabular-nums block">
                  {fmtTime(focusSecondsLeft)}
                </span>
                <Progress value={focusProgress} className="h-2" />
                <Button variant="destructive" size="sm" className="rounded-xl"
                  onClick={() => setShowFocusConfirm(true)}>
                  Termina sessione
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* RICERCHE BIBLIOGRAFICHE */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ultime ricerche bibliografiche</h2>
          {loadingRicerche ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : ricerche.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Search className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna ricerca effettuata ancora</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl text-xs"
                onClick={() => openAiAction("ricerca")}>
                Prova la Ricerca Bibliografica
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {ricerche.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{r.argomento}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(r.created_at), { locale: it, addSuffix: true })}
                      {r.num_fonti > 0 && ` · ${r.num_fonti} fonti`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-xl text-xs shrink-0"
                    onClick={() => navigate("/challenge/new?subject=" + encodeURIComponent(r.argomento))}>
                    Riapri
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CONVERSAZIONI RECENTI */}
        <RecentConversations profileId={profileId} title="Sessioni di studio recenti" />

      </div>

      {/* DIALOG — AGGIUNGI ESAME */}
      <Dialog open={showEsameModal} onOpenChange={setShowEsameModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Aggiungi Esame</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome esame *</Label>
              <Input placeholder="es. Analisi Matematica II" value={newEsame.nome_esame}
                onChange={e => setNewEsame(p => ({ ...p, nome_esame: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Data prevista</Label>
              <Input type="date" value={newEsame.data_prevista}
                onChange={e => setNewEsame(p => ({ ...p, data_prevista: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEsameModal(false)} className="rounded-xl">Annulla</Button>
            <Button onClick={saveEsame} disabled={!newEsame.nome_esame.trim() || savingEsame}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              {savingEsame ? "Salvataggio..." : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG — CONFERMA STOP FOCUS */}
      <Dialog open={showFocusConfirm} onOpenChange={setShowFocusConfirm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Terminare la sessione?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 py-2">La sessione non verrà salvata se termini ora.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFocusConfirm(false)} className="rounded-xl">Continua</Button>
            <Button variant="destructive" onClick={stopFocus} className="rounded-xl">Termina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG — SESSIONE COMPLETATA */}
      <Dialog open={showFocusComplete} onOpenChange={setShowFocusComplete}>
        <DialogContent className="rounded-2xl text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mt-2" />
          <DialogHeader><DialogTitle className="text-center mt-2">Sessione completata!</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            {focusDuration || parseInt(focusCustom) || 25} minuti di focus
            {focusMateria ? ` su ${focusMateria}` : ""} registrati.
          </p>
          <Button className="rounded-xl w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => { setShowFocusComplete(false); setFocusSecondsLeft(focusTotalSeconds); }}>
            Ottimo!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
