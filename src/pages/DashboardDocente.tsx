import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, Plus, FileText, LayoutDashboard, AlertCircle,
  Send, Brain, Copy, CheckSquare, ChevronRight,
  Calendar, Clock, FolderOpen, MoreVertical, Pencil, Trash2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentLang } from "@/lib/langUtils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function DashboardDocente() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;
  const { user } = useAuth();
  const userId = user?.id;

  const [onboarding, setOnboarding] = useState<any>({});
  const [classi, setClassi] = useState<any[]>([]);
  const [loadingClassi, setLoadingClassi] = useState(true);
  const [materialiCount, setMaterialiCount] = useState(0);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [daSegurireCount, setDaSegurireCount] = useState(0);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Coach — home shows only initial message (no inline replies)
  const [coachLastMsg, setCoachLastMsg] = useState("");
  const [coachInput, setCoachInput] = useState("");
  const [isLoadingCoachMsg, setIsLoadingCoachMsg] = useState(true);

  // Modal
  const [showClasseModal, setShowClasseModal] = useState(false);
  const [newClasse, setNewClasse] = useState({ nome: "", materie: [] as string[], ordine_scolastico: "", num_studenti: "" });
  const [savingClasse, setSavingClasse] = useState(false);
  const [classeCreata, setClasseCreata] = useState<any>(null);
  const [showCustomSubject, setShowCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState("");

  // Delete class
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deletingClasse, setDeletingClasse] = useState(false);

  // Crea materiale — class picker
  const [showMaterialClassPicker, setShowMaterialClassPicker] = useState(false);
  const [selectedMaterialClassId, setSelectedMaterialClassId] = useState("");

  const od = onboarding;
  const materie: string[] = od?.docente_materie || [];
  const ordine: string = od?.docente_ordine || "";
  const cognome = profile?.name?.split(" ").slice(-1)[0] || profile?.name || "";
  const studentiCount = classi.reduce((s, c) => s + (c.num_studenti || 0), 0);

  // Subject lists by school level
  const SUBJECTS_BY_LEVEL: Record<string, string[]> = {
    "Scuola Primaria": ["Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Arte e Immagine", "Musica", "Educazione Fisica", "Religione"],
    "Scuola Secondaria I grado": ["Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Seconda lingua comunitaria", "Arte e Immagine", "Musica", "Tecnologia", "Educazione Fisica", "Religione"],
    "Scuola Secondaria II grado": ["Italiano", "Matematica", "Fisica", "Chimica", "Storia", "Filosofia", "Inglese", "Scienze Naturali", "Latino", "Greco", "Informatica", "Economia", "Diritto", "Arte", "Musica", "Educazione Fisica", "Religione"],
    "Università": materie.length > 0 ? materie : [],
  };

  const effectiveOrdine = newClasse.ordine_scolastico || ordine || "";
  const availableSubjects = SUBJECTS_BY_LEVEL[effectiveOrdine] || [];
  const isUniversitaFreeText = effectiveOrdine === "Università" && availableSubjects.length === 0;

  useEffect(() => { if (!profileId) return; loadAll(); }, [profileId, userId]);

  useEffect(() => {
    if (searchParams.get("nuova") === "1") {
      setShowClasseModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = () => setShowClasseModal(true);
    window.addEventListener("inschool:nuova-classe", handler);
    return () => window.removeEventListener("inschool:nuova-classe", handler);
  }, []);

  // Coach initial message with TTL cache
  const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  const BEHAVIOR_TTL = 30 * 60 * 1000; // 30 minutes
  useEffect(() => {
    if (!profileId) { setIsLoadingCoachMsg(false); return; }

    const cachedMsg = sessionStorage.getItem("teacher_coach_msg");
    const cachedAt = sessionStorage.getItem("teacher_coach_msg_at");
    const cachedDataHash = sessionStorage.getItem("teacher_coach_data_hash");
    const currentDataHash = `${classi.length}-${feedItems.length}-${materialiCount}-${assignments.length}`;
    const isExpired = !cachedAt || Date.now() - parseInt(cachedAt) > CACHE_TTL;
    const dataChanged = cachedDataHash !== currentDataHash;

    if (cachedMsg && !isExpired && !dataChanged) {
      setCoachLastMsg(cachedMsg);
      setIsLoadingCoachMsg(false);
      return;
    }

    // Welcome message for teachers with no classes yet
    if (classi.length === 0 && !loadingClassi) {
      const welcomeMsg = "Benvenuto! Sono pronto ad aiutarti. Il primo passo è creare la tua prima classe — ci vogliono meno di un minuto. Vuoi iniziare?";
      setCoachLastMsg(welcomeMsg);
      setIsLoadingCoachMsg(false);
      return;
    }

    if (loadingClassi) return;

    // FIX 4: Call teacher-behavior-data FIRST, then coach-teacher-message
    const fetchCoach = async () => {
      try {
        // Step 1: Refresh behavior data if stale
        const behaviorCheckedAt = sessionStorage.getItem("behaviorCheckedAt");
        const shouldRefreshBehavior = !behaviorCheckedAt || Date.now() - parseInt(behaviorCheckedAt) > BEHAVIOR_TTL;

        if (shouldRefreshBehavior) {
          await supabase.functions.invoke("teacher-behavior-data", {
            body: { teacherProfileId: profileId },
          });
          sessionStorage.setItem("behaviorCheckedAt", Date.now().toString());
        }

        // Step 2: Now call coach with up-to-date behavior data
        const { data } = await supabase.functions.invoke("coach-teacher-message", {
          body: {
            teacherName: profile?.name || "",
            teacherProfileId: profileId,
            teacherSubjects: materie.length > 0 ? materie : (profile?.favorite_subjects || []),
            activeClasses: classi.map(c => ({ id: c.id, name: c.nome, subject: c.materia, studentCount: c.num_studenti || 0 })),
            recentFeed: feedItems.slice(0, 5).map(f => ({ type: f.type, message: f.message, severity: f.severity })),
            currentHour: new Date().getHours(),
            materialsThisWeek: materialiCount,
            openVerifications: assignments.filter(a => a.type === "verifica").length,
            lang: getCurrentLang(),
          },
        });

        const msg = data?.message || "Bentornato. Pronto per una nuova giornata di lavoro?";
        setCoachLastMsg(msg);
        sessionStorage.setItem("teacher_coach_msg", msg);
        sessionStorage.setItem("teacher_coach_msg_at", Date.now().toString());
        sessionStorage.setItem("teacher_coach_data_hash", currentDataHash);
      } catch {
        setCoachLastMsg("Bentornato. Da dove vuoi partire oggi?");
      } finally {
        setIsLoadingCoachMsg(false);
      }
    };

    fetchCoach();
  }, [classi.length, feedItems.length, materialiCount, assignments.length, loadingClassi]);

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

      const teacherId = userId || profileId;

      const { data: mats } = await (supabase as any)
        .from("teacher_materials").select("id, status").eq("teacher_id", teacherId);
      setMaterialiCount(mats?.length || 0);

      const { data: ta } = await (supabase as any)
        .from("teacher_assignments").select("*").eq("teacher_id", teacherId)
        .order("assigned_at", { ascending: false }).limit(20);
      setAssignments(ta || []);

      const { data: feed } = await (supabase as any)
        .from("teacher_activity_feed").select("*").eq("teacher_id", teacherId)
        .order("created_at", { ascending: false }).limit(20);
      setFeedItems(feed || []);

      const unread = (feed || []).filter((f: any) => !f.read_at && (f.severity === "warning" || f.severity === "urgent"));
      setDaSegurireCount(unread.length);
    } finally {
      setLoadingClassi(false);
    }
  }

  async function saveClasse() {
    if (!newClasse.nome.trim() || newClasse.materie.length === 0 || !profileId) return;
    setSavingClasse(true);
    const { data, error } = await (supabase as any)
      .from("classi").insert({
        docente_profile_id: profileId,
        nome: newClasse.nome,
        materia: newClasse.materie.join(", "),
        ordine_scolastico: newClasse.ordine_scolastico || ordine || null,
        num_studenti: newClasse.num_studenti ? parseInt(newClasse.num_studenti) : 0,
      }).select().single();
    setSavingClasse(false);
    if (!error && data) {
      setClasseCreata(data);
      setNewClasse({ nome: "", materie: [], ordine_scolastico: "", num_studenti: "" });
      loadAll();
    } else {
      toast.error("Errore nella creazione della classe.");
    }
  }

  async function deleteClasse(classeId: string) {
    setDeletingClasse(true);
    // Unlink materials (set class_id to null)
    await (supabase as any).from("teacher_materials").update({ class_id: null }).eq("class_id", classeId);
    // Delete enrollments
    await (supabase as any).from("class_enrollments").delete().eq("class_id", classeId);
    // Delete assignments
    await (supabase as any).from("teacher_assignments").delete().eq("class_id", classeId);
    // Delete feed
    await (supabase as any).from("teacher_activity_feed").delete().eq("class_id", classeId);
    // Delete class
    const { error } = await (supabase as any).from("classi").delete().eq("id", classeId);
    setDeletingClasse(false);
    setDeleteTarget(null);
    if (!error) {
      toast.success("Classe eliminata correttamente.");
      loadAll();
    } else {
      toast.error("Errore nell'eliminazione della classe.");
    }
  }

  function navigateToCoach(msg?: string) {
    const text = msg || coachInput.trim();
    if (!text) return;
    setCoachInput("");
    navigate("/coach-docente", { state: { initialMessage: text } });
  }

  // Upcoming deadlines (today + 3 days), deduplicated
  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const seenIds = new Set<string>();
  const upcomingDeadlines = assignments
    .filter(a => {
      if (!a.due_date || seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      const d = new Date(a.due_date);
      return d >= new Date(now.toDateString()) && d < threeDaysFromNow;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // Feed alerts per class
  const classFeedMap = new Map<string, number>();
  feedItems.filter(f => !f.read_at && (f.severity === "warning" || f.severity === "urgent")).forEach(f => {
    if (f.class_id) classFeedMap.set(f.class_id, (classFeedMap.get(f.class_id) || 0) + 1);
  });

  return (
    <div className="pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ━━━ BLOCK 1 — HEADER ━━━ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {getGreeting()}, Prof. {cognome}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <Button onClick={() => setShowClasseModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuova classe
          </Button>
        </div>

        {/* ━━━ BLOCK 2 — COACH (compact — single message) ━━━ */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1">
              {isLoadingCoachMsg ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-foreground font-medium line-clamp-2">
                    {coachLastMsg || "Bentornato. Pronto per una nuova giornata di lavoro?"}
                  </p>
                  {/* Inline CTA for welcome message */}
                  {classi.length === 0 && !loadingClassi && (
                    <div className="mt-2">
                      <Button size="sm" onClick={() => setShowClasseModal(true)} className="gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Crea la prima classe
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && navigateToCoach()}
              placeholder="Scrivi al coach..."
              className="flex-1 text-sm border border-input rounded-lg px-3 py-2.5 bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 transition-colors"
            />
            <button
              onClick={() => navigateToCoach()}
              disabled={!coachInput.trim()}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2.5 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Organizza il lavoro", "Chiedi un suggerimento", "Rivedi le priorità"].map((label) => (
              <button
                key={label}
                onClick={() => navigateToCoach(label)}
                className="text-xs border border-border hover:border-primary hover:text-primary text-muted-foreground px-3 py-1.5 rounded-lg transition-colors bg-card"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ━━━ BLOCK 3 — KPI ━━━ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Classi attive", value: classi.length, icon: LayoutDashboard, color: "text-primary bg-primary/10" },
            { label: "Studenti totali", value: studentiCount, icon: Users, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" },
            { label: "Materiali creati", value: materialiCount, icon: FileText, color: "text-violet-600 bg-violet-50 dark:bg-violet-950" },
            { label: "Da seguire", value: daSegurireCount, icon: AlertCircle, color: daSegurireCount > 0 ? "text-amber-600 bg-amber-50 dark:bg-amber-950" : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{loadingClassi ? "–" : value}</p>
            </div>
          ))}
        </div>

        {/* ━━━ BLOCK 4 — LE TUE CLASSI ━━━ */}
        <div>
          <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">Le tue classi</h2>
          {loadingClassi ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : classi.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna classe ancora</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowClasseModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Crea la prima classe
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classi.map(c => {
                const alertCount = classFeedMap.get(c.id) || 0;
                const hasAlert = alertCount > 0;
                return (
                  <div
                    key={c.id}
                    className="bg-card border border-border rounded-xl p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group relative"
                  >
                    <div className="absolute top-2 right-2 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={e => e.stopPropagation()}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/classe/${c.id}`)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Modifica classe
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina classe
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <button onClick={() => navigate(`/classe/${c.id}`)} className="w-full text-left">
                      <div className="flex items-center justify-between mb-1 pr-6">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${hasAlert ? "bg-amber-400" : "bg-emerald-400"}`} />
                          <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{c.nome}</span>
                        </div>
                        {hasAlert && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {alertCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{c.materia || "–"}</span>
                        <span className="text-xs text-muted-foreground">{c.num_studenti || 0} studenti</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ━━━ BLOCK 5 — AZIONI RAPIDE ━━━ */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowMaterialClassPicker(true)}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium text-sm py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crea materiale
          </button>
          <button
            onClick={() => navigate("/materiali-docente")}
            className="flex items-center justify-center gap-2 bg-card border border-border text-foreground font-medium text-sm py-3.5 rounded-xl hover:bg-accent transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            I miei materiali
          </button>
        </div>

        {/* ━━━ BLOCK 6 — TWO COLUMNS ━━━ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left — Scadenze imminenti */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Scadenze imminenti
            </h2>
            {upcomingDeadlines.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nessuna scadenza oggi o domani</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 4).map(a => {
                  const dueDate = new Date(a.due_date);
                  const isToday = dueDate.toDateString() === now.toDateString();
                  const className = classi.find(cl => cl.id === a.class_id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => a.class_id && navigate(`/classe/${a.class_id}?tab=materiali`)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isToday ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" : "bg-muted/50 border border-border"
                      } hover:shadow-sm`}
                    >
                      <div className="text-center w-10 shrink-0">
                        <p className={`text-base font-bold ${isToday ? "text-amber-600" : "text-foreground"}`}>{dueDate.getDate()}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{format(dueDate, "MMM", { locale: it })}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.subject}{className ? ` · ${className.nome}` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${
                        a.type === "verifica" ? "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" : "bg-primary/10 text-primary"
                      }`}>{a.type}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {upcomingDeadlines.length > 4 && (
              <button onClick={() => navigate("/agenda-docente")} className="w-full text-center text-xs text-primary font-medium hover:underline mt-3 py-1">
                Vedi tutte
              </button>
            )}
          </div>

          {/* Right — Attività recenti */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Attività recenti
            </h2>
            {feedItems.length === 0 ? (
              <div className="text-center py-6">
                <Clock className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nessuna attività recente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {feedItems.slice(0, 4).map(item => {
                  const diffMs = Date.now() - new Date(item.created_at).getTime();
                  const diffMin = Math.floor(diffMs / 60000);
                  let timeLabel = "";
                  if (diffMin < 1) timeLabel = "Ora";
                  else if (diffMin < 60) timeLabel = `${diffMin}min fa`;
                  else if (diffMin < 1440) timeLabel = `${Math.floor(diffMin / 60)}h fa`;
                  else { const d = Math.floor(diffMin / 1440); timeLabel = d === 1 ? "Ieri" : `${d}g fa`; }

                  const relatedClass = classi.find(cl => cl.id === item.class_id);
                  const severityDot: Record<string, string> = {
                    urgent: "bg-destructive", warning: "bg-amber-400", positive: "bg-emerald-400", info: "bg-primary/60",
                  };

                  return (
                    <div
                      key={item.id}
                      onClick={() => item.action_route ? navigate(item.action_route) : (item.class_id && navigate(`/classe/${item.class_id}`))}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border cursor-pointer hover:shadow-sm transition-all"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot[item.severity] || severityDot.info}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{item.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {relatedClass && <span className="text-[11px] text-muted-foreground font-medium">{relatedClass.nome}</span>}
                          <span className="text-[11px] text-muted-foreground">{timeLabel}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                    </div>
                  );
                })}
              </div>
            )}
            {feedItems.length > 4 && (
              <button onClick={() => navigate("/agenda-docente")} className="w-full text-center text-xs text-primary font-medium hover:underline mt-3 py-1">
                Vedi tutte
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ DIALOGS ═══ */}
      <Dialog open={showClasseModal && !classeCreata} onOpenChange={v => { setShowClasseModal(v); if (!v) { setClasseCreata(null); setShowCustomSubject(false); setCustomSubjectInput(""); } }}>
        <DialogContent className="rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuova Classe</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome classe *</Label>
              <Input placeholder="es. 3A, 4B, 5C..." value={newClasse.nome}
                onChange={e => setNewClasse(p => ({ ...p, nome: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Ordine scolastico *</Label>
              <Select value={newClasse.ordine_scolastico || ordine} onValueChange={v => {
                setNewClasse(p => ({ ...p, ordine_scolastico: v, materie: [] }));
                setShowCustomSubject(false);
                setCustomSubjectInput("");
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
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
              <Label>Materie *</Label>
              <div className="mt-1 border border-input rounded-lg p-2 min-h-[42px]">
                {newClasse.materie.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newClasse.materie.map(m => (
                      <span key={m} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-md">
                        {m}
                        <button onClick={() => setNewClasse(p => ({ ...p, materie: p.materie.filter(x => x !== m) }))} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {isUniversitaFreeText ? (
                  <Input placeholder="Scrivi materia e premi Invio" className="border-0 p-0 h-8 shadow-none"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v && !newClasse.materie.includes(v)) {
                          setNewClasse(p => ({ ...p, materie: [...p.materie, v] }));
                          (e.target as HTMLInputElement).value = "";
                        }
                        e.preventDefault();
                      }
                    }}
                  />
                ) : effectiveOrdine ? (
                  <>
                    {[...availableSubjects, "__altra__"].filter(m => m === "__altra__" || !newClasse.materie.includes(m)).length > 0 && (
                      <Select value="" onValueChange={v => {
                        if (v === "__altra__") {
                          setShowCustomSubject(true);
                        } else if (v && !newClasse.materie.includes(v)) {
                          setNewClasse(p => ({ ...p, materie: [...p.materie, v] }));
                        }
                      }}>
                        <SelectTrigger className="border-0 p-0 h-8 shadow-none"><SelectValue placeholder="Seleziona materia..." /></SelectTrigger>
                        <SelectContent>
                          {availableSubjects.filter(m => !newClasse.materie.includes(m)).map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                          <SelectItem value="__altra__">Altra materia…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {showCustomSubject && (
                      <Input
                        placeholder="Nome materia personalizzata…"
                        className="mt-1 h-8 text-sm"
                        value={customSubjectInput}
                        onChange={e => setCustomSubjectInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const v = customSubjectInput.trim();
                            if (v && !newClasse.materie.includes(v)) {
                              setNewClasse(p => ({ ...p, materie: [...p.materie, v] }));
                            }
                            setCustomSubjectInput("");
                            setShowCustomSubject(false);
                            e.preventDefault();
                          }
                        }}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">Seleziona prima l'ordine scolastico</p>
                )}
              </div>
            </div>
            <div>
              <Label>Numero studenti</Label>
              <Input type="number" min="0" placeholder="es. 25" value={newClasse.num_studenti}
                onChange={e => setNewClasse(p => ({ ...p, num_studenti: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClasseModal(false)}>Annulla</Button>
            <Button onClick={saveClasse} disabled={!newClasse.nome.trim() || newClasse.materie.length === 0 || savingClasse}>
              {savingClasse ? "Creazione..." : "Crea classe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!classeCreata} onOpenChange={() => { setClasseCreata(null); setShowClasseModal(false); }}>
        <DialogContent className="rounded-xl text-center">
          <CheckSquare className="w-10 h-10 text-primary mx-auto mt-2" />
          <DialogHeader><DialogTitle className="text-center mt-2">Classe creata!</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Condividi questo codice con i tuoi studenti</p>
          <div className="bg-muted rounded-xl py-5 px-4 my-2">
            <p className="font-mono font-black text-4xl tracking-[0.3em] text-foreground">
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

      {/* Crea materiale — class picker */}
      <Dialog open={showMaterialClassPicker} onOpenChange={setShowMaterialClassPicker}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle>Seleziona classe</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Scegli la classe per cui vuoi creare il materiale.</p>
          <Select value={selectedMaterialClassId} onValueChange={setSelectedMaterialClassId}>
            <SelectTrigger className="mt-2"><SelectValue placeholder="Seleziona una classe..." /></SelectTrigger>
            <SelectContent>
              {classi.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}{c.materia ? ` — ${c.materia}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowMaterialClassPicker(false); setSelectedMaterialClassId(""); }}>Annulla</Button>
            <Button
              disabled={!selectedMaterialClassId}
              onClick={() => {
                setShowMaterialClassPicker(false);
                navigate(`/classe/${selectedMaterialClassId}?tab=materiali&create=true`);
                setSelectedMaterialClassId("");
              }}
            >
              Continua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete class confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la classe "{deleteTarget?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. I materiali assegnati rimarranno nel tuo archivio.
              {deleteTarget?.num_studenti > 0 && (
                <span className="block mt-2 font-medium text-foreground">
                  ⚠ Questa classe ha {deleteTarget.num_studenti} studenti attivi. Eliminandola perderanno l'accesso al codice classe.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingClasse}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteClasse(deleteTarget.id)}
              disabled={deletingClasse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingClasse ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
