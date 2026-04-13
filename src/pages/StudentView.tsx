import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, BarChart2, AlertTriangle, CheckCircle2,
  Flame, Brain, Mail, Send,
} from "lucide-react";
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

async function fetchStudentData(classId: string, studentId: string) {
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
  if (!response.ok) throw new Error("Errore caricamento dati");
  return response.json();
}

export default function StudentView() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [classe, setClasse] = useState<any>(null);
  const [studentName, setStudentName] = useState("Studente");
  const [studentAssignments, setStudentAssignments] = useState<any[]>([]);
  const [studentScores, setStudentScores] = useState<number[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [lastAccess, setLastAccess] = useState<string | null>(null);
  const [signals, setSignals] = useState<string[]>([]);

  // Communication dialog
  const [showComm, setShowComm] = useState(false);
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!studentId || !classId || !user) return;
    verifyAndLoad();
  }, [studentId, classId, user]);

  async function verifyAndLoad() {
    setLoading(true);
    const profileId = session?.profileId;
    if (!profileId) { navigate("/dashboard"); return; }

    try {
      const data = await fetchStudentData(classId!, studentId!);
      if (!data.classe) { navigate("/dashboard"); return; }
      setClasse(data.classe);

      // Find student in enrolled list
      const student = (data.students || []).find((s: any) => (s.student_id || s.id) === studentId);
      if (!student) { navigate(`/classe/${classId}`); return; }
      setAuthorized(true);

      const name = student.profile?.name || student.student_name || "Studente";
      setStudentName(name);

      // Extract student-specific assignment results
      const allResults = data.assignmentResults || [];
      const myAssignments: any[] = [];
      const myScores: number[] = [];
      const errorsByType: Record<string, number> = {};

      allResults.forEach((a: any) => {
        const myResult = (a.results || []).find((r: any) => (r.student_id || r.id) === studentId);
        if (myResult) {
          myAssignments.push({
            title: a.title,
            type: a.type,
            subject: a.subject,
            due_date: a.due_date,
            assigned_at: a.assigned_at,
            score: myResult.score,
            status: myResult.status,
            errors_summary: myResult.errors_summary,
          });
          if (myResult.score != null) myScores.push(myResult.score);

          if (myResult.errors_summary && typeof myResult.errors_summary === "object") {
            Object.keys(myResult.errors_summary).forEach(k => {
              errorsByType[k] = (errorsByType[k] || 0) + 1;
            });
          }
        }
      });

      // If no results found from assignmentResults, try loading directly from DB
      if (myAssignments.length === 0 && studentId) {
        const { data: directResults } = await supabase
          .from("assignment_results")
          .select("*, teacher_assignments!assignment_results_assignment_id_fkey(title, type, subject, due_date, assigned_at)")
          .eq("student_id", studentId);

        if (directResults && directResults.length > 0) {
          directResults.forEach((r: any) => {
            const assignment = r.teacher_assignments;
            myAssignments.push({
              title: assignment?.title || "Attività",
              type: assignment?.type || "",
              subject: assignment?.subject || "",
              due_date: assignment?.due_date,
              assigned_at: assignment?.assigned_at,
              score: r.score,
              status: r.status,
              errors_summary: r.errors_summary,
            });
            if (r.score != null) myScores.push(r.score);

            if (r.errors_summary && typeof r.errors_summary === "object") {
              Object.keys(r.errors_summary as Record<string, any>).forEach(k => {
                errorsByType[k] = (errorsByType[k] || 0) + 1;
              });
            }
          });
        }
      }

      setStudentAssignments(myAssignments);
      setStudentScores(myScores);

      // Compute signals (merged: difficulties + attention signals)
      const sigs: string[] = [];

      // Add error-based signals
      const topErrors = Object.entries(errorsByType).sort(([, a], [, b]) => b - a).slice(0, 5);
      topErrors.forEach(([type, count]) => {
        sigs.push(`Difficoltà su "${type}" (${count} volta${count > 1 ? "e" : ""})`);
      });

      if (myScores.length >= 2) {
        const avg = myScores.reduce((a, b) => a + b, 0) / myScores.length;
        if (avg < 50) sigs.push("Media sotto soglia — potrebbe aver bisogno di supporto aggiuntivo.");
        const recent = myScores.slice(-3);
        if (recent.length >= 2 && recent[recent.length - 1] < recent[recent.length - 2] - 15) {
          sigs.push("Calo recente nel rendimento — monitorare le prossime verifiche.");
        }
      }
      const lateCount = myAssignments.filter(a => a.status !== "completed" && a.due_date && new Date(a.due_date) < new Date()).length;
      if (lateCount >= 2) sigs.push(`${lateCount} attività in ritardo — verificare eventuali difficoltà.`);
      setSignals(sigs);

      // Session count & streak
      setTotalSessions(myAssignments.filter(a => a.status === "completed").length);
      const completedDates = myAssignments
        .filter(a => a.status === "completed")
        .map(a => new Date(a.assigned_at).toDateString());
      const uniqueDays = [...new Set(completedDates)];
      setStreakDays(uniqueDays.length);
      if (uniqueDays.length > 0) {
        setLastAccess(uniqueDays[uniqueDays.length - 1]);
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  const avgScore = studentScores.length > 0
    ? Math.round(studentScores.reduce((a, b) => a + b, 0) / studentScores.length)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/classe/${classId}`)} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> {classe?.nome}
          </Button>
          <div className="flex items-center gap-3">
            <AvatarInitials name={studentName} size="md" />
            <div>
              <h1 className="text-xl font-bold text-foreground">{studentName}</h1>
              {classe && <Badge variant="secondary" className="text-xs mt-0.5">{classe.nome}</Badge>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowComm(true)}>
          <Mail className="w-3.5 h-3.5 mr-1" /> Scrivi ai genitori
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Progressi */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Progressi</p>
          {totalSessions === 0 ? (
            <div className="flex flex-col items-center py-6">
              <BarChart2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna sessione ancora</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{totalSessions}</p>
                  <p className="text-[10px] text-muted-foreground">Sessioni completate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{avgScore != null ? `${avgScore}%` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">Media punteggio</p>
                </div>
              </div>
              {studentScores.length >= 2 && (
                <div className="flex items-center gap-1 mt-2">
                  {studentScores.slice(-6).map((s, i) => (
                    <div key={i} className="flex-1 bg-muted rounded-sm overflow-hidden" style={{ height: "40px" }}>
                      <div
                        className="bg-primary/60 w-full rounded-sm"
                        style={{ height: `${s}%`, marginTop: `${40 - (s * 40 / 100)}px` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Verifiche */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Verifiche</p>
          {studentAssignments.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna verifica ancora</p>
            </div>
          ) : (
            <div className="space-y-2">
              {studentAssignments.slice(0, 5).map((a, i) => {
                let statusLabel = "Non iniziato";
                let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                if (a.status === "completed") { statusLabel = "Completato"; statusVariant = "default"; }
                else if (a.status === "in_progress") { statusLabel = "In corso"; statusVariant = "secondary"; }
                else if (a.due_date && new Date(a.due_date) < new Date()) { statusLabel = "In ritardo"; statusVariant = "destructive"; }
                const belowThreshold = a.score != null && a.score < 50;

                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-foreground truncate flex-1">{a.title}</span>
                    {belowThreshold && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mx-1" />}
                    {a.score != null && <span className="text-xs font-semibold text-foreground mr-2">{Math.round(a.score)}%</span>}
                    <Badge variant={statusVariant} className="text-[10px]">{statusLabel}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Continuità */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Continuità</p>
          {streakDays === 0 ? (
            <div className="flex flex-col items-center py-6">
              <Flame className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna sessione registrata</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold text-foreground">{streakDays}</span>
                  <span className="text-xs text-muted-foreground">giorni attivi</span>
                </div>
                {streakDays >= 3 && (
                  <Badge variant="secondary" className="text-xs">Costante</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {lastAccess ? `Ultimo accesso: ${lastAccess}` : ""}
              </p>
            </>
          )}
        </motion.div>

        {/* Segnali da osservare (merged: difficulties + signals) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Segnali da osservare</p>
          {signals.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-400">Nessun segnale da osservare</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map((sig, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Azioni suggerite — only when there are signals */}
        {signals.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Azioni suggerite</p>
            <div className="flex flex-wrap gap-2">
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
          </motion.div>
        )}
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
    </div>
  );
}
