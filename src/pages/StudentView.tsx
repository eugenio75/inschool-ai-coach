import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, AlertTriangle, AlertCircle, Info, CheckCircle2, Flame, Mail, Send, PenLine,
  TrendingUp, TrendingDown, Minus, Sparkles, ChevronDown, Bot, Wrench, FileText, Users, CalendarClock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
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
import ManualGradeModal from "@/components/teacher/ManualGradeModal";
import GradeReviewModal, { percentToGrade, type ScaleId } from "@/components/teacher/GradeReviewModal";

type Activity = {
  id?: string;
  title: string;
  type: string;
  subject: string;
  due_date?: string | null;
  assigned_at?: string | null;
  completed_at?: string | null;
  score?: number | null;
  status?: string | null;
  errors_summary?: Record<string, number>;
  answers?: any[];
  assignment_id?: string;
};

type SignalAction = {
  label: string;
  icon: "wrench" | "doc" | "mail" | "calendar";
  onClick: () => void;
};

type Signal = {
  text: string;
  severity: "critical" | "warning" | "info";
  /** Optional inline actions: 'recovery' | 'material' | 'message' | 'session' */
  actions?: Array<"recovery" | "material" | "message" | "session">;
  /** Optional topic to inject in recovery action */
  topic?: string;
};
type SubjectStat = { subject: string; avg: number; count: number; delta: number };

// Match topic to a coherent subject (fixes "decimali" → Italiano bug for demo)
function pickDemoTopicForSubject(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (s.includes("matem")) return "I numeri decimali";
  if (s.includes("ital")) return "Analisi grammaticale";
  if (s.includes("ingl") || s.includes("engl")) return "Past simple";
  if (s.includes("scien")) return "Il sistema solare";
  if (s.includes("stor")) return "L'Impero Romano";
  if (s.includes("geo")) return "Le regioni d'Italia";
  return `Argomenti chiave di ${subject}`;
}

// Deterministic summary generator (1-2 sentences)
function buildStudentSummary(
  studentName: string,
  subjectProgress: SubjectStat[],
  signals: Signal[],
  daysSinceLastActivity: number | null
): string {
  const firstName = studentName.split(" ")[0] || studentName;
  const parts: string[] = [];

  // Find weakest subject
  const weakest = subjectProgress.find((s) => s.avg < 50);
  const strong = subjectProgress.find((s) => s.avg >= 70);
  // Find topic from critical signal
  const topicMatch = signals
    .map((s) => s.text.match(/"([^"]+)"/))
    .find((m) => m && m[1]);
  const topic = topicMatch ? topicMatch[1] : null;

  if (weakest && topic) {
    parts.push(`${firstName} mostra difficoltà su "${topic}" in ${weakest.subject} (media ${weakest.avg}%).`);
  } else if (weakest) {
    parts.push(`${firstName} mostra difficoltà in ${weakest.subject} (media ${weakest.avg}%).`);
  } else if (strong) {
    parts.push(`${firstName} sta procedendo bene in ${strong.subject} (media ${strong.avg}%).`);
  } else if (subjectProgress.length === 0) {
    parts.push(`Non ci sono ancora dati sufficienti per ${firstName}.`);
  } else {
    parts.push(`${firstName} ha un andamento nella media.`);
  }

  // Continuity sentence
  if (daysSinceLastActivity !== null && daysSinceLastActivity >= 5) {
    parts.push(`Continuità in calo: ultima attività ${daysSinceLastActivity} giorni fa.`);
  } else if (signals.some((s) => s.severity === "critical")) {
    parts.push(`Consigliato un intervento mirato di recupero.`);
  } else if (subjectProgress.length > 0 && !weakest) {
    parts.push(`Nessun segnale critico al momento.`);
  }

  return parts.join(" ");
}

// Status badge from learning index
function statusFromAvg(avg: number | null): { label: string; variant: "success" | "warning" | "secondary" | "destructive" | "outline" } {
  if (avg === null) return { label: "Senza dati", variant: "outline" };
  if (avg < 40) return { label: "Da seguire", variant: "destructive" };
  if (avg < 60) return { label: "In ripresa", variant: "warning" };
  if (avg < 75) return { label: "Regolare", variant: "secondary" };
  return { label: "In miglioramento", variant: "success" };
}

// Inline sparkline SVG
function Sparkline({ values, width = 240, height = 56 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <div className="text-xs text-muted-foreground italic py-2">Servono almeno 2 attività per il grafico.</div>;
  }
  const max = Math.max(100, ...values);
  const min = 0;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / (max - min)) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${points.join(" L ")}`;
  // Trend color
  const trend = values[values.length - 1] - values[0];
  const stroke = trend >= 0 ? "hsl(var(--primary))" : "hsl(0 70% 55%)";
  return (
    <svg width={width} height={height} className="overflow-visible">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="hsl(var(--border))" strokeDasharray="2 3" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / (max - min)) * (height - 8) - 4;
        return <circle key={i} cx={x} cy={y} r="2.5" fill={stroke} />;
      })}
    </svg>
  );
}

export default function StudentView() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("Studente");
  const [className, setClassName] = useState("");
  const [classSubject, setClassSubject] = useState<string>("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [manualGrades, setManualGrades] = useState<any[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeDays, setActiveDays] = useState(0);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [subjectProgress, setSubjectProgress] = useState<SubjectStat[]>([]);
  const [classAvg, setClassAvg] = useState<number | null>(null);
  const [classScale, setClassScale] = useState<ScaleId>("/10");

  // Communication dialog
  const [showComm, setShowComm] = useState(false);
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Manual grade modal (free entry)
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [assignments, setAssignments] = useState<Array<{ id: string; title: string }>>([]);

  // AI grade review modal
  const [reviewActivity, setReviewActivity] = useState<Activity | null>(null);

  useEffect(() => {
    if (!studentId || !classId || !user) return;
    loadStudentData();
  }, [studentId, classId, user]);

  async function loadStudentData() {
    setLoading(true);
    const profileId = session?.profileId;
    if (!profileId) { navigate("/dashboard"); return; }

    try {
      // Load class info (incl. materia for filtering)
      const { data: classeData } = await (supabase as any)
        .from("classi").select("nome, materia").eq("id", classId).single();
      setClassName(classeData?.nome || "");
      const subj: string = classeData?.materia || "";
      setClassSubject(subj);
      const subjectMatches = (s: string | null | undefined) =>
        !subj || (s || "").trim().toLowerCase() === subj.trim().toLowerCase();

      // Load student profile name from enrollment
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

      // Load assignment_results
      const { data: results } = await (supabase as any)
        .from("assignment_results")
        .select("*, teacher_assignments!assignment_results_assignment_id_fkey(title, type, subject, due_date, assigned_at)")
        .eq("student_id", studentId)
        .order("completed_at", { ascending: false });

      const activityList: Activity[] = [];
      const scores: number[] = [];
      const errorsByType: Record<string, number> = {};
      const subjectScores: Record<string, number[]> = {};

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
          assigned_at: a?.assigned_at,
          completed_at: r.completed_at,
          score: r.score,
          status: r.status,
          errors_summary: r.errors_summary || {},
          answers: Array.isArray(r.answers) ? r.answers : [],
          assignment_id: r.assignment_id,
        });
        if (r.score != null) {
          scores.push(r.score);
          if (aSubj) {
            if (!subjectScores[aSubj]) subjectScores[aSubj] = [];
            subjectScores[aSubj].push(r.score);
          }
        }
        if (r.errors_summary && typeof r.errors_summary === "object") {
          Object.keys(r.errors_summary as Record<string, any>).forEach((k) => {
            errorsByType[k] = (errorsByType[k] || 0) + 1;
          });
        }
      });

      setActivities(activityList);

      // Per-subject progress with trend (delta vs previous half)
      const progressArr: SubjectStat[] = Object.entries(subjectScores).map(([subject, arr]) => {
        const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        let delta = 0;
        if (arr.length >= 2) {
          // arr is in order from most-recent first (results were ordered desc)
          const half = Math.floor(arr.length / 2);
          const recent = arr.slice(0, half || 1);
          const older = arr.slice(half || 1);
          if (older.length > 0) {
            const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
            delta = Math.round(recentAvg - olderAvg);
          }
        }
        return { subject, avg, count: arr.length, delta };
      }).sort((a, b) => b.count - a.count);
      setSubjectProgress(progressArr);

      // Class average for the same subject (for comparison)
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

      // Manual grades (for this student in this class)
      const { data: grades } = await (supabase as any)
        .from("manual_grades")
        .select("*")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .order("graded_at", { ascending: false });
      setManualGrades(grades || []);

      // Detect class default grade scale (most-used scale across all manual grades for this class)
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
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
        if (top) setClassScale(top[0] as ScaleId);
      }

      const { data: assignmentsList } = await (supabase as any)
        .from("teacher_assignments")
        .select("id, title")
        .eq("class_id", classId)
        .order("assigned_at", { ascending: false });
      setAssignments((assignmentsList || []).map((a: any) => ({ id: a.id, title: a.title })));

      // Compute signals with severity + suggested actions
      const sigs: Signal[] = [];
      const topErrors = Object.entries(errorsByType).sort(([, a], [, b]) => b - a).slice(0, 3);
      topErrors.forEach(([type, count]) => {
        sigs.push({
          text: `Difficoltà su "${type}" — ${count} ricorrenz${count > 1 ? "e" : "a"} nelle ultime attività`,
          severity: count >= 3 ? "critical" : "warning",
          actions: ["recovery", "material"],
          topic: type,
        });
      });
      if (scores.length >= 2) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg < 40) sigs.push({
          text: "Media molto bassa — consigliato intervento di recupero.",
          severity: "critical",
          actions: ["recovery", "message"],
        });
        else if (avg < 50) sigs.push({
          text: "Media sotto soglia — monitorare le prossime verifiche.",
          severity: "warning",
          actions: ["material"],
        });
        const recent = scores.slice(0, 3);
        if (recent.length >= 2 && recent[0] < recent[recent.length - 1] - 15) {
          sigs.push({
            text: "Calo recente nel rendimento.",
            severity: "warning",
            actions: ["message", "session"],
          });
        }
      }
      const lateCount = activityList.filter(a => a.status !== "completed" && a.due_date && new Date(a.due_date) < new Date()).length;
      if (lateCount >= 2) sigs.push({
        text: `${lateCount} attività in ritardo.`,
        severity: "warning",
        actions: ["message"],
      });
      setSignals(sigs);

      // Continuity
      const completedDates = activityList
        .filter(a => a.status === "completed" && a.completed_at)
        .map(a => new Date(a.completed_at!).toDateString());
      const uniqueDays = [...new Set(completedDates)];
      setActiveDays(uniqueDays.length);
      if (uniqueDays.length > 0) setLastAccess(uniqueDays[0]);

      // Demo seed (coherent topic per subject, no Italiano/decimali bug)
      if (isDemo && activityList.length === 0 && (grades || []).length === 0 && uniqueDays.length === 0) {
        const demoSubject = subj || "Matematica";
        const demoTopic = pickDemoTopicForSubject(demoSubject);
        const today = new Date();
        const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();
        // Generate a descending trend: 4 scores from "decent" to "poor"
        const demoScores = [45, 32, 22, 8];
        setSubjectProgress([
          { subject: demoSubject, avg: Math.round(demoScores.reduce((a, b) => a + b, 0) / 4), count: 4, delta: -22 },
        ]);
        setActivities([
          { title: `Verifica su ${demoTopic}`, type: "verifica", subject: demoSubject, due_date: daysAgo(2), assigned_at: daysAgo(7), completed_at: daysAgo(2), score: 8, status: "completed", errors_summary: { [demoTopic]: 3 } },
          { title: `Esercizi di ${demoSubject}`, type: "esercizio", subject: demoSubject, due_date: daysAgo(5), assigned_at: daysAgo(10), completed_at: daysAgo(5), score: 22, status: "completed", errors_summary: { [demoTopic]: 2 } },
          { title: `Verifica intermedia`, type: "verifica", subject: demoSubject, due_date: daysAgo(14), assigned_at: daysAgo(21), completed_at: daysAgo(14), score: 32, status: "completed", errors_summary: {} },
          { title: `Compito di ${demoSubject}`, type: "studio", subject: demoSubject, due_date: daysAgo(20), assigned_at: daysAgo(25), completed_at: daysAgo(20), score: 45, status: "completed", errors_summary: {} },
        ]);
        setManualGrades([]);
        setActiveDays(2);
        setLastAccess(new Date(today.getTime() - 6 * 86400000).toDateString());
        setClassAvg(65);
        setSignals([
          { text: `Difficoltà su "${demoTopic}" — 5 ricorrenze nelle ultime due verifiche`, severity: "critical" },
          { text: "Ha avuto bisogno di molti suggerimenti durante le ultime sessioni", severity: "warning" },
          { text: "Solo 2 sessioni registrate nell'ultima settimana", severity: "info" },
        ]);
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

  // Derived values
  const overallAvg = useMemo(() => {
    if (subjectProgress.length === 0) return null;
    const sum = subjectProgress.reduce((a, s) => a + s.avg * s.count, 0);
    const total = subjectProgress.reduce((a, s) => a + s.count, 0);
    return total > 0 ? Math.round(sum / total) : null;
  }, [subjectProgress]);

  const status = statusFromAvg(overallAvg);

  const daysSinceLastActivity = useMemo(() => {
    const lastTs = activities
      .filter(a => a.completed_at)
      .map(a => new Date(a.completed_at!).getTime())
      .sort((a, b) => b - a)[0];
    if (!lastTs) return null;
    return Math.floor((Date.now() - lastTs) / 86400000);
  }, [activities]);

  const summary = useMemo(
    () => buildStudentSummary(studentName, subjectProgress, signals, daysSinceLastActivity),
    [studentName, subjectProgress, signals, daysSinceLastActivity]
  );

  // Trend values for sparkline (chronological: oldest → newest)
  const trendValues = useMemo(() => {
    return activities
      .filter(a => a.score != null && a.completed_at)
      .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
      .map(a => Math.round(a.score!));
  }, [activities]);

  // Topic for recovery suggestion
  const recoveryTopic = useMemo(() => {
    const m = signals.map(s => s.text.match(/"([^"]+)"/)).find(x => x && x[1]);
    return m ? m[1]! : (subjectProgress[0]?.subject || "argomento critico");
  }, [signals, subjectProgress]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-5">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/classe/${classId}`)} className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-1" /> {className}
            </Button>
            <AvatarInitials name={studentName} size="lg" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{studentName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {className && <Badge variant="secondary" className="text-xs">{className}</Badge>}
                <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                {daysSinceLastActivity !== null && daysSinceLastActivity > 5 && (
                  <Badge variant="outline" className="text-xs">Inattivo da {daysSinceLastActivity}g</Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowComm(true)}>
            <Mail className="w-3.5 h-3.5 mr-1" /> Scrivi ai genitori
          </Button>
        </div>

        {/* ZONA 1 — DIAGNOSI A COLPO D'OCCHIO (sticky) */}
        <div className="sticky top-2 z-10 bg-card border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Sintesi
              </p>
              <p className="text-sm sm:text-base text-foreground leading-relaxed">{summary}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => navigate(`/classe/${classId}?tab=materiali&recovery_topic=${encodeURIComponent(recoveryTopic)}&recovery_subject=${encodeURIComponent(classSubject || "")}`)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
            >
              <span className="text-xl">🔧</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Genera recupero</p>
                <p className="text-xs text-muted-foreground truncate">su {recoveryTopic}</p>
              </div>
            </button>
            <button
              onClick={() => navigate(`/classe/${classId}?tab=materiali`)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border hover:bg-muted/60 transition-colors text-left"
            >
              <span className="text-xl">📄</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Materiale semplificato</p>
                <p className="text-xs text-muted-foreground truncate">Ripartire dalle basi</p>
              </div>
            </button>
          </div>
        </div>

        {/* ZONA 2 — ANDAMENTO NEL TEMPO */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              📈 Andamento nel tempo
            </h2>
            {classAvg !== null && (
              <span className="text-xs text-muted-foreground">Media classe: <span className="font-semibold text-foreground">{classAvg}%</span></span>
            )}
          </div>

          {trendValues.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-foreground">{overallAvg ?? "—"}<span className="text-lg text-muted-foreground">%</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Media SarAI · {trendValues.length} attività</p>
                </div>
                <Sparkline values={trendValues} />
              </div>

              {subjectProgress.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {subjectProgress.map((p) => {
                    const TrendIcon = p.delta > 5 ? TrendingUp : p.delta < -5 ? TrendingDown : Minus;
                    const trendColor = p.delta > 5 ? "text-emerald-600" : p.delta < -5 ? "text-red-600" : "text-muted-foreground";
                    return (
                      <div key={p.subject} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground truncate">{p.subject}</span>
                          <span className="text-xs text-muted-foreground shrink-0">({p.count})</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Progress value={p.avg} className="h-1.5 w-20" />
                          <span className="text-sm font-semibold text-foreground w-10 text-right">{p.avg}%</span>
                          {p.delta !== 0 && (
                            <span className={`flex items-center gap-0.5 text-xs ${trendColor} w-12`}>
                              <TrendIcon className="w-3 h-3" />
                              {Math.abs(p.delta)}%
                            </span>
                          )}
                          {p.delta === 0 && <span className="w-12" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-4xl mb-2 opacity-40">📈</span>
              <p className="text-sm text-muted-foreground">Nessun dato di andamento disponibile</p>
            </div>
          )}
        </div>

        {/* ZONA 3 — DETTAGLI (collassabili) */}
        <div className="space-y-3">
          {/* Verifiche e compiti */}
          <details open className="group bg-card border border-border rounded-2xl shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer p-5 list-none">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Verifiche e compiti ({activities.length + manualGrades.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-xl text-xs h-7" onClick={(e) => { e.preventDefault(); setShowGradeModal(true); }}>
                  <PenLine className="w-3 h-3 mr-1" /> Voto manuale
                </Button>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="px-5 pb-5">
              {activities.length === 0 && manualGrades.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nessuna verifica registrata</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a, i) => {
                    const score = a.score != null ? Math.round(a.score) : null;
                    const belowThreshold = score != null && score < 50;
                    let statusLabel = "In attesa";
                    let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                    if (a.status === "completed") { statusLabel = "Completato"; statusVariant = "default"; }
                    else if (a.status === "in_progress") { statusLabel = "In corso"; statusVariant = "secondary"; }
                    else if (a.due_date && new Date(a.due_date) < new Date()) { statusLabel = "In ritardo"; statusVariant = "destructive"; }
                    return (
                      <div key={`activity-${i}`} className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.subject}
                            {a.completed_at ? ` · ${new Date(a.completed_at).toLocaleDateString("it-IT")}` : ""}
                            {classAvg !== null && score !== null && ` · classe ${classAvg}%`}
                          </p>
                        </div>
                        {belowThreshold && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {score != null && <span className="text-sm font-semibold text-foreground">{score}%</span>}
                        <Badge variant={statusVariant} className="text-[10px] shrink-0">{statusLabel}</Badge>
                      </div>
                    );
                  })}
                  {manualGrades.map((g: any) => (
                    <div key={g.id} className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-xl">
                      <span className="text-base shrink-0">📝</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.assignment_title || "Voto manuale"}</p>
                        <p className="text-xs text-muted-foreground">Voto docente · {new Date(g.graded_at).toLocaleDateString("it-IT")}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {g.grade}{g.grade_scale !== "giudizio" ? g.grade_scale : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          {/* Segnali educativi */}
          <details open className="group bg-card border border-border rounded-2xl shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer p-5 list-none">
              <div className="flex items-center gap-2">
                <span className="text-base">🔍</span>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Segnali educativi ({signals.length})
                </h3>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-5">
              {signals.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm">Nessun segnale particolare da osservare</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {signals.map((sig, i) => {
                    const map = {
                      critical: { Icon: AlertCircle, cls: "text-red-600 bg-red-500/10 border-red-500/20" },
                      warning: { Icon: AlertTriangle, cls: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
                      info: { Icon: Info, cls: "text-sky-600 bg-sky-500/10 border-sky-500/20" },
                    }[sig.severity];
                    return (
                      <div key={i} className={`flex items-start gap-2 text-xs rounded-lg p-3 border ${map.cls}`}>
                        <map.Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{sig.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>

          {/* Abitudini di studio (continuità + autonomia) */}
          <details className="group bg-card border border-border rounded-2xl shadow-sm">
            <summary className="flex items-center justify-between cursor-pointer p-5 list-none">
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Abitudini di studio</h3>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Continuità</p>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-2xl font-bold text-foreground">{activeDays}</span>
                    <span className="text-xs text-muted-foreground">giorni attivi</span>
                  </div>
                  {lastAccess && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Ultima sessione: {new Date(lastAccess).toLocaleDateString("it-IT")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Autonomia</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {signals.some(s => s.text.toLowerCase().includes("suggerimenti"))
                      ? "Ha avuto bisogno di supporto frequente nelle ultime sessioni."
                      : "Lavora in modo autonomo nella maggior parte delle attività."}
                  </p>
                </div>
              </div>
            </div>
          </details>
        </div>

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

        <ManualGradeModal
          open={showGradeModal}
          onOpenChange={setShowGradeModal}
          classId={classId!}
          userId={user!.id}
          students={[{ id: studentId!, name: studentName }]}
          assignments={assignments}
          defaultStudentId={studentId}
          defaultStudentName={studentName}
          onSaved={loadStudentData}
        />
      </div>
    </div>
  );
}
