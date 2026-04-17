import { useState, useEffect, useRef } from "react";
import { getTeacherTitle } from "@/lib/teacherTitle";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, FileText, LayoutDashboard, AlertCircle,
  Send, Copy, CheckSquare, ChevronRight,
  Calendar, Clock, FolderOpen, MoreVertical, Pencil, Trash2, X, Heart,
  CloudRain, BatteryLow, Coffee,
} from "lucide-react";
import { CoachAvatar } from "@/components/shared/CoachAvatar";
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
  const [showMood, setShowMood] = useState(false);
  const moodRef = useRef<HTMLDivElement>(null);
  const [isLoadingCoachMsg, setIsLoadingCoachMsg] = useState(true);
  const [coachName, setCoachName] = useState("");

  // Close mood on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moodRef.current && !moodRef.current.contains(e.target as Node)) setShowMood(false);
    }
    if (showMood) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMood]);

  // Modal
  const [showClasseModal, setShowClasseModal] = useState(false);
  const [newClasse, setNewClasse] = useState({ nome: "", materie: [] as string[], ordine_scolastico: "", num_studenti: "", school_code: "", school_name: "" });
  const [savingClasse, setSavingClasse] = useState(false);
  const [classeCreata, setClasseCreata] = useState<any>(null);
  const [showCustomSubject, setShowCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState("");

  // Delete class — two-step flow
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deletingClasse, setDeletingClasse] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStats, setDeleteStats] = useState({ students: 0, materials: 0, assignments: 0 });

  // Sample data banner
  const [showSampleBanner, setShowSampleBanner] = useState(() => {
    return !localStorage.getItem("sample_banner_dismissed");
  });

  // Crea materiale — class picker
  const [showMaterialClassPicker, setShowMaterialClassPicker] = useState(false);
  const [selectedMaterialClassId, setSelectedMaterialClassId] = useState("");

  const od = onboarding;
  const materie: string[] = od?.docente_materie || [];
  const ordine: string = od?.docente_ordine || "";
  const teacherGender = od?.docente_gender || profile?.gender || null;
  const teacherLastName = (profile as any)?.last_name || null;
  const cognome = teacherLastName || profile?.name?.split(" ").slice(-1)[0] || profile?.name || "";
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
  // Fetch coach name from preferences
  useEffect(() => {
    if (!profileId) return;
    supabase.from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle()
      .then(({ data: pref }) => {
        const name = (pref?.data as any)?.coach_name;
        if (name) setCoachName(name);
      });
  }, [profileId]);

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

  // ━━━ Sample data creation on first access ━━━
  useEffect(() => {
    if (loadingClassi || !profileId || !userId) return;

    const ensureSampleData = async () => {
      try {
        // Check 1: sample class + material
        const existingSampleClass = classi.find((c: any) => c.is_sample);
        let sampleClassId = existingSampleClass?.id;

        if (!existingSampleClass) {
          const { data: sampleClass, error: classErr } = await (supabase as any)
            .from("classi").insert({
              docente_profile_id: profileId,
              nome: "Classe di Esempio",
              materia: "Italiano",
              ordine_scolastico: "Scuola Secondaria I grado",
              num_studenti: 0,
              is_sample: true,
            }).select().single();

          if (classErr || !sampleClass) throw classErr;
          sampleClassId = sampleClass.id;

          const sampleContent = `# La struttura del testo narrativo\n\n## Piano della lezione\n\n**Materia:** Italiano\n**Classe:** Scuola Secondaria I grado\n**Durata:** 2 ore (con pausa intermedia)\n\n---\n\n### Obiettivi di apprendimento\n- Riconoscere le tre parti fondamentali di un testo narrativo: introduzione, sviluppo e conclusione\n- Identificare gli elementi narrativi: personaggi, ambientazione, tempo, narratore\n- Analizzare la struttura narrativa in brani di letteratura italiana classica\n- Produrre un breve testo narrativo rispettando la struttura studiata\n\n### Prerequisiti\n- Conoscenza base della grammatica italiana\n- Capacità di lettura e comprensione di testi brevi\n\n---\n\n### Aggancio (15 minuti)\nChiedere agli studenti: *"Qual è l'ultima storia che avete letto o visto al cinema?"*\n\nMostrare un breve estratto da *I Promessi Sposi* di Alessandro Manzoni (cap. 1):\n> "Quel ramo del lago di Como, che volge a mezzogiorno, tra due catene non interrotte di monti..."\n\n---\n\n### Corpo della lezione (50 minuti)\n\n#### 1. L'Introduzione (15 min)\nL'introduzione presenta:\n- **Chi**: i personaggi principali\n- **Dove**: l'ambientazione\n- **Quando**: il tempo della narrazione\n- **La situazione iniziale**: lo stato di equilibrio\n\n**Esempio:** In *Pinocchio* di Carlo Collodi, l'introduzione ci presenta Mastro Ciliegia che trova un pezzo di legno parlante.\n\n#### 2. Lo Sviluppo (20 min)\nLo sviluppo contiene:\n- **L'evento scatenante**: ciò che rompe l'equilibrio iniziale\n- **Le peripezie**: le avventure e i conflitti del protagonista\n- **Il climax**: il momento di massima tensione\n\n**Esempio:** Ne *Il Barone Rampante* di Italo Calvino, Cosimo sale sugli alberi e decide di non scendere mai più.\n\n#### 3. La Conclusione (15 min)\nLa conclusione include:\n- **La risoluzione**: come si risolve il conflitto\n- **Il nuovo equilibrio**: la situazione finale\n- **La morale** (opzionale)\n\n**Esempio:** Alla fine di *Pinocchio*, il burattino diventa un bambino vero.\n\n---\n\n### Attività pratica (40 minuti)\n\n**Attività 1 — Analisi guidata (20 min)**\nDistribuire un racconto breve e chiedere agli studenti di:\n1. Sottolineare in verde l'introduzione\n2. Sottolineare in giallo lo sviluppo\n3. Sottolineare in rosso la conclusione\n4. Identificare l'evento scatenante e il climax\n\n**Attività 2 — Scrittura creativa (20 min)**\nOgni studente scrive un breve racconto (10-15 righe) seguendo lo schema studiato.\n\n---\n\n### Sintesi (15 minuti)\n\n| Parte | Funzione | Domanda chiave |\n|-------|----------|----------------|\n| Introduzione | Presentare personaggi, tempo, luogo | Chi? Dove? Quando? |\n| Sviluppo | Raccontare conflitti e avventure | Cosa succede? |\n| Conclusione | Risolvere e chiudere la storia | Come finisce? |\n\n===SOLUZIONI===\n\n### Note per il docente\n\n**Attività 1 — Criteri di valutazione:**\n- Corretta identificazione delle tre parti: 3 punti ciascuna (tot. 9)\n- Identificazione evento scatenante: 3 punti\n- Identificazione climax: 3 punti\n- Totale: 15 punti\n\n**Attività 2 — Griglia di valutazione:**\n- Presenza delle tre parti: 4 punti\n- Coerenza narrativa: 3 punti\n- Creatività: 3 punti\n- Correttezza linguistica: 3 punti\n- Totale: 13 punti — Sufficienza a 8\n\n**Suggerimenti BES:** Fornire schema precompilato, ridurre lunghezza a 5-8 righe, permettere lavoro in coppia.\n**Studenti avanzati:** Identificare tipo di narratore, analizzare racconto complesso, introdurre il flashback.`;

          await (supabase as any).from("teacher_materials").insert({
            teacher_id: userId,
            class_id: sampleClassId,
            title: "La struttura del testo narrativo",
            subject: "Italiano",
            type: "Lezione",
            content: sampleContent,
            status: "draft",
            is_sample: true,
          });
        }

        // Check 2: sample student — use edge function (bypasses RLS)
        if (sampleClassId) {
          const { data: result, error: fnErr } = await supabase.functions.invoke("create-sample-data", {
            body: { teacher_id: userId, class_id: sampleClassId },
          });

          if (fnErr) {
            console.error("Error creating sample student:", fnErr);
          } else if (result?.created) {
            loadAll();
          }
        }
      } catch (err) {
        console.error("Error creating sample data:", err);
      }
    };

    ensureSampleData();
  }, [loadingClassi, classi.length, profileId, userId]);

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
        school_code: newClasse.school_code || null,
        school_name: newClasse.school_name || null,
      }).select().single();
    setSavingClasse(false);
    if (!error && data) {
      setClasseCreata(data);
      setNewClasse({ nome: "", materie: [], ordine_scolastico: "", num_studenti: "", school_code: "", school_name: "" });
      loadAll();
    } else {
      toast.error("Errore nella creazione della classe.");
    }
  }

  async function openDeleteFlow(classe: any) {
    setDeleteTarget(classe);
    setDeleteStep(1);
    setDeleteConfirmName("");
    const [enrollRes, matRes, assignRes] = await Promise.all([
      (supabase as any).from("class_enrollments").select("id", { count: "exact", head: true }).eq("class_id", classe.id).eq("status", "active"),
      (supabase as any).from("teacher_materials").select("id", { count: "exact", head: true }).eq("class_id", classe.id),
      (supabase as any).from("teacher_assignments").select("id", { count: "exact", head: true }).eq("class_id", classe.id),
    ]);
    setDeleteStats({
      students: enrollRes.count || 0,
      materials: matRes.count || 0,
      assignments: assignRes.count || 0,
    });
  }

  async function deleteClasse(classeId: string) {
    setDeletingClasse(true);
    await (supabase as any).from("teacher_materials").delete().eq("class_id", classeId);
    await (supabase as any).from("class_enrollments").delete().eq("class_id", classeId);
    await (supabase as any).from("teacher_assignments").delete().eq("class_id", classeId);
    await (supabase as any).from("teacher_activity_feed").delete().eq("class_id", classeId);
    const deletedName = deleteTarget?.nome || "";
    const { error } = await (supabase as any).from("classi").delete().eq("id", classeId);
    setDeletingClasse(false);
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteConfirmName("");
    if (!error) {
      toast.success(`Classe "${deletedName}" eliminata.`);
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
    <div className="pb-24 sm:pb-12 bg-gradient-to-b from-muted/40 to-muted/20 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-7">

        {/* ━━━ BLOCK 1 — HEADER ━━━ */}
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              {getGreeting()}, {getTeacherTitle(teacherGender)} {cognome} 👋
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <button
            onClick={() => setShowClasseModal(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Nuova classe
          </button>
        </section>

        {/* ━━━ BLOCK 2 — COACH CARD (headline + emotional heart row + fused input) ━━━ */}
        <section className="rounded-[32px] border border-border/60 bg-card/95 backdrop-blur overflow-hidden shadow-[0_10px_30px_-15px_hsl(var(--foreground)/0.08)]">
          <div className="px-6 pt-6 pb-5 sm:px-7 sm:pt-7">
            <div className="mb-4 flex items-center gap-3">
              <CoachAvatar mood="default" size={44} />
              <div>
                <p className="text-[14px] font-semibold text-foreground/80 leading-tight">{coachName || "Coach"}</p>
                <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">Centro di regia della giornata</p>
              </div>
            </div>

            {isLoadingCoachMsg ? (
              <div className="space-y-3 max-w-3xl">
                <Skeleton className="h-7 w-11/12" />
                <Skeleton className="h-7 w-9/12" />
                <Skeleton className="h-5 w-8/12 mt-2" />
              </div>
            ) : (
              <>
                <h2 className="max-w-3xl text-[30px] leading-tight font-extrabold tracking-tight text-foreground">
                  {coachLastMsg || "Bentornato. Pronto per una nuova giornata di lavoro?"}
                </h2>
                {classi.length === 0 && !loadingClassi && (
                  <div className="mt-5">
                    <Button onClick={() => setShowClasseModal(true)} className="gap-1.5 rounded-full">
                      <Plus className="w-3.5 h-3.5" /> Crea la prima classe
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {["Organizza il lavoro", "Rivedi le priorità", "Chiedi un suggerimento"].map((label) => (
                <button
                  key={label}
                  onClick={() => navigateToCoach(label)}
                  className="rounded-full border border-border bg-muted/50 px-4 py-2.5 text-[14px] font-semibold text-foreground/80 hover:bg-muted transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

          </div>

          {/* Fused input — bottom band with emotional heart on the LEFT */}
          <div className="border-t border-border/50 bg-muted/30 px-6 py-4 sm:px-7">
            <div className="flex items-center gap-2.5">
              {/* Emotional heart — LEFT of the text field, same row */}
              <div className="relative shrink-0" ref={moodRef}>
                <button
                  onClick={() => setShowMood(!showMood)}
                  className={`h-11 w-11 rounded-full border flex items-center justify-center transition-colors ${
                    showMood
                      ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10"
                      : "border-border bg-card hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-500/10"
                  }`}
                  title="Come ti senti oggi?"
                  aria-label="Come ti senti oggi?"
                >
                  <Heart className={`w-5 h-5 ${showMood ? "fill-rose-500 text-rose-500" : "text-rose-400"}`} />
                </button>

                <AnimatePresence>
                  {showMood && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-2xl shadow-lg p-2 min-w-[260px] z-20"
                    >
                      {[
                        { label: "Sono sopraffatto/a", icon: CloudRain, msg: "Mi sento sopraffatto/a dal carico di lavoro, ho bisogno di supporto", color: "text-blue-600 dark:text-blue-400" },
                        { label: "Sono stanco/a", icon: BatteryLow, msg: "Mi sento stanco/a e senza energie oggi", color: "text-amber-600 dark:text-amber-400" },
                        { label: "Ho bisogno di una pausa", icon: Coffee, msg: "Sento di aver bisogno di staccare un momento e ricaricarmi", color: "text-orange-600 dark:text-orange-400" },
                        { label: "Ho bisogno di parlare", icon: Heart, msg: "Ho bisogno di parlare con qualcuno di come mi sento come docente", color: "text-rose-600 dark:text-rose-400" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => { setShowMood(false); navigateToCoach(opt.msg); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors"
                        >
                          <opt.icon className={`w-4 h-4 shrink-0 ${opt.color}`} />
                          <span className="text-[14px] font-medium text-foreground">{opt.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
                <input
                  type="text"
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && navigateToCoach()}
                  placeholder={coachName ? `Scrivi a ${coachName}...` : "Scrivi al coach..."}
                  className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none"
                />
                <button
                  onClick={() => navigateToCoach()}
                  disabled={!coachInput.trim()}
                  className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 disabled:opacity-40 transition-colors shrink-0"
                  aria-label="Invia"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ SAMPLE BANNER ━━━ */}
        {showSampleBanner && classi.some((c: any) => c.is_sample) && (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10 px-5 py-4 text-[15px] text-foreground/80">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-amber-500 text-lg">✦</span>
                <p>Abbiamo creato una classe di esempio per mostrarti come funziona SarAI. Esplorala liberamente — puoi modificarla o eliminarla quando vuoi.</p>
              </div>
              <button
                onClick={() => { setShowSampleBanner(false); localStorage.setItem("sample_banner_dismissed", "true"); }}
                className="shrink-0 text-[14px] font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800"
              >
                Ho capito
              </button>
            </div>
          </section>
        )}

        {/* ━━━ BLOCK 3 — 3 MICRO-CARD: Scadenze · Attività · Da seguire ━━━ */}
        <section>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {[
              { label: "Scadenze", value: upcomingDeadlines.length, icon: Calendar, bg: "bg-sky-50 dark:bg-sky-500/10", fg: "text-sky-600 dark:text-sky-400", onClick: () => navigate("/agenda-docente") },
              { label: "Attività recenti", value: feedItems.length, icon: Clock, bg: "bg-violet-50 dark:bg-violet-500/10", fg: "text-violet-600 dark:text-violet-400", onClick: () => navigate("/notifiche-docente") },
              { label: "Da seguire", value: daSegurireCount, icon: AlertCircle, bg: daSegurireCount > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", fg: daSegurireCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400", onClick: () => navigate("/notifiche-docente") },
            ].map(({ label, value, icon: Icon, bg, fg, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="text-left rounded-[26px] border border-border/60 bg-card/95 backdrop-blur p-5 shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.06)] hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)] transition-all"
              >
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <div className={`h-9 w-9 rounded-2xl flex items-center justify-center ${bg} ${fg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-3 font-display text-4xl font-extrabold tracking-tight text-foreground">{loadingClassi ? "–" : value}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ━━━ BLOCK 4 — LE TUE CLASSI ━━━ */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-sky-300" />
            <h3 className="text-[13px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Le tue classi</h3>
          </div>
          {loadingClassi ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-[28px]" />)}
            </div>
          ) : classi.length === 0 ? (
            <div className="rounded-[28px] border border-border/60 bg-card/95 backdrop-blur p-8 text-center shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.06)]">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-[15px] text-muted-foreground">Nessuna classe ancora</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowClasseModal(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Crea la prima classe
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {classi.map(c => {
                const alertCount = classFeedMap.get(c.id) || 0;
                const hasAlert = alertCount > 0;
                return (
                  <div
                    key={c.id}
                    className="rounded-[28px] border border-border/60 bg-card/95 backdrop-blur p-5 sm:p-6 shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.06)] hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)] transition-all group relative"
                  >
                    <div className="absolute top-3 right-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={e => e.stopPropagation()}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/classe/${c.id}`)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Modifica classe
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openDeleteFlow(c)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> {c.is_sample ? "Elimina classe di esempio" : "Elimina classe"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap pr-8">
                          <div className={`h-3 w-3 rounded-full ${hasAlert ? "bg-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.15)]" : "bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.15)]"}`} />
                          <p className="text-2xl font-bold tracking-tight text-foreground">{c.nome}</p>
                          {c.is_sample && (
                            <span className="rounded-full bg-amber-50 dark:bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              ✨ Esempio
                            </span>
                          )}
                          {hasAlert && (
                            <span className="bg-destructive text-destructive-foreground text-[11px] font-bold px-2 py-0.5 rounded-full">
                              {alertCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-[15px] text-muted-foreground">
                          {c.materia || "–"} · {c.num_studenti || 0} {(c.num_studenti || 0) === 1 ? "studente" : "studenti"}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/classe/${c.id}`)}
                        className="shrink-0 self-start md:self-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-5 py-3 text-[14px] font-semibold text-foreground hover:bg-muted transition-colors"
                      >
                        Apri classe <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ━━━ BLOCK 5 — AZIONI PRINCIPALI ━━━ */}
        <section className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setShowMaterialClassPicker(true)}
            className="rounded-[26px] bg-primary px-5 py-5 text-left text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <div className="text-[13px] font-semibold text-primary-foreground/80">Azione principale</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">Crea materiale</div>
          </button>
          <button
            onClick={() => navigate("/materiali-docente")}
            className="rounded-[26px] border border-border/60 bg-card/95 backdrop-blur px-5 py-5 text-left shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.06)] hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)] transition-all"
          >
            <div className="text-[13px] font-semibold text-muted-foreground">Archivio</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">I miei materiali</div>
          </button>
        </section>

        {/* ━━━ BLOCK 6 — TWO COLUMNS ━━━ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left — Scadenze imminenti */}
          <div className="bg-card/95 backdrop-blur border border-border/60 rounded-[24px] p-5 sm:p-6 shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.06)]">
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
          <div className="bg-card/95 backdrop-blur border border-border/60 rounded-[24px] p-5 sm:p-6 shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.06)]">
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
            {/* School selection */}
            <div>
              <Label>Istituto</Label>
              {(() => {
                const teacherSchools: { school_name: string; school_code: string | null; city: string }[] = od?.teacher_declaration?.schools || [];
                if (od?.teacher_declaration?.school_code && teacherSchools.length === 0) {
                  teacherSchools.push({ school_name: od.teacher_declaration.school_name || "", school_code: od.teacher_declaration.school_code, city: od.teacher_declaration.city || "" });
                }
                if (teacherSchools.length > 0) {
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {teacherSchools.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setNewClasse(p => ({ ...p, school_code: s.school_code || "", school_name: s.school_name }))}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${newClasse.school_code === (s.school_code || "") && newClasse.school_name === s.school_name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                        >
                          🏫 {s.school_name}{s.city ? ` — ${s.city}` : ""}
                        </button>
                      ))}
                    </div>
                  );
                }
                return <p className="text-xs text-muted-foreground mt-1">Nessun istituto salvato. Puoi aggiungerlo dalle Impostazioni.</p>;
              })()}
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
          <div className="flex flex-col gap-2">
            <Button className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(classeCreata?.codice_invito);
                toast.success("Codice copiato!");
              }}>
              <Copy className="w-4 h-4 mr-2" />Copia codice
            </Button>
            <Button variant="outline" className="w-full"
              onClick={() => {
                const id = classeCreata?.id;
                setClasseCreata(null);
                setShowClasseModal(false);
                if (id) navigate(`/classe/${id}`);
              }}>
              Vai alla classe
            </Button>
          </div>
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

      {/* Delete class — Step 1 */}
      <Dialog open={!!deleteTarget && deleteStep === 1} onOpenChange={v => { if (!v) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Vuoi eliminare "{deleteTarget?.nome}"?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2 py-2">
            <p>Verranno eliminati:</p>
            <ul className="list-disc pl-5 space-y-1">
              {deleteStats.students > 0 && <li><span className="font-medium text-foreground">{deleteStats.students}</span> collegamenti studenti</li>}
              {deleteStats.materials > 0 && <li><span className="font-medium text-foreground">{deleteStats.materials}</span> materiali associati</li>}
              {deleteStats.assignments > 0 && <li><span className="font-medium text-foreground">{deleteStats.assignments}</span> compiti assegnati</li>}
              {deleteStats.students === 0 && deleteStats.materials === 0 && deleteStats.assignments === 0 && <li>Nessun dato collegato</li>}
            </ul>
            <p className="text-xs pt-1">I profili degli studenti <strong>non</strong> verranno eliminati.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}>Annulla</Button>
            <Button variant="destructive" onClick={() => setDeleteStep(2)}>Continua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete class — Step 2 */}
      <Dialog open={!!deleteTarget && deleteStep === 2} onOpenChange={v => { if (!v) { setDeleteTarget(null); setDeleteStep(1); setDeleteConfirmName(""); } }}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Questa azione è irreversibile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Digita il nome della classe per confermare: <span className="font-semibold text-foreground">"{deleteTarget?.nome}"</span>
            </p>
            <Input
              placeholder="Nome della classe..."
              value={deleteConfirmName}
              onChange={e => setDeleteConfirmName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteStep(1); setDeleteConfirmName(""); }}>Annulla</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== deleteTarget?.nome || deletingClasse}
              onClick={() => deleteTarget && deleteClasse(deleteTarget.id)}
            >
              {deletingClasse ? "Eliminazione..." : "Elimina definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
