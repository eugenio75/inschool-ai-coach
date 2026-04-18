import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Mail, Send, ArrowRight, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { BackLink } from "@/components/shared/BackLink";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { percentToGrade, type ScaleId } from "@/components/teacher/GradeReviewModal";

type Activity = {
  id?: string;
  title: string;
  type: string;
  subject: string;
  due_date?: string | null;
  completed_at?: string | null;
  score?: number | null;
  status?: string | null;
  errors_summary?: Record<string, number>;
  assignment_id?: string;
};

function pickDemoTopicForSubject(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (s.includes("matem")) return "I numeri decimali";
  if (s.includes("ital")) return "Analisi grammaticale";
  if (s.includes("ingl") || s.includes("engl")) return "Past simple";
  if (s.includes("scien")) return "Il sistema solare";
  if (s.includes("stor")) return "L'Impero Romano";
  if (s.includes("geo")) return "Le regioni d'Italia";
  return `argomenti chiave di ${subject}`;
}

export default function StudentView() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const openCommParam = searchParams.get("openComm");
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("Studente");
  const [className, setClassName] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [classAvg, setClassAvg] = useState<number | null>(null);
  const [classScale, setClassScale] = useState<ScaleId>("/10");
  const [topErrorTopic, setTopErrorTopic] = useState<string | null>(null);
  const [activeDays, setActiveDays] = useState(0);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [habitsSummary, setHabitsSummary] = useState<string | null>(null);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [habitsSummaryAi, setHabitsSummaryAi] = useState<string | null>(null);
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [habitsLoaded, setHabitsLoaded] = useState(false);

  // Communication dialog
  const [showComm, setShowComm] = useState(false);
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!studentId || !classId || !user) return;
    loadStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, classId, user]);

  useEffect(() => {
    if (openCommParam === "1" && !loading) setShowComm(true);
  }, [openCommParam, loading]);

  async function loadStudentData() {
    setLoading(true);
    const profileId = session?.profileId;
    if (!profileId) { navigate("/dashboard"); return; }

    try {
      const { data: classeData } = await (supabase as any)
        .from("classi").select("nome, materia").eq("id", classId).single();
      setClassName(classeData?.nome || "");
      const subj: string = classeData?.materia || "";
      setClassSubject(subj);
      const subjectMatches = (s: string | null | undefined) =>
        !subj || (s || "").trim().toLowerCase() === subj.trim().toLowerCase();

      const { data: enrollment } = await (supabase as any)
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .single();
      if (!enrollment) { navigate(`/classe/${classId}`); return; }

      const { data: profile } = await (supabase as any)
        .from("child_profiles")
        .select("name, last_name")
        .eq("id", studentId)
        .single();
      const name = profile
        ? (profile.last_name ? `${profile.name} ${profile.last_name}` : profile.name)
        : "Studente";
      setStudentName(name);
      const isDemo = /^\s*studente\s*$|esempio|demo|sample/i.test(name);

      const { data: results } = await (supabase as any)
        .from("assignment_results")
        .select("*, teacher_assignments!assignment_results_assignment_id_fkey(title, type, subject, due_date, assigned_at)")
        .eq("student_id", studentId)
        .order("completed_at", { ascending: false });

      const activityList: Activity[] = [];
      const errorsByType: Record<string, number> = {};
      (results || []).forEach((r: any) => {
        const a = r.teacher_assignments;
        const aSubj = a?.subject || "";
        if (!subjectMatches(aSubj)) return;
        activityList.push({
          id: r.id,
          title: a?.title || "Attività",
          type: a?.type || "",
          subject: aSubj,
          due_date: a?.due_date,
          completed_at: r.completed_at,
          score: r.score,
          status: r.status,
          errors_summary: r.errors_summary || {},
          assignment_id: r.assignment_id,
        });
        if (r.errors_summary && typeof r.errors_summary === "object") {
          Object.keys(r.errors_summary as Record<string, any>).forEach((k) => {
            errorsByType[k] = (errorsByType[k] || 0) + 1;
          });
        }
      });
      setActivities(activityList);

      const top = Object.entries(errorsByType).sort(([, a], [, b]) => b - a)[0];
      setTopErrorTopic(top ? top[0] : null);

      // Class average
      if (subj && classId) {
        const { data: classResults } = await (supabase as any)
          .from("assignment_results")
          .select("score, teacher_assignments!inner(subject, class_id)")
          .eq("teacher_assignments.class_id", classId)
          .eq("teacher_assignments.subject", subj)
          .not("score", "is", null);
        if (classResults && classResults.length > 0) {
          const cs = classResults.map((r: any) => r.score).filter((s: any) => s != null);
          if (cs.length > 0) {
            setClassAvg(Math.round(cs.reduce((a: number, b: number) => a + b, 0) / cs.length));
          }
        }
      }

      // Default scale
      const { data: classGrades } = await (supabase as any)
        .from("manual_grades")
        .select("grade_scale")
        .eq("class_id", classId);
      if (classGrades && classGrades.length > 0) {
        const counts: Record<string, number> = {};
        classGrades.forEach((g: any) => {
          const s = g.grade_scale || "/10";
          counts[s] = (counts[s] || 0) + 1;
        });
        const top2 = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
        if (top2) setClassScale(top2[0] as ScaleId);
      }

      const completedDates = activityList
        .filter(a => a.status === "completed" && a.completed_at)
        .map(a => new Date(a.completed_at!).toDateString());
      const uniqueDays = [...new Set(completedDates)];
      setActiveDays(uniqueDays.length);
      if (uniqueDays.length > 0) setLastAccess(uniqueDays[0]);

      // Demo seed
      if (isDemo && activityList.length === 0) {
        const demoSubject = subj || "Matematica";
        const demoTopic = pickDemoTopicForSubject(demoSubject);
        const today = new Date();
        const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();
        setActivities([
          { title: `Verifica su ${demoTopic}`, type: "verifica", subject: demoSubject, due_date: daysAgo(2), completed_at: daysAgo(2), score: 8, status: "completed", errors_summary: { [demoTopic]: 3 } },
          { title: `Esercizi di ${demoSubject}`, type: "esercizio", subject: demoSubject, due_date: daysAgo(5), completed_at: daysAgo(5), score: 22, status: "completed", errors_summary: { [demoTopic]: 2 } },
          { title: `Verifica intermedia`, type: "verifica", subject: demoSubject, due_date: daysAgo(14), completed_at: daysAgo(14), score: 32, status: "completed", errors_summary: {} },
          { title: `Compito di ${demoSubject}`, type: "studio", subject: demoSubject, due_date: daysAgo(20), completed_at: daysAgo(20), score: 45, status: "completed", errors_summary: {} },
        ]);
        setActiveDays(2);
        setLastAccess(new Date(today.getTime() - 6 * 86400000).toDateString());
        setClassAvg(65);
        setTopErrorTopic(demoTopic);
      }
    } catch (error) {
      console.error("StudentView load error:", error);
      toast.error("Errore nel caricamento dei dati.");
      navigate(`/classe/${classId}`);
    }
    setLoading(false);
  }

  async function sendCommunication() {
    if (!user || !classId) return;
    await (supabase as any).from("parent_communications").insert({
      teacher_id: user.id,
      class_id: classId,
      student_id: studentId,
      type: "messaggio",
      subject: commSubject,
      body: commBody,
      sent_at: new Date().toISOString(),
      status: "sent",
    });
    toast.success("Messaggio inviato!");
    setShowComm(false);
    setShowConfirm(false);
    setCommSubject("");
    setCommBody("");
  }

  async function loadHabitsSummary() {
    if (habitsLoaded || habitsLoading) return;
    setHabitsLoading(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("teacher-student-habits", {
        body: { studentId, classId },
      });
      if (!error) setHabitsSummaryAi(typeof data?.summary === "string" ? data.summary : null);
    } catch (e) {
      console.error("habits load error", e);
    } finally {
      setHabitsLoading(false);
      setHabitsLoaded(true);
    }
  }

  // Derived
  const studentAvg = useMemo(() => {
    const scores = activities.filter(a => a.score != null).map(a => a.score!);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [activities]);

  const studentGradeDisplay = useMemo(() => {
    if (studentAvg === null) return "—";
    return `${percentToGrade(studentAvg, classScale)}${classScale !== "giudizio" ? classScale : ""}`;
  }, [studentAvg, classScale]);

  const classGradeDisplay = useMemo(() => {
    if (classAvg === null) return "—";
    return `${percentToGrade(classAvg, classScale)}${classScale !== "giudizio" ? classScale : ""}`;
  }, [classAvg, classScale]);

  const trend = useMemo(() => {
    const scored = activities.filter(a => a.score != null && a.completed_at)
      .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
      .map(a => a.score!);
    if (scored.length < 2) return { label: "Stabile", tone: "slate" as const };
    const half = Math.floor(scored.length / 2);
    const olderAvg = scored.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
    const recentAvg = scored.slice(half).reduce((a, b) => a + b, 0) / (scored.length - half);
    const delta = recentAvg - olderAvg;
    if (delta < -8) return { label: "In calo", tone: "rose" as const };
    if (delta > 8) return { label: "In miglioramento", tone: "green" as const };
    return { label: "Stabile", tone: "slate" as const };
  }, [activities]);

  const inactiveDays = useMemo(() => {
    if (!lastAccess) return null;
    return Math.floor((Date.now() - new Date(lastAccess).getTime()) / 86400000);
  }, [lastAccess]);

  const emotionalSignal = useMemo(() => {
    const negative = (studentAvg !== null && studentAvg < 45) || (inactiveDays !== null && inactiveDays >= 7);
    const positive = studentAvg !== null && studentAvg >= 70;
    if (negative) return { label: "Da attenzionare", tone: "amber" as const };
    if (positive) return { label: "Positivo", tone: "green" as const };
    return { label: "Neutro", tone: "slate" as const };
  }, [studentAvg, inactiveDays]);

  const isFlagged = (studentAvg !== null && studentAvg < 50) || (inactiveDays !== null && inactiveDays >= 7);

  // Coach narrative
  const firstName = studentName.split(" ")[0] || studentName;
  const coachTitle = useMemo(() => {
    if (topErrorTopic) return `${firstName} fatica su "${topErrorTopic}" e ha bisogno di un appoggio mirato.`;
    if (trend.tone === "rose") return `${firstName} mostra un calo recente che merita attenzione.`;
    if (inactiveDays !== null && inactiveDays >= 7) return `${firstName} è poco presente nelle attività delle ultime settimane.`;
    if (trend.tone === "green") return `${firstName} sta crescendo: il lavoro recente mostra progressi.`;
    return `${firstName} procede in modo regolare, senza segnali critici.`;
  }, [firstName, topErrorTopic, trend.tone, inactiveDays]);

  const didacticParagraph = useMemo(() => {
    if (topErrorTopic) {
      return `La difficoltà principale si concentra su "${topErrorTopic}" e si ripresenta nelle ultime verifiche di ${classSubject || "questa materia"}. Gli errori non sono distratti: indicano un concetto non ancora consolidato. Senza un intervento mirato, è probabile che il gap si allarghi nei prossimi argomenti.`;
    }
    if (studentAvg !== null && studentAvg < 50) {
      return `I risultati recenti restano sotto la soglia attesa: lo studente arriva alle verifiche senza una base sicura sui contenuti chiave. Il pattern suggerisce che le spiegazioni in classe non vengono rielaborate a casa.`;
    }
    return `Sul piano didattico non si rilevano lacune marcate: ${firstName} affronta i contenuti con strumenti adeguati e i risultati lo confermano. È un buon momento per consolidare e rilanciare con argomenti più sfidanti.`;
  }, [topErrorTopic, classSubject, studentAvg, firstName]);

  const rhythmParagraph = useMemo(() => {
    if (inactiveDays !== null && inactiveDays >= 7) {
      return `Sul piano della continuità, ${firstName} è inattivo da circa ${inactiveDays} giorni. Una pausa così lunga, in questa fase, può indicare disagio o demotivazione. Un breve confronto in classe — o un messaggio alla famiglia — può aiutare a riportarlo dentro al ritmo.`;
    }
    if (activeDays <= 3) {
      return `Il lavoro è discontinuo: solo ${activeDays} giorn${activeDays === 1 ? "o" : "i"} attiv${activeDays === 1 ? "o" : "i"} di recente. Senza una routine stabile, anche i contenuti più semplici rischiano di non sedimentarsi. Una piccola assegnazione settimanale ricorrente potrebbe aiutarlo a rientrare in carreggiata.`;
    }
    return `Sul piano del ritmo, ${firstName} mantiene una presenza costante (${activeDays} giorni attivi recenti) e rispetta le scadenze. Questa continuità è una leva preziosa: vale la pena valorizzarla con un riconoscimento esplicito.`;
  }, [firstName, inactiveDays, activeDays]);

  const recoveryTopic = topErrorTopic || classSubject || "argomento critico";

  if (loading) {
    return (
      <div className="max-w-[896px] mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[480px] rounded-[30px]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background relative pb-24">
      <BackLink label={`a ${className || "alla classe"}`} to={`/classe/${classId}`} />

      <div className="max-w-[896px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* HEADER */}
        <header className="flex items-start justify-between gap-3 flex-wrap mb-6 sm:mb-8">
          <div className="flex items-center gap-4">
            <AvatarInitials name={studentName} size="lg" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-tight">{studentName}</h1>
                {isFlagged && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    Da seguire
                  </span>
                )}
              </div>
              {className && <p className="text-[14px] text-muted-foreground mt-1">{className}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-full text-[13px]" onClick={() => setShowComm(true)}>
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Scrivi ai genitori
          </Button>
        </header>

        {/* COACH CARD */}
        <article className="bg-card border border-border rounded-[30px] shadow-sm overflow-hidden">
          {/* Top — narrative */}
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-[12px] font-bold tracking-wide">
                AI
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground leading-tight">Coach dello studente</p>
                <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">Sintesi chiara, didattica ed emotiva</p>
              </div>
            </div>

            <h2 className="text-[24px] sm:text-[26px] font-extrabold text-foreground tracking-tight leading-[1.2] mb-5">
              {coachTitle}
            </h2>

            <div className="space-y-4 mb-6">
              <p className="text-[15px] text-foreground leading-[1.7]">{didacticParagraph}</p>
              <p className="text-[15px] text-foreground leading-[1.7]">{rhythmParagraph}</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button
                size="default"
                className="rounded-full text-[14px] font-medium px-5"
                onClick={() => navigate(`/classe/${classId}?tab=materiali&recovery_topic=${encodeURIComponent(recoveryTopic)}&recovery_subject=${encodeURIComponent(classSubject || "")}`)}
              >
                Genera recupero
              </Button>
              <Button
                size="default"
                variant="secondary"
                className="rounded-full text-[14px] font-medium px-5"
                onClick={() => navigate(`/classe/${classId}?tab=materiali`)}
              >
                Materiale semplificato
              </Button>
              <Button
                size="default"
                variant="outline"
                className="rounded-full text-[14px] font-medium px-5 bg-card"
                onClick={() => navigate(`/studente/${studentId}/esplora?classId=${classId}`)}
              >
                Esplora studente <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* Bottom — KPI row */}
          <div className="border-t border-border bg-muted/30 px-6 sm:px-8 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Media</p>
                <p className="text-[18px] font-bold text-foreground mt-1 tabular-nums">{studentGradeDisplay}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Classe</p>
                <p className="text-[18px] font-bold text-foreground mt-1 tabular-nums">{classGradeDisplay}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Trend</p>
                <p className={[
                  "text-[18px] font-bold mt-1",
                  trend.tone === "rose" && "text-rose-600 dark:text-rose-400",
                  trend.tone === "green" && "text-emerald-600 dark:text-emerald-400",
                  trend.tone === "slate" && "text-foreground",
                ].filter(Boolean).join(" ")}>
                  {trend.label}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Segnale emotivo</p>
                <p className={[
                  "text-[18px] font-bold mt-1",
                  emotionalSignal.tone === "amber" && "text-amber-600 dark:text-amber-400",
                  emotionalSignal.tone === "green" && "text-emerald-600 dark:text-emerald-400",
                  emotionalSignal.tone === "slate" && "text-foreground",
                ].filter(Boolean).join(" ")}>
                  {emotionalSignal.label}
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Abitudini di studio — collapsed by default */}
        <Collapsible
          open={habitsOpen}
          onOpenChange={(open) => {
            setHabitsOpen(open);
            if (open) loadHabitsSummary();
          }}
          className="mt-6"
        >
          <CollapsibleTrigger className="w-full text-left bg-card border border-border rounded-[24px] shadow-sm px-6 sm:px-8 py-5 hover:bg-muted/40 transition-colors group">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold text-foreground tracking-tight leading-tight">
                  Abitudini di studio
                </h3>
                {!habitsOpen && (
                  <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">
                    Apri per vedere ritmo, continuità e modalità di apprendimento.
                  </p>
                )}
              </div>
              <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 mt-0.5 transition-transform ${habitsOpen ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-card border border-t-0 border-border rounded-b-[24px] -mt-px px-6 sm:px-8 pb-6 pt-2">
              {habitsLoading && (
                <p className="text-[14px] text-muted-foreground italic">Sto leggendo le abitudini di {firstName}…</p>
              )}
              {!habitsLoading && habitsSummaryAi && (
                <p className="text-[15px] text-foreground leading-[1.7]">{habitsSummaryAi}</p>
              )}
              {!habitsLoading && habitsLoaded && !habitsSummaryAi && (
                <p className="text-[14px] text-muted-foreground leading-[1.6]">
                  Servono ancora qualche sessione per cogliere uno stile di lavoro stabile.
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Communication Dialog */}
        <Dialog open={showComm} onOpenChange={setShowComm}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Scrivi ai genitori di {studentName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Oggetto</Label>
                <Input placeholder="es. Aggiornamento sul rendimento" value={commSubject}
                  onChange={e => setCommSubject(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Messaggio</Label>
                <Textarea placeholder="Scrivi il tuo messaggio..." value={commBody}
                  onChange={e => setCommBody(e.target.value)} className="mt-1 rounded-xl min-h-[120px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComm(false)} className="rounded-xl">Annulla</Button>
              <Button onClick={() => setShowConfirm(true)} disabled={!commBody.trim()} className="rounded-xl">
                <Send className="w-3.5 h-3.5 mr-1" /> Invia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma invio</AlertDialogTitle>
              <AlertDialogDescription>
                Stai per inviare un messaggio privato ai genitori di {studentName}.
                Questo messaggio sarà visibile solo a loro. Continuare?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={sendCommunication} className="rounded-xl">Invia</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
