import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Flame, Mail, Send, PenLine, TrendingUp,
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
  const [activities, setActivities] = useState<any[]>([]);
  const [manualGrades, setManualGrades] = useState<any[]>([]);
  const [signals, setSignals] = useState<string[]>([]);
  const [activeDays, setActiveDays] = useState(0);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [subjectProgress, setSubjectProgress] = useState<Array<{ subject: string; avg: number; count: number }>>([]);

  // Communication dialog
  const [showComm, setShowComm] = useState(false);
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Manual grade modal
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [assignments, setAssignments] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!studentId || !classId || !user) return;
    loadStudentData();
  }, [studentId, classId, user]);

  async function loadStudentData() {
    setLoading(true);
    const profileId = session?.profileId;
    if (!profileId) { navigate("/dashboard"); return; }

    try {
      // Load class info
      const { data: classeData } = await (supabase as any)
        .from("classi").select("nome").eq("id", classId).single();
      setClassName(classeData?.nome || "");

      // Load student profile name from enrollment
      const { data: enrollment } = await (supabase as any)
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .single();

      if (!enrollment) { navigate(`/classe/${classId}`); return; }

      // Get student name from child_profiles
      const { data: profile } = await (supabase as any)
        .from("child_profiles")
        .select("name, last_name")
        .eq("id", studentId)
        .single();

      const name = profile
        ? (profile.last_name ? `${profile.name} ${profile.last_name}` : profile.name)
        : "Studente";
      setStudentName(name);
      const isDemo = /esempio|demo|sample/i.test(name);

      // Load assignment_results directly with joined teacher_assignments
      const { data: results } = await (supabase as any)
        .from("assignment_results")
        .select("*, teacher_assignments!assignment_results_assignment_id_fkey(title, type, subject, due_date, assigned_at)")
        .eq("student_id", studentId)
        .order("completed_at", { ascending: false });

      const activityList: any[] = [];
      const scores: number[] = [];
      const errorsByType: Record<string, number> = {};
      const subjectScores: Record<string, number[]> = {};

      (results || []).forEach((r: any) => {
        const assignment = r.teacher_assignments;
        const subj = assignment?.subject || "";
        activityList.push({
          title: assignment?.title || "Attività",
          type: assignment?.type || "",
          subject: subj,
          due_date: assignment?.due_date,
          assigned_at: assignment?.assigned_at,
          completed_at: r.completed_at,
          score: r.score,
          status: r.status,
          errors_summary: r.errors_summary,
        });
        if (r.score != null) {
          scores.push(r.score);
          if (subj) {
            if (!subjectScores[subj]) subjectScores[subj] = [];
            subjectScores[subj].push(r.score);
          }
        }
        if (r.errors_summary && typeof r.errors_summary === "object") {
          Object.keys(r.errors_summary as Record<string, any>).forEach(k => {
            errorsByType[k] = (errorsByType[k] || 0) + 1;
          });
        }
      });

      setActivities(activityList);

      // Compute per-subject progress
      const progressArr = Object.entries(subjectScores).map(([subject, arr]) => ({
        subject,
        avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
        count: arr.length,
      })).sort((a, b) => b.count - a.count);
      setSubjectProgress(progressArr);

      // Load manual grades
      const { data: grades } = await (supabase as any)
        .from("manual_grades")
        .select("*")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .order("graded_at", { ascending: false });
      setManualGrades(grades || []);

      // Load available assignments for manual grade modal
      const { data: assignmentsList } = await (supabase as any)
        .from("teacher_assignments")
        .select("id, title")
        .eq("class_id", classId)
        .order("assigned_at", { ascending: false });
      setAssignments((assignmentsList || []).map((a: any) => ({ id: a.id, title: a.title })));

      // Compute signals
      const sigs: string[] = [];
      const topErrors = Object.entries(errorsByType).sort(([, a], [, b]) => b - a).slice(0, 5);
      topErrors.forEach(([type, count]) => {
        sigs.push(`Difficoltà su "${type}" (${count} volta${count > 1 ? "e" : ""})`);
      });
      if (scores.length >= 2) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg < 50) sigs.push("Media sotto soglia — potrebbe aver bisogno di supporto aggiuntivo.");
        const recent = scores.slice(-3);
        if (recent.length >= 2 && recent[recent.length - 1] < recent[recent.length - 2] - 15) {
          sigs.push("Calo recente nel rendimento — monitorare le prossime verifiche.");
        }
      }
      const lateCount = activityList.filter(a => a.status !== "completed" && a.due_date && new Date(a.due_date) < new Date()).length;
      if (lateCount >= 2) sigs.push(`${lateCount} attività in ritardo — verificare eventuali difficoltà.`);
      setSignals(sigs);

      // Continuity
      const completedDates = activityList
        .filter(a => a.status === "completed" && a.completed_at)
        .map(a => new Date(a.completed_at).toDateString());
      const uniqueDays = [...new Set(completedDates)];
      setActiveDays(uniqueDays.length);
      if (uniqueDays.length > 0) setLastAccess(uniqueDays[0]); // most recent first

      // Demo seed: if this is a sample student with no data, populate with example data
      if (isDemo && activityList.length === 0 && (grades || []).length === 0 && uniqueDays.length === 0) {
        setSubjectProgress([
          { subject: "Matematica", avg: 78, count: 6 },
          { subject: "Italiano", avg: 85, count: 4 },
          { subject: "Storia", avg: 62, count: 3 },
        ]);
        const today = new Date();
        const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();
        setActivities([
          { title: "Verifica frazioni", type: "verifica", subject: "Matematica", due_date: daysAgo(2), assigned_at: daysAgo(7), completed_at: daysAgo(2), score: 82, status: "completed", errors_summary: {} },
          { title: "Analisi grammaticale", type: "esercizio", subject: "Italiano", due_date: daysAgo(5), assigned_at: daysAgo(10), completed_at: daysAgo(5), score: 88, status: "completed", errors_summary: {} },
          { title: "Risorgimento italiano", type: "studio", subject: "Storia", due_date: daysAgo(1), assigned_at: daysAgo(6), completed_at: null, score: null, status: "in_progress", errors_summary: {} },
        ]);
        setManualGrades([
          { id: "demo-g1", assignment_title: "Compito in classe — Geometria", grade: "7.5", grade_scale: "/10", graded_at: daysAgo(3) },
        ]);
        setActiveDays(5);
        setLastAccess(new Date(today.getTime() - 86400000).toDateString());
        setSignals([
          'Difficoltà su "frazioni equivalenti" (3 volte)',
          "Calo recente in Storia — monitorare le prossime verifiche.",
        ]);
      }
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/classe/${classId}`)} className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-1" /> {className}
            </Button>
            <AvatarInitials name={studentName} size="lg" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{studentName}</h1>
              {className && <Badge variant="secondary" className="text-xs mt-1">{className}</Badge>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowComm(true)}>
            <Mail className="w-3.5 h-3.5 mr-1" /> Scrivi ai genitori
          </Button>
        </div>

        {/* 4-card grid 2x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CARD 1 — PROGRESSI */}
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📊</span>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Progressi</h2>
            </div>
            {subjectProgress.length > 0 ? (
              <div className="space-y-3">
                {subjectProgress.map((p) => (
                  <div key={p.subject}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{p.subject}</span>
                        <span className="text-xs text-muted-foreground">({p.count})</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{p.avg}%</span>
                    </div>
                    <Progress value={p.avg} className="h-1.5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-5xl mb-3 opacity-40">📊</span>
                <p className="text-sm text-muted-foreground">Nessuna sessione ancora</p>
              </div>
            )}
          </div>

          {/* CARD 2 — VERIFICHE */}
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✅</span>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Verifiche</h2>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl text-xs h-7" onClick={() => setShowGradeModal(true)}>
                <PenLine className="w-3 h-3 mr-1" /> Inserisci voto manuale
              </Button>
            </div>
            {activities.length === 0 && manualGrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-5xl mb-3 opacity-40">✅</span>
                <p className="text-sm text-muted-foreground">Nessuna verifica ancora</p>
              </div>
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
                          {a.subject}{a.completed_at ? ` · ${new Date(a.completed_at).toLocaleDateString("it-IT")}` : ""}
                        </p>
                      </div>
                      {belowThreshold && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {score != null && (
                        <span className="text-sm font-semibold text-foreground">{score}%</span>
                      )}
                      <Badge variant={statusVariant} className="text-[10px] shrink-0">{statusLabel}</Badge>
                    </div>
                  );
                })}
                {manualGrades.map((g: any) => (
                  <div key={g.id} className="flex items-center gap-3 p-3 bg-muted/40 border border-border rounded-xl">
                    <span className="text-base shrink-0">📝</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {g.assignment_title || "Voto manuale"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Voto docente · {new Date(g.graded_at).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {g.grade}{g.grade_scale !== "giudizio" ? g.grade_scale : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CARD 3 — CONTINUITÀ */}
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🔥</span>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Continuità</h2>
            </div>
            {activeDays > 0 ? (
              <div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-6 h-6 text-orange-500" />
                    <span className="text-3xl font-bold text-foreground">{activeDays}</span>
                    <span className="text-xs text-muted-foreground">giorni attivi</span>
                  </div>
                  {activeDays >= 3 && (
                    <Badge variant="secondary" className="text-xs">Costante</Badge>
                  )}
                </div>
                {lastAccess && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Ultima sessione: {lastAccess}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-5xl mb-3 opacity-40">🔥</span>
                <p className="text-sm text-muted-foreground">Nessuna sessione registrata</p>
              </div>
            )}
          </div>

          {/* CARD 4 — SEGNALI DA OSSERVARE */}
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🔍</span>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Segnali da osservare</h2>
            </div>
            {signals.length > 0 ? (
              <div>
                <div className="space-y-2">
                  {signals.map((sig, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Prepara recupero", route: `/classe/${classId}?tab=materiali` },
                    { label: "Esercizio differenziato", route: `/classe/${classId}?tab=materiali` },
                    { label: "Materiale semplificato", route: `/classe/${classId}?tab=materiali` },
                  ].map(action => (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.route)}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                <p className="text-sm text-muted-foreground">Nessun segnale da osservare</p>
              </div>
            )}
          </div>
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

      {/* Manual Grade Modal */}
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
