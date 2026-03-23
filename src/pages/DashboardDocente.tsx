import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, FileText, BarChart2, Copy, CheckSquare,
  Minus, Printer, Trash2, Eye, ChevronDown, ChevronUp,
  AlertTriangle, UserCheck, RefreshCw, LayoutDashboard,
  AlertCircle, Send, Brain, Shield, Link2, Clock,
  Calendar, CalendarDays, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

// ============ TEACHER RESULTS SECTION ============
function TeacherResultsSection({ profileId }: { profileId: string | undefined }) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadAssignments();
  }, [user]);

  async function loadAssignments() {
    setLoading(true);
    const { data: ta } = await supabase
      .from("teacher_assignments")
      .select("*")
      .eq("teacher_id", user!.id)
      .in("type", ["verifica", "compito", "esercizi"])
      .order("assigned_at", { ascending: false })
      .limit(20);
    setAssignments(ta || []);
    if (ta && ta.length > 0) {
      const ids = ta.map((a: any) => a.id);
      const { data: ar } = await supabase
        .from("assignment_results")
        .select("*")
        .in("assignment_id", ids);
      const grouped: Record<string, any[]> = {};
      for (const r of (ar || [])) {
        if (!grouped[r.assignment_id!]) grouped[r.assignment_id!] = [];
        grouped[r.assignment_id!].push(r);
      }
      setResults(grouped);
    }
    setLoading(false);
  }

  async function createFollowUp(assignmentId: string, type: "recupero" | "potenziamento") {
    const original = assignments.find(a => a.id === assignmentId);
    if (!original || !user) return;
    await supabase.from("teacher_assignments").insert({
      teacher_id: user.id,
      class_id: original.class_id,
      title: `${type === "recupero" ? "Recupero" : "Potenziamento"}: ${original.title}`,
      type,
      subject: original.subject,
      description: `${type === "recupero" ? "Attività di recupero" : "Attività di potenziamento"} basata su: ${original.title}`,
    });
    toast.success(`${type === "recupero" ? "Recupero" : "Potenziamento"} assegnato!`);
    loadAssignments();
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4" /> Risultati verifiche
        </h2>
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }

  if (assignments.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <BarChart2 className="w-4 h-4" /> Risultati verifiche
      </h2>
      <div className="space-y-3">
        {assignments.map(a => {
          const res = results[a.id] || [];
          const completed = res.filter((r: any) => r.status === "completed").length;
          const total = res.length || 0;
          const isExpanded = expandedId === a.id;
          const avgScore = completed > 0
            ? Math.round(res.filter((r: any) => r.score != null).reduce((s: number, r: any) => s + (r.score || 0), 0) / completed)
            : null;

          return (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{a.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {a.subject && <Badge variant="secondary" className="text-xs">{a.subject}</Badge>}
                    <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge>
                    {a.assigned_at && (
                      <span className="text-xs text-slate-400">
                        {format(new Date(a.assigned_at), "d MMM", { locale: it })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {total > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{completed}/{total} completati</p>
                      {avgScore !== null && (
                        <p className="text-xs font-semibold text-slate-900">Media: {avgScore}%</p>
                      )}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                      {res.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-3">Nessuno studente ha completato questa verifica</p>
                      ) : (
                        <div className="space-y-1.5">
                          {res.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                              <div className="flex items-center gap-2">
                                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-sm text-slate-700">Studente</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={r.status === "completed" ? "default" : "secondary"} className="text-xs capitalize">
                                  {r.status === "completed" ? "Completato" : r.status === "in_progress" ? "In corso" : "Assegnato"}
                                </Badge>
                                {r.score != null && <span className="text-sm font-semibold">{Math.round(r.score)}%</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg text-xs flex-1" onClick={() => createFollowUp(a.id, "recupero")}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Recupero
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-lg text-xs flex-1" onClick={() => createFollowUp(a.id, "potenziamento")}>
                          <Plus className="w-3 h-3 mr-1" /> Potenziamento
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ MAIN DASHBOARD ============
export default function DashboardDocente() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;

  const [onboarding, setOnboarding] = useState<any>({});
  const [classi, setClassi] = useState<any[]>([]);
  const [loadingClassi, setLoadingClassi] = useState(true);
  const [materialiCount, setMaterialiCount] = useState(0);
  const [materialiNonAssegnati, setMaterialiNonAssegnati] = useState(0);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [daSegurireCount, setDaSegurireCount] = useState(0);
  const [classiConAlert, setClassiConAlert] = useState(0);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Coach presence
  const [coachInput, setCoachInput] = useState('');
  const [coachMessage, setCoachMessage] = useState('');
  const [isLoadingCoachMsg, setIsLoadingCoachMsg] = useState(true);

  // Modal nuova classe
  const [showClasseModal, setShowClasseModal] = useState(false);
  const [newClasse, setNewClasse] = useState({ nome: "", materia: "", ordine_scolastico: "", num_studenti: "" });
  const [savingClasse, setSavingClasse] = useState(false);
  const [classeCreata, setClasseCreata] = useState<any>(null);

  const od = onboarding;
  const materie: string[] = od?.docente_materie || [];
  const ordine: string = od?.docente_ordine || "";
  const cognome = profile?.name?.split(" ").slice(-1)[0] || profile?.name || "";
  const studentiCount = classi.reduce((s, c) => s + (c.num_studenti || 0), 0);
  const { user } = useAuth();
  const userId = user?.id; // auth.users.id for tables referencing auth.users

  useEffect(() => { if (!profileId) return; loadAll(); }, [profileId, userId]);

  // Auto-open "Nuova classe" modal from sidebar link (?nuova=1) or custom event
  useEffect(() => {
    if (searchParams.get('nuova') === '1') {
      setShowClasseModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = () => setShowClasseModal(true);
    window.addEventListener("inschool:nuova-classe", handler);
    return () => window.removeEventListener("inschool:nuova-classe", handler);
  }, []);

  // Coach message
  useEffect(() => {
    const cached = sessionStorage.getItem('teacher_coach_msg');
    if (cached) {
      setCoachMessage(cached);
      setIsLoadingCoachMsg(false);
      return;
    }
    if (!profileId || classi.length === 0) { setIsLoadingCoachMsg(false); return; }
    supabase.functions.invoke('coach-teacher-message', {
      body: {
        teacherName: profile?.name || '',
        activeClasses: classi.map(c => ({ id: c.id, name: c.nome, subject: c.materia, studentCount: c.num_studenti || 0 })),
        recentFeed: feedItems.slice(0, 5).map(f => ({ type: f.type, message: f.message, severity: f.severity })),
        currentHour: new Date().getHours(),
        materialsThisWeek: materialiCount,
        openVerifications: assignments.filter(a => a.type === 'verifica').length,
      }
    }).then(({ data }) => {
      const msg = data?.message || '';
      setCoachMessage(msg);
      if (msg) sessionStorage.setItem('teacher_coach_msg', msg);
      setIsLoadingCoachMsg(false);
    }).catch(() => setIsLoadingCoachMsg(false));
  }, [classi.length, feedItems.length]);

  async function loadAll() {
    setLoadingClassi(true);
    try {
      const { data: prefs } = await (supabase as any)
        .from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
      setOnboarding(prefs?.data || {});

      const { data: c } = await (supabase as any)
        .from("classi").select("*").eq("docente_profile_id", profileId)
        .order("created_at", { ascending: false });
      setClassi(c || []);

      // Use userId (auth.users.id) for tables that reference auth.users
      const teacherId = userId || profileId;

      // Materials count
      const { data: mats } = await (supabase as any)
        .from("teacher_materials").select("id, status")
        .eq("teacher_id", teacherId);
      setMaterialiCount(mats?.length || 0);
      setMaterialiNonAssegnati(mats?.filter((m: any) => m.status === 'draft' || m.status === 'salvato').length || 0);

      // Assignments
      const { data: ta } = await (supabase as any)
        .from("teacher_assignments").select("*")
        .eq("teacher_id", teacherId)
        .order("assigned_at", { ascending: false })
        .limit(20);
      setAssignments(ta || []);

      // Feed
      const { data: feed } = await (supabase as any)
        .from("teacher_activity_feed").select("*")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })
        .limit(20);
      setFeedItems(feed || []);

      // Da seguire
      const unread = (feed || []).filter((f: any) => !f.read_at && (f.severity === 'warning' || f.severity === 'urgent'));
      setDaSegurireCount(unread.length);
      const uniqueClasses = new Set(unread.map((f: any) => f.class_id).filter(Boolean));
      setClassiConAlert(uniqueClasses.size);
    } finally {
      setLoadingClassi(false);
    }
  }

  async function saveClasse() {
    if (!newClasse.nome.trim() || !profileId) return;
    setSavingClasse(true);
    const { data, error } = await (supabase as any)
      .from("classi").insert({
        docente_profile_id: profileId,
        nome: newClasse.nome,
        materia: newClasse.materia || null,
        ordine_scolastico: newClasse.ordine_scolastico || ordine || null,
        num_studenti: newClasse.num_studenti ? parseInt(newClasse.num_studenti) : 0,
      }).select().single();
    setSavingClasse(false);
    if (!error && data) {
      setClasseCreata(data);
      setNewClasse({ nome: "", materia: "", ordine_scolastico: "", num_studenti: "" });
      loadAll();
    } else {
      toast.error("Errore nella creazione della classe.");
    }
  }

  const handleCoachSend = () => {
    if (!coachInput.trim()) return;
    navigate(`/challenge/new?msg=${encodeURIComponent(coachInput)}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ━━━ BLOCCO 1 — TOPBAR ━━━ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {getGreeting()}, Prof. {cognome}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}{classi.length} {classi.length === 1 ? 'classe attiva' : 'classi attive'}
            </p>
          </div>
          <button
            onClick={() => setShowClasseModal(true)}
            className="flex items-center gap-2 bg-[#0070C0] hover:bg-[#005fa3] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova classe
          </button>
        </div>

        {/* ━━━ BLOCCO 2 — KPI ROW ━━━ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Classi attive */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wide font-semibold text-slate-400">Classi attive</span>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold text-[#1A3A5C]">{classi.length}</p>
          </div>
          {/* Studenti */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wide font-semibold text-slate-400">Studenti totali</span>
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold text-[#1A3A5C]">{studentiCount}</p>
          </div>
          {/* Materiali */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wide font-semibold text-slate-400">Materiali</span>
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold text-[#1A3A5C]">{materialiCount}</p>
            {materialiNonAssegnati > 0 && (
              <p className="text-xs text-amber-600 mt-1">{materialiNonAssegnati} non assegnati</p>
            )}
          </div>
          {/* Da seguire */}
          <div className={`rounded-xl p-5 shadow-sm border ${daSegurireCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs uppercase tracking-wide font-semibold ${daSegurireCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>Da seguire</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${daSegurireCount > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                <AlertCircle className={`w-4 h-4 ${daSegurireCount > 0 ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
            </div>
            <p className={`font-display text-3xl font-bold ${daSegurireCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>{daSegurireCount}</p>
            {daSegurireCount > 0 && (
              <p className="text-xs text-amber-600 mt-1">In {classiConAlert} {classiConAlert === 1 ? 'classe' : 'classi'}</p>
            )}
          </div>
        </div>

        {/* ━━━ BLOCCO 3 — COME STAI OGGI? ━━━ */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 bg-[#1A3A5C] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              {isLoadingCoachMsg ? (
                <div className="space-y-2">
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
                </div>
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {coachMessage || 'Buongiorno. Da dove vuoi iniziare oggi?'}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="font-semibold text-[#1A3A5C] text-sm mb-1">Come stai oggi?</p>
            <p className="text-xs text-slate-500 mb-4">
              Uno spazio riservato per aiutarti a gestire meglio carico,
              complessità e situazioni educative delicate.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCoachSend()}
                placeholder="Parla con il tuo coach..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#0070C0] focus:ring-2 focus:ring-[#0070C0]/20 bg-slate-50"
              />
              <button
                onClick={handleCoachSend}
                disabled={!coachInput.trim()}
                className="bg-[#0070C0] hover:bg-[#005fa3] disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'Organizza il lavoro', prompt: 'organizza' },
                { label: 'Chiedi un suggerimento', prompt: '' },
                { label: 'Rivedi le priorità', prompt: 'priorita' },
              ].map(({ label, prompt }) => (
                <button
                  key={label}
                  onClick={() => navigate(`/challenge/new${prompt ? `?prompt=${prompt}` : ''}`)}
                  className="text-xs border border-slate-200 hover:border-[#0070C0] hover:text-[#0070C0] text-slate-500 px-3 py-1.5 rounded-lg transition-colors bg-white"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ━━━ BLOCCO 3.5 — CALENDARIO PROFESSIONALE ━━━ */}
        {assignments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-widest font-semibold text-slate-400 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Scadenze e impegni
              </h2>
            </div>
            <div className="space-y-2">
              {assignments
                .filter(a => a.due_date)
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                .slice(0, 6)
                .map((a: any) => {
                  const dueDate = new Date(a.due_date);
                  const now = new Date();
                  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysLeft < 0;
                  const isUrgent = daysLeft >= 0 && daysLeft <= 2;
                  const className = classi.find(c => c.id === a.class_id);

                  return (
                    <div
                      key={a.id}
                      onClick={() => a.class_id && navigate(`/classe/${a.class_id}?tab=materiali`)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isOverdue ? 'bg-red-50 border border-red-200 hover:bg-red-100' :
                        isUrgent ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100' :
                        'bg-slate-50 border border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-center shrink-0 w-12">
                        <p className={`text-lg font-bold ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-700'}`}>
                          {dueDate.getDate()}
                        </p>
                        <p className="text-[10px] uppercase text-slate-400">
                          {dueDate.toLocaleDateString('it-IT', { month: 'short' })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.subject && <span className="text-xs text-slate-500">{a.subject}</span>}
                          {className && <span className="text-xs text-slate-400">· {className.nome}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Scaduto</span>}
                        {isUrgent && !isOverdue && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{daysLeft === 0 ? 'Oggi' : daysLeft === 1 ? 'Domani' : `${daysLeft}g`}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          a.type === 'verifica' ? 'bg-purple-100 text-purple-700' :
                          a.type === 'recupero' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{a.type}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
            </div>
            {assignments.filter(a => a.due_date).length === 0 && (
              <div className="text-center py-6">
                <Calendar className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nessuna scadenza imminente</p>
              </div>
            )}
          </div>
        )}

        {/* ━━━ BLOCCO 4 — CARD CLASSI ━━━ */}
        <div>
          <h2 className="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-4">Le tue classi</h2>
          {loadingClassi ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : classi.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-500 mb-1">Nessuna classe ancora</p>
              <p className="text-sm text-slate-400 mb-4">Crea la prima classe e condividi il codice con i tuoi studenti</p>
              <button onClick={() => setShowClasseModal(true)} className="text-sm text-[#0070C0] font-medium hover:underline">
                + Crea la prima classe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classi.map((cl, i) => {
                const classUnread = feedItems.filter((f: any) => f.class_id === cl.id && !f.read_at && (f.severity === 'warning' || f.severity === 'urgent')).length;
                const dotColor = classUnread > 0 ? 'bg-amber-400' : 'bg-green-400';
                return (
                  <motion.div
                    key={cl.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/classe/${cl.id}`)}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                      <span className="font-semibold text-slate-900 truncate flex-1">{cl.nome}</span>
                      {cl.materia && (
                        <span className="text-xs bg-[#0070C0]/10 text-[#0070C0] px-2 py-0.5 rounded-full flex-shrink-0">{cl.materia}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500"><span className="font-semibold text-slate-700">{cl.num_studenti || 0}</span> studenti</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500"><span className="font-semibold text-slate-700">{materialiCount}</span> materiali</span>
                      <span className="text-slate-300">·</span>
                      <span className={classUnread > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                        {classUnread} da seguire
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ━━━ BLOCCO 5 — FEED ATTIVITÀ ━━━ */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Attività recenti
          </h2>
          {feedItems.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nessuna attività recente</p>
              <p className="text-xs text-slate-300 mt-1">Le attività appariranno quando gli studenti useranno la piattaforma</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feedItems.slice(0, 8).map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    item.severity === 'urgent' ? 'bg-red-500' :
                    item.severity === 'positive' ? 'bg-green-500' :
                    item.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{item.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(item.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {item.action_label && (
                    <button onClick={() => navigate(item.action_route)} className="text-xs text-[#0070C0] font-medium hover:underline flex-shrink-0 ml-2">
                      {item.action_label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ━━━ BLOCCO 6 — BLOCKCHAIN PLACEHOLDERS ━━━ */}
        <div>
          <h2 className="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-4">Certificazione & Conformità</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Credenziali On-Chain */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">In arrivo</span>
              </div>
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Credenziali verificabili</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Le competenze dei tuoi studenti diventeranno certificati Soulbound verificabili su blockchain privata (ERC-5192).
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-400 font-mono">Contratto: non configurato</span>
                </div>
              </div>
            </div>

            {/* AI Audit Trail */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">In arrivo</span>
              </div>
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">AI Audit Trail</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ogni sessione AI verrà registrata on-chain con hash immutabile. Conformità EU AI Act (scadenza: 2 agosto 2026).
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-400 font-mono">Governance: non configurato</span>
                </div>
              </div>
            </div>

            {/* EU AI Act */}
            <div className="bg-[#1A3A5C] border border-[#1A3A5C] rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">Scadenza: ago 2026</span>
              </div>
              <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center mb-4">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">EU AI Act — Conformità</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                InSchool sarà conforme all'EU AI Act (Annex III — sistemi ad alto rischio in educazione) entro la deadline obbligatoria.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="text-xs text-white/40 font-mono">Compliance: non configurato</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            La blockchain privata è in fase di configurazione. Le variabili d'ambiente verranno aggiunte quando pronta.
          </p>
        </div>

        {/* ━━━ RISULTATI VERIFICHE ━━━ */}
        <TeacherResultsSection profileId={profileId} />

      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Nuova classe */}
      <Dialog open={showClasseModal && !classeCreata} onOpenChange={v => { setShowClasseModal(v); if (!v) setClasseCreata(null); }}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle>Nuova Classe</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome classe *</Label>
              <Input placeholder="es. 3A, 4B, 5C..." value={newClasse.nome}
                onChange={e => setNewClasse(p => ({ ...p, nome: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Materia</Label>
              {materie.length > 0 ? (
                <Select value={newClasse.materia} onValueChange={v => setNewClasse(p => ({ ...p, materia: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona materia" /></SelectTrigger>
                  <SelectContent>{materie.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input placeholder="es. Matematica" value={newClasse.materia}
                  onChange={e => setNewClasse(p => ({ ...p, materia: e.target.value }))} className="mt-1" />
              )}
            </div>
            <div>
              <Label>Ordine scolastico</Label>
              <Select value={newClasse.ordine_scolastico} onValueChange={v => setNewClasse(p => ({ ...p, ordine_scolastico: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={ordine || "Seleziona..."} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scuola Primaria">Scuola Primaria</SelectItem>
                  <SelectItem value="Scuola Secondaria I grado">Scuola Secondaria I grado</SelectItem>
                  <SelectItem value="Scuola Secondaria II grado">Scuola Secondaria II grado</SelectItem>
                  <SelectItem value="Università">Università</SelectItem>
                  <SelectItem value="Formazione Professionale">Formazione Professionale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero studenti</Label>
              <Input type="number" min="0" placeholder="es. 25" value={newClasse.num_studenti}
                onChange={e => setNewClasse(p => ({ ...p, num_studenti: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClasseModal(false)}>Annulla</Button>
            <Button onClick={saveClasse} disabled={!newClasse.nome.trim() || savingClasse}>
              {savingClasse ? "Creazione..." : "Crea classe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Classe creata */}
      <Dialog open={!!classeCreata} onOpenChange={() => { setClasseCreata(null); setShowClasseModal(false); }}>
        <DialogContent className="rounded-xl text-center">
          <CheckSquare className="w-10 h-10 text-[#0070C0] mx-auto mt-2" />
          <DialogHeader><DialogTitle className="text-center mt-2">Classe creata!</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Condividi questo codice con i tuoi studenti</p>
          <div className="bg-slate-50 rounded-xl py-5 px-4 my-2">
            <p className="font-mono font-black text-4xl tracking-[0.3em] text-slate-900">
              {classeCreata?.codice_invito}
            </p>
          </div>
          <Button className="w-full"
            onClick={() => {
              navigator.clipboard.writeText(classeCreata?.codice_invito);
              toast.success("Codice copiato!");
              setClasseCreata(null);
              setShowClasseModal(false);
            }}>
            <Copy className="w-4 h-4 mr-2" />Copia codice e chiudi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
