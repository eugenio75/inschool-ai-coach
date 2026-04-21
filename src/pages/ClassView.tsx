import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ReportTeacherButton } from "@/components/shared/ReportTeacherButton";
import { BackLink } from "@/components/shared/BackLink";
import ClassCoachCard, { type CoachEvidence } from "@/components/teacher/ClassCoachCard";
import QuickActionsGrid, { type QuickAction } from "@/components/teacher/QuickActionsGrid";
import ClassNotificationsCard, { type ClassNotification } from "@/components/teacher/ClassNotificationsCard";
import StudentsListSheet from "@/components/teacher/StudentsListSheet";
import ManualGradeModal from "@/components/teacher/ManualGradeModal";
import OcrGradeModal from "@/components/teacher/OcrGradeModal";
import AssignmentDetailModal from "@/components/teacher/AssignmentDetailModal";
import type { ScaleId } from "@/components/teacher/GradeReviewModal";
import { analyzeClass } from "@/lib/classCoachAnalysis";
import { formatName } from "@/lib/formatName";
import { toast } from "sonner";

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

function getLastActivityMap(assignmentResults: any[], manualGrades: any[], students: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  const nameToSid: Record<string, string> = {};
  students.forEach((s: any) => {
    const sid = s.student_id || s.id;
    const fn = (s.profile?.name || s.student_name || "").trim().toLowerCase();
    if (fn && sid) nameToSid[fn] = sid;
  });

  const apply = (sid: string | undefined | null, date: string | undefined | null) => {
    if (!sid || !date) return;
    if (!map[sid] || new Date(date) > new Date(map[sid])) map[sid] = date;
  };

  assignmentResults.forEach((a: any) => {
    (a.results || []).forEach((r: any) => {
      const date = r.completed_at || r.created_at || a.assigned_at;
      apply(r.student_id || r.id, date);
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

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [assignmentResults, setAssignmentResults] = useState<any[]>([]);
  const [manualGrades, setManualGrades] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [emotionalCheckins, setEmotionalCheckins] = useState<any[]>([]);
  const [emotionalAlerts, setEmotionalAlerts] = useState<any[]>([]);
  const [focusSessions, setFocusSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("");

  // UI state
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [ocrAssignment, setOcrAssignment] = useState<any>(null);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [parentEmailTarget, setParentEmailTarget] = useState<{ studentId: string; studentName: string } | null>(null);
  const [parentEmailSubject, setParentEmailSubject] = useState("");
  const [parentEmailBody, setParentEmailBody] = useState("");

  useEffect(() => {
    if (!classId) return;
    if (!profileId && !user) return;
    loadClass();
    // Load coach name (dynamic — same as the rest of the app)
    (async () => {
      try {
        const { getCoachName } = await import("@/lib/coachPreferences");
        const id = profileId || user?.id;
        if (id) {
          const name = await getCoachName(id, !!profileId);
          if (name) setCoachName(name);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, profileId, user?.id]);

  async function loadClass() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      let loadedStudents: any[] = [];
      let loadedResults: any[] = [];
      let loadedClasse: any = null;

      if (authSession?.access_token) {
        try {
          const data = await fetchTeacherClassData(classId!);
          loadedClasse = data.classe;
          loadedStudents = data.students || [];
          loadedResults = data.assignmentResults || [];
          setEmotionalCheckins(data.emotionalCheckins || []);
          setEmotionalAlerts(data.emotionalAlerts || []);
          setFocusSessions(data.focusSessions || []);
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (/non autorizzato|403|Non sei autorizzato/i.test(msg)) {
            setLoadError("Non hai accesso a questa classe con l'account attuale.");
          } else if (/non trovata|404/i.test(msg)) {
            setLoadError("Questa classe non esiste più.");
          } else {
            setLoadError("Non sono riuscito a caricare la classe. Riprova tra qualche secondo.");
          }
          throw e;
        }

        const { data: grades } = await (supabase as any)
          .from("manual_grades")
          .select("*")
          .eq("class_id", classId)
          .order("graded_at", { ascending: false });
        setManualGrades(grades || []);

        const { data: feedData } = await (supabase as any)
          .from("teacher_activity_feed")
          .select("*")
          .eq("teacher_id", authSession.user.id)
          .eq("class_id", classId)
          .order("created_at", { ascending: false })
          .limit(10);
        setFeed(feedData || []);
      } else {
        const { data: cl } = await (supabase as any)
          .from("classi").select("*").eq("id", classId).single();
        loadedClasse = cl;
        if (!cl) {
          setLoadError("Devi accedere come docente per visualizzare la classe.");
        }
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
        setManualGrades([]);
        setFeed([]);
        setEmotionalCheckins([]);
        setEmotionalAlerts([]);
        setFocusSessions([]);
      }

      // Demo enrichment for sample students
      const demoNameRe = /^\s*studente\s*$|esempio|demo|sample/i;
      const subj = loadedClasse?.materia || "";
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
      const syntheticResults: any[] = [];
      loadedStudents.forEach((s: any) => {
        const sid = s.student_id || s.id;
        const fn = s.profile?.name || s.student_name || "";
        if (!demoNameRe.test(fn)) return;
        const hasReal = loadedResults.some((a: any) =>
          (a.results || []).some((r: any) => (r.student_id || r.id) === sid && r.score != null)
        );
        if (hasReal) return;
        syntheticResults.push({
          id: `demo-followup-${sid}`,
          title: `Verifica di ${subj || "matematica"}`,
          subject: subj || "Matematica",
          assigned_at: fiveDaysAgo,
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
      // toast suppressed: we show inline message in UI
      setStudents([]);
      setAssignmentResults([]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-10 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-[22px]" />
        <Skeleton className="h-32 w-full rounded-[18px]" />
      </div>
    );
  }

  if (!classe) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-10 py-8 text-center space-y-3">
        <p className="text-foreground font-medium">{loadError || "Classe non trovata."}</p>
        {loadError?.toLowerCase().includes("accesso") && (
          <p className="text-sm text-muted-foreground">
            Esci e accedi con l'account docente proprietario di questa classe.
          </p>
        )}
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Torna alla dashboard</Button>
          <Button variant="ghost" onClick={() => loadClass()}>Riprova</Button>
        </div>
      </div>
    );
  }

  // ─── Coach analysis (proactive) ────────────────────────────────
  const lastActivityMap = getLastActivityMap(assignmentResults, manualGrades, students);
  const insight = analyzeClass({
    students,
    assignmentResults,
    manualGrades,
    classSubject: classe.materia || "",
    lastActivityMap,
    emotionalCheckins,
    emotionalAlerts,
    focusSessions,
  });

  // ─── Map evidence actions to handlers ──────────────────────────
  function handleEvidenceAction(ev: typeof insight.evidences[number]) {
    switch (ev.actionType) {
      case "recovery":
        navigate(`/materiali-docente?classId=${classId}&tipo=recupero&materia=${encodeURIComponent(ev.targetSubject || classe.materia || "")}&argomento=${encodeURIComponent(ev.targetTopic || "")}`);
        break;
      case "alternative":
        navigate(`/materiali-docente?classId=${classId}&tipo=lezione&materia=${encodeURIComponent(ev.targetSubject || classe.materia || "")}&argomento=${encodeURIComponent(ev.targetTopic || "")}`);
        break;
      case "create":
        navigate(`/classe/${classId}/materiali?create=true${ev.targetTopic ? `&argomento=${encodeURIComponent(ev.targetTopic)}` : ""}`);
        break;
      case "trend":
        if (ev.targetStudentId) {
          navigate(`/studente/${ev.targetStudentId}?classId=${classId}`);
        } else {
          setStudentsOpen(true);
        }
        break;
      case "contact":
        if (ev.targetStudentId && ev.targetStudentName) {
          setParentEmailTarget({ studentId: ev.targetStudentId, studentName: ev.targetStudentName });
          setParentEmailSubject(`Aggiornamento su ${ev.targetStudentName}`);
          setParentEmailBody(
            `Buongiorno,\n\nle scrivo a proposito di ${ev.targetStudentName}: vorrei condividere con voi alcune osservazioni recenti e proporre un breve confronto per allineare il sostegno a casa.\n\nCordiali saluti.`,
          );
        }
        break;
      case "checkin":
        setStudentsOpen(true);
        break;
    }
  }

  const evidences: CoachEvidence[] = insight.evidences.map((ev) => ({
    id: ev.id,
    text: ev.text,
    actionLabel: ev.actionLabel,
    onAction: () => handleEvidenceAction(ev),
  }));

  // ─── Coach input → /coach-docente with class context ───────────
  async function handleCoachAsk(question: string) {
    if (!user) {
      toast.error("Funzione disponibile solo per docenti");
      return;
    }
    try {
      // Find or create a class-scoped chat
      const { data: existing } = await (supabase as any)
        .from("teacher_chats")
        .select("id")
        .eq("teacher_id", user.id)
        .eq("class_id", classId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let chatId = existing?.id;
      if (!chatId) {
        const { data: created, error } = await (supabase as any)
          .from("teacher_chats")
          .insert({ teacher_id: user.id, class_id: classId, name: classe.nome })
          .select("id")
          .single();
        if (error) throw error;
        chatId = created.id;
      }

      navigate(`/coach-docente?chat=${chatId}&q=${encodeURIComponent(question)}`);
    } catch (err) {
      console.error("handleCoachAsk error:", err);
      toast.error("Non sono riuscito ad aprire la chat con il coach.");
    }
  }

  // ─── Quick actions ─────────────────────────────────────────────
  const quickActions: QuickAction[] = [
    {
      id: "create",
      icon: "create",
      label: "Crea compito",
      sublabel: "AI o manuale",
      onClick: () => navigate(`/classe/${classId}/materiali?create=true`),
    },
    {
      id: "grade",
      icon: "grade",
      label: "Correggi verifica",
      sublabel: "Carica o inserisci voto",
      onClick: () => navigate(`/classe/${classId}/correggi`),
    },
    {
      id: "students",
      icon: "students",
      label: "Studenti",
      sublabel: "Vedi tutti i partecipanti alla classe",
      onClick: () => setStudentsOpen(true),
    },
    {
      id: "library",
      icon: "library",
      label: "Materiali",
      sublabel: "Solo di questa classe",
      onClick: () => navigate(`/classe/${classId}/materiali`),
    },
  ];

  // ─── Notifications ─────────────────────────────────────────────
  const notifications: ClassNotification[] = [];
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;

  // From teacher_activity_feed
  feed.slice(0, 4).forEach((n: any) => {
    const isUrgent = n.severity === "urgent" || n.type === "urgent";
    const isWarn = n.severity === "warning" || n.type === "warning" || n.type === "wellbeing";
    const isPositive = n.type === "positive";
    const level: ClassNotification["level"] = isUrgent ? "urgent" : isWarn ? "attention" : isPositive ? "completed" : "info";
    notifications.push({
      id: n.id,
      level,
      title: n.message,
      subtitle: n.action_label || timeAgo(n.created_at),
      badgeLabel: level === "urgent" ? "Urgente" : level === "attention" ? "Attenzione" : level === "completed" ? "Positivo" : "Info",
      onClick: () => {
        if (n.action_route) navigate(n.action_route);
      },
    });
  });

  // Aggregated assignment status
  let pendingCount = 0;
  let completedAllCount = 0;
  assignmentResults.forEach((a: any) => {
    const results = a.results || [];
    const completed = results.filter((r: any) => r.status === "completed").length;
    const total = students.length || results.length;
    if (total > 0 && completed === total) completedAllCount++;
    else {
      const ageMs = now - new Date(a.assigned_at || 0).getTime();
      if (ageMs > SEVEN_DAYS && completed < total) pendingCount++;
    }
  });

  if (pendingCount > 0) {
    notifications.push({
      id: "agg-pending",
      level: "urgent",
      title: `${pendingCount} ${pendingCount === 1 ? "attività non consegnata" : "attività non consegnate"}`,
      subtitle: "Da più di una settimana",
      badgeLabel: "In ritardo",
      onClick: () => {
        const stale = assignmentResults.find((a: any) => {
          const r = a.results || [];
          const completed = r.filter((x: any) => x.status === "completed").length;
          const total = students.length || r.length;
          return total > 0 && completed < total && now - new Date(a.assigned_at || 0).getTime() > SEVEN_DAYS;
        });
        if (stale) setActiveAssignment(stale);
      },
    });
  }

  if (completedAllCount > 0 && notifications.length < 5) {
    notifications.push({
      id: "agg-completed",
      level: "completed",
      title: `${completedAllCount} ${completedAllCount === 1 ? "attività completata" : "attività completate"} da tutti`,
      subtitle: "Bel lavoro della classe",
      badgeLabel: "Fatto",
      onClick: () => {
        const done = assignmentResults.find((a: any) => {
          const r = a.results || [];
          const completed = r.filter((x: any) => x.status === "completed").length;
          const total = students.length || r.length;
          return total > 0 && completed === total;
        });
        if (done) setActiveAssignment(done);
      },
    });
  }

  // Students for sheet + modals
  const studentList = students.map((s: any) => {
    const firstName = formatName(s.profile?.name || s.student_name || "Studente");
    const lastName = formatName(s.profile?.last_name || "");
    return { id: s.student_id || s.id, name: lastName ? `${firstName} ${lastName}` : firstName };
  });
  const assignmentList = assignmentResults.map((a: any) => ({ id: a.id, title: a.title }));
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

  // For students sheet
  const studentsForSheet = students.map((s: any) => {
    const firstName = formatName(s.profile?.name || s.student_name || "Studente");
    const lastName = formatName(s.profile?.last_name || "");
    const sid = s.student_id || s.id;
    const last = lastActivityMap[sid];
    const lastLabel = last
      ? new Date(last).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
      : undefined;
    // Detect "needs follow" via low score average
    const allScores: number[] = [];
    assignmentResults.forEach((a: any) => {
      (a.results || []).forEach((r: any) => {
        if ((r.student_id || r.id) === sid && r.score != null) allScores.push(r.score);
      });
    });
    const mean = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
    return {
      id: sid,
      name: lastName ? `${firstName} ${lastName}` : firstName,
      lastActivity: lastLabel,
      needsFollow: mean != null && mean < 60,
    };
  });

  const schoolType = classe.ordine_scolastico || classe.school_name || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-muted/20 relative">
      <BackLink label="alla home" to="/dashboard" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24">
        {/* ─── Header card ─── */}
        <header className="rounded-[32px] border border-border/60 bg-card/95 backdrop-blur p-6 sm:p-7 shadow-[0_10px_30px_-15px_hsl(var(--foreground)/0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 mb-2">
                Classe
              </p>
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_0_5px_hsl(45_93%_58%/0.18)]" />
                <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none">
                  {classe.nome}
                </h1>
              </div>
              <p className="mt-3 text-[16px] font-normal text-muted-foreground">
                {[classe.materia, `${students.length} ${students.length === 1 ? "studente" : "studenti"}`, schoolType]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}
              className="self-start shrink-0 inline-flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2 text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              title="Copia codice classe"
            >
              <span className="font-mono font-semibold tracking-[0.18em] text-foreground">{classe.codice_invito}</span>
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {profileId && !user && (
            <ReportTeacherButton teacherId={classe.docente_profile_id} className="mt-3" />
          )}
        </header>

        {/* ─── Sections ─── */}
        <div className="mt-6 space-y-7">
        {/* SECTION 1: Coach SarAI */}
        <ClassCoachCard
          headline={insight.headline}
          paragraph={insight.paragraph}
          evidences={evidences}
          onAsk={handleCoachAsk}
          coachName={coachName}
          onShowFullPicture={() => navigate(`/classe/${classId}/quadro`)}
        />

        {/* SECTION 2: Azioni rapide */}
        <QuickActionsGrid actions={quickActions} />

        {/* SECTION 3: Notifiche */}
        <ClassNotificationsCard notifications={notifications} />
        </div>
      </div>

      {/* Modals & sheets */}
      <StudentsListSheet
        open={studentsOpen}
        onOpenChange={setStudentsOpen}
        classId={classId!}
        students={studentsForSheet}
      />

      {user && (
        <ManualGradeModal
          open={showGradeModal}
          onOpenChange={setShowGradeModal}
          classId={classId!}
          userId={user.id}
          students={studentList}
          assignments={assignmentList}
          onSaved={loadClass}
        />
      )}

      {ocrAssignment && user && (
        <OcrGradeModal
          open={!!ocrAssignment}
          onOpenChange={(open) => { if (!open) setOcrAssignment(null); }}
          classId={classId!}
          userId={user.id}
          assignment={ocrAssignment}
          students={studentList}
          onSaved={loadClass}
        />
      )}

      {activeAssignment && user && (
        <AssignmentDetailModal
          open={!!activeAssignment}
          onOpenChange={(open) => { if (!open) setActiveAssignment(null); }}
          classId={classId!}
          teacherId={user.id}
          defaultScale={classScale}
          assignment={activeAssignment}
          students={studentList}
          manualGrades={manualGrades}
          onSaved={loadClass}
        />
      )}

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

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Ora";
  if (min < 60) return `${min}min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Ieri" : `${d}g fa`;
}
