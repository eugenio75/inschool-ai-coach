import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, BarChart2, AlertTriangle, CheckCircle2,
  Flame, Brain, Mail, MessageSquare,
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
  const [assignments, setAssignments] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

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
    // Verify teacher owns the class
    const profileId = session?.profileId;
    if (!profileId) { navigate("/dashboard"); return; }

    const { data: cl } = await (supabase as any)
      .from("classi").select("*").eq("id", classId)
      .eq("docente_profile_id", profileId).maybeSingle();

    if (!cl) { navigate("/dashboard"); return; }
    setClasse(cl);

    // Verify student is enrolled
    const { data: enr } = await (supabase as any)
      .from("class_enrollments").select("id").eq("class_id", classId)
      .eq("student_id", studentId).maybeSingle();

    if (!enr) { navigate(`/classe/${classId}`); return; }
    setAuthorized(true);

    // Load student data
    const { data: ta } = await (supabase as any)
      .from("teacher_assignments").select("*")
      .eq("class_id", classId).order("assigned_at", { ascending: false }).limit(10);
    setAssignments(ta || []);

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/classe/${classId}`)} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> {classe?.nome}
          </Button>
          <div className="flex items-center gap-3">
            <AvatarInitials name="Studente" size="md" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Studente</h1>
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
          <div className="flex flex-col items-center py-6">
            <BarChart2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nessuna sessione ancora</p>
          </div>
        </motion.div>

        {/* Verifiche */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Verifiche</p>
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna verifica ancora</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground truncate">{a.title}</span>
                  <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Difficoltà */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Difficoltà rilevate</p>
          <div className="flex flex-col items-center py-6">
            <Brain className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nessuna difficoltà rilevata</p>
          </div>
        </motion.div>

        {/* Continuità */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Continuità</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-2xl font-bold text-foreground">0</span>
              <span className="text-xs text-muted-foreground">giorni</span>
            </div>
            <Badge variant="secondary" className="text-xs">In sviluppo</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Nessuna sessione registrata</p>
        </motion.div>

        {/* Segnali di fatica */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Segnali da osservare</p>
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">Nessun segnale da osservare</p>
            </div>
          </div>
        </motion.div>

        {/* Azioni suggerite */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Azioni suggerite</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Prepara recupero", route: `/classe/${classId}` },
              { label: "Esercizio differenziato", route: `/classe/${classId}` },
              { label: "Materiale semplificato", route: `/classe/${classId}` },
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
      </div>

      {/* Communication Dialog */}
      <Dialog open={showComm} onOpenChange={setShowComm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Scrivi ai genitori</DialogTitle>
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
              Stai per inviare un messaggio privato ai genitori di questo studente.
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
