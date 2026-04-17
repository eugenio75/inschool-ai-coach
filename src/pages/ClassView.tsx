import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Users, BookOpen, MessageSquare,
  Copy, ChevronRight, ChevronDown, AlertTriangle,
  BarChart2, Send, Lightbulb, Info, PenLine, Mail, Wrench,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import TeacherMaterialsTab, { type PrefilledMaterial } from "@/components/teacher/TeacherMaterialsTab";
import ClassInsightsTab from "@/components/teacher/ClassInsightsTab";
import ManualGradeModal from "@/components/teacher/ManualGradeModal";
import OcrGradeModal from "@/components/teacher/OcrGradeModal";
import LearningIndexModal from "@/components/teacher/LearningIndexModal";
import AssignmentDetailModal from "@/components/teacher/AssignmentDetailModal";
import ClassCoachHero, { type CoachAction } from "@/components/teacher/ClassCoachHero";
import ClassHealthBar, { type HealthIndicator } from "@/components/teacher/ClassHealthBar";
import CollapsibleSection from "@/components/teacher/CollapsibleSection";
import type { ScaleId } from "@/components/teacher/GradeReviewModal";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { ReportTeacherButton } from "@/components/shared/ReportTeacherButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

async function fetchTeacherClassData(classId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teacher-class-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ classId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Errore nel caricamento della classe");
  }
  return response.json();
}

/* ─── helpers ─── */
function computeClassStats(students: any[], assignmentResults: any[]) {
  const totalStudents = students.length;
  if (totalStudents === 0) return { avg: 0, completion: 0, regular: 0, toFollow: 0, statusMsg: "Nessuno studente iscritto" };

  let totalScore = 0;
  let totalCompleted = 0;
  let totalAssigned = 0;

  const studentScores: Record<string, number[]> = {};

  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const sid = r.student_id || r.id;
      if (!studentScores[sid]) studentScores[sid] = [];
      if (r.score != null) {
        totalScore += r.score;
        studentScores[sid].push(r.score);
      }
      totalAssigned++;
      if (r.status === "completed") totalCompleted++;
    });
  });

  const avg = totalAssigned > 0 ? Math.round(totalScore / totalAssigned) : 0;
  const completion = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  let toFollow = 0;
  Object.values(studentScores).forEach(scores => {
    if (scores.length > 0) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (mean < 60) toFollow++;
    }
  });

  const regular = totalStudents - toFollow;
  let statusMsg = "La classe procede regolarmente";
  if (toFollow >= 3) statusMsg = `${toFollow} studenti da seguire`;
  else if (toFollow > 0) statusMsg = `${toFollow} student${toFollow === 1 ? "e" : "i"} da seguire`;

  return { avg, completion, regular, toFollow, statusMsg, studentScores };
}

function getStudentBadge(studentId: string, studentScores: Record<string, number[]> | undefined, assignmentResults: any[]) {
  if (!studentScores) return null;
  const scores = studentScores[studentId];
  if (!scores || scores.length === 0) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  let lateCount = 0;
  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      if ((r.student_id || r.id) === studentId && r.status !== "completed") lateCount++;
    });
  });

  if (mean < 50 || lateCount >= 3) return { label: "Da seguire", variant: "destructive" as const };
  if (lateCount >= 2) return { label: "In ritardo", variant: "secondary" as const };
  if (scores.length >= 2 && scores[scores.length - 1] > scores[scores.length - 2] + 10) return { label: "In miglioramento", variant: "default" as const };
  return null;
}

function isStudentBelowThreshold(studentId: string, studentScores: Record<string, number[]> | undefined) {
  if (!studentScores) return false;
  const scores = studentScores[studentId];
  if (!scores || scores.length === 0) return false;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return mean < 50;
}

/* ─── topics from assignments ─── */
function computeTopicMastery(assignmentResults: any[]) {
  const topicMap: Record<string, { total: number; sum: number }> = {};
  assignmentResults.forEach((a: any) => {
    const topic = a.subject || a.title || "Generale";
    if (!topicMap[topic]) topicMap[topic] = { total: 0, sum: 0 };
    (a.results || []).forEach((r: any) => {
      topicMap[topic].total++;
      topicMap[topic].sum += r.score || 0;
    });
  });
  return Object.entries(topicMap).map(([name, d]) => ({
    name,
    mastery: d.total > 0 ? Math.round(d.sum / d.total) : 0,
  }));
}

/* ─── KPI with tooltip ─── */
function KpiCard({ label, value, tooltip }: { label: string; value: string | number; tooltip: string }) {
  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-xl p-4 text-center relative">
        <p className="text-xl font-bold text-foreground">{value}</p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground/50 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ─── Indice di apprendimento ─── */
function gradeToPercent(grade: string, scale: string): number | null {
  const num = parseFloat(String(grade).replace(",", "."));
  if (!isNaN(num)) {
    if (scale === "/10") return Math.max(0, Math.min(100, (num / 10) * 100));
    if (scale === "/30") return Math.max(0, Math.min(100, (num / 30) * 100));
    if (scale === "/100") return Math.max(0, Math.min(100, num));
  }
  // Qualitative judgment
  const g = String(grade).toLowerCase().trim();
  const map: Record<string, number> = {
    "ottimo": 95, "distinto": 85, "buono": 75,
    "discreto": 65, "sufficiente": 55, "insufficiente": 35,
    "gravemente insufficiente": 20,
  };
  return map[g] ?? null;
}

function computeLearningIndex(
  assignmentResults: any[],
  manualGrades: any[],
) {
  // 1. SarAI scores (assignment_results)
  const sarAiScores: number[] = [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      totalAssigned++;
      if (r.status === "completed") totalCompleted++;
      if (r.score != null) sarAiScores.push(r.score);
    });
  });
  const sarAiAvg = sarAiScores.length > 0
    ? sarAiScores.reduce((a, b) => a + b, 0) / sarAiScores.length
    : null;

  // 2. Manual teacher grades (source = 'manual')
  const manualScores: number[] = [];
  // 3. OCR-confirmed grades (source = 'ocr_corrected')
  const ocrScores: number[] = [];
  manualGrades.forEach((g: any) => {
    const pct = gradeToPercent(g.grade, g.grade_scale);
    if (pct == null) return;
    if (g.source === "ocr_corrected") ocrScores.push(pct);
    else manualScores.push(pct);
  });
  const manualAvg = manualScores.length > 0
    ? manualScores.reduce((a, b) => a + b, 0) / manualScores.length
    : null;
  const ocrAvg = ocrScores.length > 0
    ? ocrScores.reduce((a, b) => a + b, 0) / ocrScores.length
    : null;

  // 4. Completion rate
  const completionRate = totalAssigned > 0
    ? (totalCompleted / totalAssigned) * 100
    : null;

  // Weights with redistribution
  const sources = [
    { value: sarAiAvg, weight: 0.4 },
    { value: manualAvg, weight: 0.3 },
    { value: ocrAvg, weight: 0.2 },
    { value: completionRate, weight: 0.1 },
  ];
  const available = sources.filter(s => s.value !== null);
  if (available.length < 2 || totalAssigned + manualGrades.length < 3) {
    return { index: null, available: available.length };
  }
  const totalWeight = available.reduce((sum, s) => sum + s.weight, 0);
  const index = available.reduce((sum, s) => sum + (s.value as number) * (s.weight / totalWeight), 0);
  return { index: Math.round(index), available: available.length };
}

/* ─── Last activity per student (with name fallback for legacy data) ─── */
function getLastActivityMap(
  assignmentResults: any[],
  manualGrades: any[],
  students: any[] = [],
): Record<string, string> {
  const map: Record<string, string> = {};
  // Build name → enrolled student_id map for fallback
  const nameToSid: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    const firstName = (s.profile?.name || s.student_name || "").trim().toLowerCase();
    if (firstName && sid) nameToSid[firstName] = sid;
  });

  const apply = (sid: string | undefined | null, date: string | undefined | null) => {
    if (!sid || !date) return;
    if (!map[sid] || new Date(date) > new Date(map[sid])) map[sid] = date;
  };

  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const date = r.completed_at || r.created_at || a.assigned_at;
      apply(r.student_id || r.id, date);
      // Fallback by name (sample data may have orphaned student_ids)
      const nm = (r.student_name || "").trim().toLowerCase();
      if (nm && nameToSid[nm]) apply(nameToSid[nm], date);
    });
  });
  manualGrades.forEach((g: any) => {
    apply(g.student_id, g.graded_at);
    const nm = (g.student_name || "").trim().toLowerCase();
    if (nm && nameToSid[nm]) apply(nameToSid[nm], g.graded_at);
  });
  return map;
}

/* ─── Compute reasons + suggested actions for "to follow" students ─── */
type FollowAction = "recovery" | "contact_parents";
interface FollowReason {
  studentId: string;
  studentName: string;
  reason: string;
  reasonType: "low_score" | "stale_task" | "topic_difficulty" | "no_session";
  topic?: string;
  subject?: string;
  lastActivity?: string;
  actions: FollowAction[];
}

function computeFollowReasons(
  students: any[],
  assignmentResults: any[],
  studentScores: Record<string, number[]> | undefined,
  lastActivityMap: Record<string, string>,
  classSubject: string,
): FollowReason[] {
  if (!studentScores) return [];
  const reasons: FollowReason[] = [];
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  // Build name → sid map for fallback matching
  const nameToSid: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    const fn = (s.profile?.name || s.student_name || "").trim().toLowerCase();
    if (fn && sid) nameToSid[fn] = sid;
  });

  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    const firstName = s.profile?.name || s.student_name || "Studente";
    const lastName = s.profile?.last_name || "";
    const studentName = lastName ? `${firstName} ${lastName}` : firstName;
    const fnLower = firstName.trim().toLowerCase();

    const scores = studentScores[sid] || [];
    const lastActivity = lastActivityMap[sid];
    const recent = scores.slice(-3);
    const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : null;

    // Find topic with most errors for this student (with name fallback)
    const errorTopics: Record<string, number> = {};
    let staleTasks = 0;
    let assignmentSubject = "";
    assignmentResults.forEach((a: any) => {
      (a.results || []).forEach((r: any) => {
        const rsid = r.student_id || r.id;
        const rname = (r.student_name || "").trim().toLowerCase();
        const matches = rsid === sid || (rname && rname === fnLower);
        if (!matches) return;
        if (a.subject) assignmentSubject = a.subject;
        if (r.status !== "completed" && a.assigned_at) {
          const ageMs = now - new Date(a.assigned_at).getTime();
          if (ageMs > SEVEN_DAYS) staleTasks++;
        }
        if (r.errors_summary && typeof r.errors_summary === "object") {
          Object.keys(r.errors_summary).forEach(k => {
            errorTopics[k] = (errorTopics[k] || 0) + 1;
          });
        }
      });
    });
    const topErrorTopic = Object.entries(errorTopics).sort(([, a], [, b]) => b - a)[0];

    // Decide reason in priority order
    if (recentAvg != null && recentAvg < 50) {
      reasons.push({
        studentId: sid, studentName,
        reason: "Punteggio SarAI sotto il 50% nelle ultime attività",
        reasonType: "low_score",
        subject: assignmentSubject || classSubject,
        topic: topErrorTopic?.[0],
        lastActivity,
        actions: ["recovery"],
      });
    } else if (topErrorTopic && topErrorTopic[1] >= 2) {
      reasons.push({
        studentId: sid, studentName,
        reason: `Difficoltà rilevate su "${topErrorTopic[0]}"`,
        reasonType: "topic_difficulty",
        subject: assignmentSubject || classSubject,
        topic: topErrorTopic[0],
        lastActivity,
        actions: ["recovery"],
      });
    } else if (staleTasks >= 1) {
      reasons.push({
        studentId: sid, studentName,
        reason: `Compito non completato da 7+ giorni`,
        reasonType: "stale_task",
        lastActivity,
        actions: ["contact_parents"],
      });
    } else if (lastActivity && now - new Date(lastActivity).getTime() > SEVEN_DAYS) {
      reasons.push({
        studentId: sid, studentName,
        reason: "Nessuna sessione negli ultimi 7 giorni",
        reasonType: "no_session",
        lastActivity,
        actions: ["contact_parents"],
      });
    } else if (scores.length > 0 && scores.reduce((a, b) => a + b, 0) / scores.length < 60) {
      // Generic catch-all to align with stats.toFollow (mean < 60)
      reasons.push({
        studentId: sid, studentName,
        reason: "Media generale sotto la sufficienza",
        reasonType: "low_score",
        subject: assignmentSubject || classSubject,
        topic: topErrorTopic?.[0],
        lastActivity,
        actions: ["recovery"],
      });
    }
  });

  return reasons;
}

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignmentResults, setAssignmentResults] = useState<any[]>([]);
  const [manualGrades, setManualGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "classe";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [prefilledMaterial, setPrefilledMaterial] = useState<PrefilledMaterial | null>(null);
  const [verificheOpen, setVerificheOpen] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [followExpanded, setFollowExpanded] = useState(false);
  const [parentEmailTarget, setParentEmailTarget] = useState<{ studentId: string; studentName: string } | null>(null);
  const [parentEmailSubject, setParentEmailSubject] = useState("");
  const [parentEmailBody, setParentEmailBody] = useState("");
  const [ocrAssignment, setOcrAssignment] = useState<any>(null);
  const [learningModalOpen, setLearningModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);

  useEffect(() => {
    if (!classId) return;
    if (!profileId && !user) return;
    loadClass();
  }, [classId, profileId, user?.id]);

  async function loadClass() {
    setLoading(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      let loadedStudents: any[] = [];
      let loadedResults: any[] = [];
      let loadedClasse: any = null;
      if (authSession?.access_token) {
        const data = await fetchTeacherClassData(classId!);
        loadedClasse = data.classe;
        loadedStudents = data.students || [];
        loadedResults = data.assignmentResults || [];

        const { data: mats } = await (supabase as any)
          .from("teacher_materials")
          .select("*")
          .eq("teacher_id", authSession.user.id)
          .eq("class_id", classId)
          .order("created_at", { ascending: false });
        setMaterials(mats || []);

        // Load manual grades for this class
        const { data: grades } = await (supabase as any)
          .from("manual_grades")
          .select("*")
          .eq("class_id", classId)
          .order("graded_at", { ascending: false });
        setManualGrades(grades || []);
      } else {
        const { data: cl } = await (supabase as any)
          .from("classi").select("*").eq("id", classId).single();
        loadedClasse = cl;
        const { data: enr } = await (supabase as any)
          .from("class_enrollments").select("*").eq("class_id", classId).eq("status", "active");
        const enrollments = enr || [];
        if (enrollments.length > 0) {
          const studentIds = enrollments.map((e: any) => e.student_id);
          const { data: profiles } = await (supabase as any)
            .from("child_profiles")
            .select("id, name, parent_id, avatar_emoji, school_level")
            .in("id", studentIds);
          const profileMap: Record<string, any> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
          loadedStudents = enrollments.map((e: any) => ({ ...e, profile: profileMap[e.student_id] || null }));
        }
        setMaterials([]);
        setManualGrades([]);
      }

      // Demo enrichment: any student whose name matches "esempio/demo/sample/Studente"
      // and has no scored results gets a synthetic low-score result so the
      // "Da seguire" pipeline (badge + follow reasons + ⚠ icon) lights up.
      const demoNameRe = /^\s*studente\s*$|esempio|demo|sample/i;
      const subj = loadedClasse?.materia || "";
      const sevenDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
      const syntheticResults: any[] = [];
      loadedStudents.forEach((s: any) => {
        const sid = s.student_id || s.id;
        const fn = s.profile?.name || s.student_name || "";
        if (!demoNameRe.test(fn)) return;
        // Check if already has any scored result
        const hasReal = loadedResults.some((a: any) =>
          (a.results || []).some((r: any) => (r.student_id || r.id) === sid && r.score != null)
        );
        if (hasReal) return;
        syntheticResults.push({
          id: `demo-followup-${sid}`,
          title: `Verifica di ${subj || "matematica"}`,
          subject: subj || "Matematica",
          assigned_at: sevenDaysAgo,
          results: [{
            student_id: sid,
            student_name: fn,
            score: 8,
            status: "completed",
            errors_summary: { "I numeri decimali": 3 },
          }],
        });
      });

      setClasse(loadedClasse);
      setStudents(loadedStudents);
      setAssignmentResults([...loadedResults, ...syntheticResults]);
    } catch (error) {
      console.error("loadClass error:", error);
      toast.error("Non sono riuscito a caricare la classe.");
      setStudents([]);
      setAssignmentResults([]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!classe) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Classe non trovata.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")} className="mt-4">Torna alla dashboard</Button>
      </div>
    );
  }

  const stats = computeClassStats(students, assignmentResults);
  const topics = computeTopicMastery(assignmentResults);

  const feedbackAlertData: Array<{ msg: string; subject: string; topic: string; count: number }> = [];
  assignmentResults.forEach((a: any) => {
    const results = a.results || [];
    const notCompleted = results.filter((r: any) => r.status !== "completed").length;
    if (notCompleted >= 6) feedbackAlertData.push({
      msg: `"${a.title}": ${notCompleted} studenti non hanno completato — proponi un follow-up.`,
      subject: a.subject || classe?.materia || "",
      topic: a.title || "",
      count: notCompleted,
    });
    const errorCounts: Record<string, number> = {};
    results.forEach((r: any) => {
      const summary = r.errors_summary;
      if (summary && typeof summary === "object") {
        Object.keys(summary).forEach(k => { errorCounts[k] = (errorCounts[k] || 0) + 1; });
      }
    });
    Object.entries(errorCounts).forEach(([err, count]) => {
      if (count >= 4) feedbackAlertData.push({
        msg: `"${a.title}": ${count} studenti con errore su "${err}" — suggerisci recupero mirato.`,
        subject: a.subject || classe?.materia || "",
        topic: err,
        count,
      });
    });
  });

  function handleGenerateRecovery(subject: string, topic: string, count: number) {
    setPrefilledMaterial({
      tipo_attivita: "recupero",
      materia: subject,
      argomento: topic,
      descrizione: `Esercizio di recupero mirato sull'argomento "${topic}" per ${count} studenti che mostrano difficoltà specifiche su questo punto.`,
    });
    setActiveTab("materiali");
  }

  // Student list for manual grade modal
  const studentList = students.map((s: any) => {
    const firstName = s.profile?.name || s.student_name || "Studente";
    const lastName = s.profile?.last_name || "";
    return { id: s.student_id || s.id, name: lastName ? `${firstName} ${lastName}` : firstName };
  });

  // Assignment list for manual grade modal
  const assignmentList = assignmentResults.map((a: any) => ({ id: a.id, title: a.title }));

  // Detect class default grade scale (most-used in manual_grades, fallback /10)
  const classScale: ScaleId = (() => {
    if (manualGrades.length === 0) return "/10";
    const counts: Record<string, number> = {};
    manualGrades.forEach((g: any) => {
      const s = g.grade_scale || "/10";
      counts[s] = (counts[s] || 0) + 1;
    });
    const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
    return (top?.[0] as ScaleId) || "/10";
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* ─── Header ─── */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>

        <div className="bg-[hsl(var(--primary))] rounded-2xl p-4 text-primary-foreground relative">
          <div>
            <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wider mb-1">Classe</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{classe.nome}</h1>
              <span className={cn(
                "w-3 h-3 rounded-full shrink-0",
                stats.toFollow > 0 ? "bg-amber-400" : "bg-green-400"
              )} />
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              {classe.materia && (
                <span className="text-sm bg-primary-foreground/20 px-3 py-0.5 rounded-full font-medium">{classe.materia}</span>
              )}
              <span className="text-sm text-primary-foreground/70">{students.length} studenti</span>
              {classe.ordine_scolastico && (
                <span className="text-sm text-primary-foreground/50">{classe.ordine_scolastico}</span>
              )}
            </div>
            {profileId && !user && (
              <ReportTeacherButton teacherId={classe.docente_profile_id} className="mt-2 text-primary-foreground/40 hover:text-primary-foreground/70" />
            )}
          </div>
          <div className="absolute bottom-3 right-5 flex items-center gap-1.5">
            <span className="text-[10px] text-primary-foreground/40 uppercase tracking-wider">Codice:</span>
            <span className="font-mono text-xs font-semibold text-primary-foreground/60 tracking-widest">{classe.codice_invito}</span>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 p-1 rounded transition-colors"
            >
              <Copy className="w-3 h-3 text-primary-foreground/50" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 rounded-xl">
          <TabsTrigger value="classe" className="text-xs rounded-lg">
            <Users className="w-3.5 h-3.5 mr-1" /> La classe
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs rounded-lg">
            <Lightbulb className="w-3.5 h-3.5 mr-1" /> Insights
          </TabsTrigger>
          <TabsTrigger value="materiali" className="text-xs rounded-lg">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Materiali
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs rounded-lg">
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Coach AI
          </TabsTrigger>
        </TabsList>

        {/* ━━━ TAB: LA CLASSE ━━━ */}
        <TabsContent value="classe" className="mt-6 space-y-5">
          {students.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Nessuno studente ancora</p>
              <p className="text-sm text-muted-foreground mb-4">
                Condividi il codice classe per invitare gli studenti
              </p>
              <div className="bg-muted rounded-xl py-3 px-4 inline-block mb-3">
                <span className="font-mono font-bold text-2xl tracking-widest text-foreground">
                  {classe.codice_invito}
                </span>
              </div>
              <br />
              <Button variant="outline" size="sm" className="rounded-xl"
                onClick={() => { navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copia codice
              </Button>
            </div>
          ) : (
            <>
              {(() => {
                const lastActivityMap = getLastActivityMap(assignmentResults, manualGrades, students);
                const followReasons = computeFollowReasons(
                  students, assignmentResults, stats.studentScores as any,
                  lastActivityMap, classe?.materia || "",
                );
                const li = computeLearningIndex(assignmentResults, manualGrades);
                const idx = li.index;

                /* ─── Coach hero: contextual message + 2-3 actions ─── */
                const firstFollow = followReasons[0];
                const stalest = (() => {
                  const now = Date.now();
                  const SEVEN_DAYS = 7 * 86400000;
                  return assignmentResults.find((a: any) => {
                    const ageMs = now - new Date(a.assigned_at || 0).getTime();
                    if (ageMs < SEVEN_DAYS) return false;
                    const r = a.results || [];
                    const completed = r.filter((x: any) => x.status === "completed").length;
                    return completed < students.length;
                  });
                })();

                let coachMessage: string;
                const coachActions: CoachAction[] = [];

                if (followReasons.length === 0 && assignmentResults.length === 0) {
                  coachMessage = "La classe è pronta a partire. Vuoi assegnare la prima attività o creare un materiale di benvenuto?";
                  coachActions.push({
                    id: "create-mat", label: "Crea materiale", icon: "next",
                    onClick: () => setActiveTab("materiali"),
                  });
                } else if (followReasons.length === 0) {
                  coachMessage = `Tutto sotto controllo: ${students.length} studenti procedono regolarmente. Vuoi proporre una nuova sfida o un ripasso?`;
                  coachActions.push({
                    id: "new-mat", label: "Nuovo materiale", icon: "next",
                    onClick: () => setActiveTab("materiali"),
                  });
                } else if (followReasons.length === 1 && firstFollow) {
                  const topic = firstFollow.topic ? ` su "${firstFollow.topic}"` : "";
                  coachMessage = `${firstFollow.studentName} sta facendo fatica${topic}. Posso preparare un recupero mirato o aiutarti a scrivere ai genitori.`;
                  if (firstFollow.actions.includes("recovery")) {
                    coachActions.push({
                      id: "rec", label: "Genera recupero", icon: "recovery",
                      onClick: () => handleGenerateRecovery(
                        firstFollow.subject || classe?.materia || "",
                        firstFollow.topic || firstFollow.reason,
                        1,
                      ),
                    });
                  }
                  if (firstFollow.actions.includes("contact_parents") || firstFollow.reasonType === "low_score") {
                    coachActions.push({
                      id: "par", label: "Scrivi ai genitori", icon: "parents", variant: "ghost",
                      onClick: () => {
                        setParentEmailTarget({ studentId: firstFollow.studentId, studentName: firstFollow.studentName });
                        setParentEmailSubject(`Aggiornamento su ${firstFollow.studentName}`);
                        setParentEmailBody(
                          `Buongiorno,\n\nle scrivo a proposito di ${firstFollow.studentName}: ${firstFollow.reason.toLowerCase()}.\n\nVi propongo un breve confronto per condividere strategie utili a casa.\n\nCordiali saluti.`,
                        );
                      },
                    });
                  }
                } else {
                  coachMessage = `${followReasons.length} studenti hanno bisogno di attenzione questa settimana. Vuoi che prepari un'attività di recupero condivisa per la classe?`;
                  coachActions.push({
                    id: "rec-class", label: "Recupero per la classe", icon: "recovery",
                    onClick: () => handleGenerateRecovery(
                      classe?.materia || "",
                      firstFollow?.topic || "argomenti recenti",
                      followReasons.length,
                    ),
                  });
                  if (stalest) {
                    coachActions.push({
                      id: "stale", label: `Sollecita "${stalest.title}"`, icon: "next", variant: "ghost",
                      onClick: () => setActiveAssignment(stalest),
                    });
                  }
                }

                /* ─── Health indicators ─── */
                const now = Date.now();
                const SEVEN = 7 * 86400000;
                const activeRecently = students.filter((s: any) => {
                  const sid = s.student_id || s.id;
                  const last = lastActivityMap[sid];
                  return last && now - new Date(last).getTime() < SEVEN;
                }).length;
                const consistency = students.length > 0
                  ? Math.round((activeRecently / students.length) * 100)
                  : null;
                const method = stats.completion > 0 ? Math.min(100, stats.completion) : null;
                const learning = idx;
                const overall = (() => {
                  const vals = [method, learning, consistency].filter((v): v is number => v != null);
                  if (vals.length === 0) return null;
                  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                })();

                const indicators: HealthIndicator[] = [
                  { key: "method", label: "Metodo", value: method },
                  { key: "learning", label: "Apprendimento", value: learning },
                  { key: "consistency", label: "Continuità", value: consistency },
                ];

                /* ─── Section: Studenti da seguire (open by default if any) ─── */
                const SectionFollow = followReasons.length === 0 ? null : (
                  <CollapsibleSection
                    title="Studenti da seguire"
                    accent="amber"
                    defaultOpen={true}
                    badge={
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold">
                        {followReasons.length}
                      </span>
                    }
                  >
                    <div className="divide-y divide-border">
                      {followReasons.map((fr) => (
                        <button
                          key={fr.studentId}
                          onClick={() => navigate(`/studente/${fr.studentId}?classId=${classId}`)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
                        >
                          <AvatarInitials name={fr.studentName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{fr.studentName}</p>
                            <p className="text-[12px] text-muted-foreground truncate mt-0.5">{fr.reason}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>
                );

                /* ─── Section: Studenti (collapsible) ─── */
                const SectionStudents = (
                  <CollapsibleSection
                    title="Studenti"
                    defaultOpen={followReasons.length === 0}
                    meta={`${students.length}`}
                  >
                    <div className="divide-y divide-border">
                      {students.map((s: any) => {
                        const firstName = s.profile?.name || s.student_name || "Studente";
                        const lastName = s.profile?.last_name || "";
                        const name = lastName ? `${firstName} ${lastName}` : firstName;
                        const sid = s.student_id || s.id;
                        const last = lastActivityMap[sid];
                        const lastLabel = last
                          ? new Date(last).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
                          : "—";
                        const needsFollow = followReasons.some(fr => fr.studentId === sid);
                        return (
                          <button
                            key={s.id}
                            onClick={() => navigate(`/studente/${sid}?classId=${classId}`)}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-left"
                          >
                            <AvatarInitials name={name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Ultima attività: {lastLabel}
                              </p>
                            </div>
                            {needsFollow && (
                              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
                                Da seguire
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                );

                /* ─── Section: Attività assegnate (collapsible) ─── */
                const SectionAssignments = (
                  <CollapsibleSection
                    title="Attività assegnate"
                    defaultOpen={followReasons.length === 0 && assignmentResults.length <= 4}
                    meta={`${assignmentResults.length}`}
                  >
                    {assignmentResults.length === 0 ? (
                      <div className="px-5 py-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Nessuna attività assegnata a questa classe.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {assignmentResults.map((a: any) => {
                          const results = a.results || [];
                          const completed = results.filter((r: any) => r.status === "completed").length;
                          const total = students.length || results.length;
                          const date = a.assigned_at
                            ? new Date(a.assigned_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
                            : "";
                          const allDone = total > 0 && completed === total;
                          return (
                            <button
                              key={a.id}
                              onClick={() => setActiveAssignment(a)}
                              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                  {a.subject ? `${a.subject}` : ""}{a.subject && date ? " · " : ""}{date}
                                </p>
                              </div>
                              <span className={cn(
                                "shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold",
                                allDone
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-muted text-muted-foreground",
                              )}>
                                {allDone
                                  ? `${completed}/${total} ✓`
                                  : `${completed}/${total} consegnat${total === 1 ? "o" : "i"}`}
                              </span>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CollapsibleSection>
                );

                return (
                  <>
                    <ClassCoachHero
                      message={coachMessage}
                      actions={coachActions}
                    />
                    <ClassHealthBar
                      overall={overall}
                      indicators={indicators}
                      onClick={idx != null ? () => setLearningModalOpen(true) : undefined}
                    />
                    {SectionFollow}
                    {SectionStudents}
                    {SectionAssignments}
                  </>
                );
              })()}
            </>
          )}
        </TabsContent>

        {/* ━━━ TAB: INSIGHTS ━━━ */}
        <TabsContent value="insights" className="mt-6">
          <ClassInsightsTab
            classId={classId!}
            onGenerateRecovery={handleGenerateRecovery}
            stats={stats}
            topics={topics}
          />
        </TabsContent>

        {/* ━━━ TAB: MATERIALI ━━━ */}
        <TabsContent value="materiali" className="mt-6">
          <TeacherMaterialsTab
            classId={classId!}
            classe={classe}
            students={students}
            materials={materials}
            userId={user!.id}
            onReload={loadClass}
            autoCreate={searchParams.get("create") === "true"}
            prefilledMaterial={prefilledMaterial}
          />
        </TabsContent>

        {/* ━━━ TAB: COACH AI ━━━ */}
        <TabsContent value="coach" className="mt-6">
          <ClassCoachChat
            classe={classe}
            students={students}
            materials={materials}
            assignmentResults={assignmentResults}
            stats={stats}
            userId={user!.id}
          />
        </TabsContent>
      </Tabs>

      {/* Manual Grade Modal */}
      <ManualGradeModal
        open={showGradeModal}
        onOpenChange={setShowGradeModal}
        classId={classId!}
        userId={user!.id}
        students={studentList}
        assignments={assignmentList}
        onSaved={loadClass}
      />

      {/* OCR Grade Modal */}
      {ocrAssignment && (
        <OcrGradeModal
          open={!!ocrAssignment}
          onOpenChange={(open) => { if (!open) setOcrAssignment(null); }}
          classId={classId!}
          userId={user!.id}
          assignment={ocrAssignment}
          students={studentList}
          onSaved={loadClass}
        />
      )}

      {/* Learning Index Modal */}
      <LearningIndexModal
        open={learningModalOpen}
        onOpenChange={setLearningModalOpen}
        classId={classId!}
      />

      {/* Assignment Detail Modal */}
      {activeAssignment && (
        <AssignmentDetailModal
          open={!!activeAssignment}
          onOpenChange={(open) => { if (!open) setActiveAssignment(null); }}
          classId={classId!}
          teacherId={user!.id}
          defaultScale={classScale}
          assignment={activeAssignment}
          students={studentList}
          manualGrades={manualGrades}
          onSaved={loadClass}
        />
      )}

      {/* Parent Email Dialog (from "studenti da seguire") */}
      <Dialog open={!!parentEmailTarget} onOpenChange={(open) => { if (!open) setParentEmailTarget(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Scrivi ai genitori di {parentEmailTarget?.studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Oggetto</Label>
              <Input
                value={parentEmailSubject}
                onChange={(e) => setParentEmailSubject(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Messaggio</Label>
              <Textarea
                value={parentEmailBody}
                onChange={(e) => setParentEmailBody(e.target.value)}
                className="mt-1 rounded-xl min-h-[160px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParentEmailTarget(null)} className="rounded-xl">
              Annulla
            </Button>
            <Button
              disabled={!parentEmailBody.trim()}
              onClick={async () => {
                if (!user || !classId || !parentEmailTarget) return;
                await (supabase as any).from("parent_communications").insert({
                  teacher_id: user.id,
                  class_id: classId,
                  student_id: parentEmailTarget.studentId,
                  type: "messaggio",
                  subject: parentEmailSubject,
                  body: parentEmailBody,
                  sent_at: new Date().toISOString(),
                  status: "sent",
                });
                toast.success("Messaggio inviato!");
                setParentEmailTarget(null);
                setParentEmailSubject("");
                setParentEmailBody("");
              }}
              className="rounded-xl"
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Coach AI Chat Component ─── */
function ClassCoachChat({ classe, students, materials, assignmentResults, stats, userId }: {
  classe: any;
  students: any[];
  materials: any[];
  assignmentResults: any[];
  stats: any;
  userId: string;
}) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function buildClassContext() {
    const studentsSummary = students.map(s => {
      const name = s.profile?.last_name ? `${s.profile?.name || "Studente"} ${s.profile.last_name}` : (s.profile?.name || s.student_name || "Studente");
      const sid = s.student_id || s.id;
      const badge = getStudentBadge(sid, stats.studentScores, assignmentResults);
      return `- ${name}: ${badge ? badge.label : "Regolare"}`;
    }).join("\n");

    const materialsSummary = materials.slice(0, 10).map(m =>
      `- ${m.title} (${m.type || "materiale"}, ${m.status || "draft"})`
    ).join("\n");

    const verificationsSummary = assignmentResults.slice(0, 5).map((a: any) => {
      const completed = (a.results || []).filter((r: any) => r.status === "completed").length;
      const total = (a.results || []).length;
      return `- ${a.title}: ${completed}/${total} completati`;
    }).join("\n");

    return `CONTESTO CLASSE "${classe.nome}":
Materia: ${classe.materia || "Non specificata"}
Ordine scolastico: ${classe.ordine_scolastico || "Non specificato"}
Studenti totali: ${students.length}
Media classe: ${stats.avg}%
Completamento: ${stats.completion}%
Da seguire: ${stats.toFollow}

STUDENTI E STATO:
${studentsSummary || "Nessuno studente iscritto"}

MATERIALI RECENTI:
${materialsSummary || "Nessun materiale"}

VERIFICHE IN CORSO:
${verificationsSummary || "Nessuna verifica"}`;
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const classContext = buildClassContext();
      const systemPrompt = `Sei il Coach AI di SarAI per la classe "${classe.nome}". Il docente ti chiede aiuto.

${classContext}

REGOLE:
- Rispondi SEMPRE con dati specifici della classe — nomi, numeri, verifiche reali.
- Se ti chiedono chi ha bisogno di attenzione, usa i dati reali degli studenti.
- Max 3-4 frasi per risposta, chiare e operative.
- Tono: collegiale, professionale, concreto.
- MAI risposte generiche. Usa i dati che hai.
- Quando suggerisci azioni, sii specifico (es. "Potresti creare un esercizio di recupero su X per Y e Z").`;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          stream: false,
          maxTokens: 500,
          systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const aiContent = data.choices?.[0]?.message?.content?.trim() || "Mi dispiace, non sono riuscito a rispondere. Riprova.";
      setMessages(prev => [...prev, { role: "assistant", content: aiContent }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Errore nella comunicazione. Riprova." }]);
    }
    setLoading(false);
  }

  const quickActions = [
    "Chi ha bisogno di più attenzione questa settimana?",
    "Suggeriscimi un'attività di recupero per la classe",
    "Come posso aiutare gli studenti in difficoltà?",
  ];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ height: "500px" }}>
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm text-foreground">Coach AI — {classe.nome}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Il coach conosce già la tua classe. Chiedigli quello che vuoi.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Inizia una conversazione</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground animate-pulse">
              Sto pensando...
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi al coach..."
            className="rounded-xl flex-1"
            disabled={loading}
          />
          <Button type="submit" size="sm" className="rounded-xl" disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
