import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Edit3, FileText, Mic, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import OcrGradeModal from "@/components/teacher/OcrGradeModal";
import ManualGradeModal from "@/components/teacher/ManualGradeModal";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/BackLink";

interface ClassInfo {
  id: string;
  nome: string;
  materia: string | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  assigned_at: string | null;
  type: string | null;
  // computed
  online_completed: number; // # students who submitted via InSchool
}

interface StudentRow {
  id: string;
  name: string;
}

export default function ClassGrading() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classe, setClasse] = useState<ClassInfo | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  // Choice dialog state (per assignment)
  const [chooserAssignment, setChooserAssignment] = useState<AssignmentRow | null>(null);

  // Active modals
  const [ocrAssignment, setOcrAssignment] = useState<AssignmentRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAssignment, setManualAssignment] = useState<AssignmentRow | null>(null);
  const [oralOpen, setOralOpen] = useState(false);

  useEffect(() => {
    if (!classId || !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, user]);

  async function load() {
    setLoading(true);
    try {
      const { data: c } = await supabase
        .from("classi")
        .select("id, nome, materia")
        .eq("id", classId!)
        .maybeSingle();
      if (!c) {
        toast.error("Classe non trovata");
        navigate("/dashboard");
        return;
      }
      setClasse(c as ClassInfo);

      const { data: assignData } = await supabase
        .from("teacher_assignments")
        .select("id, title, subject, description, assigned_at, type")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId!)
        .order("assigned_at", { ascending: false });

      const baseAssignments = (assignData || []) as Omit<AssignmentRow, "online_completed">[];

      // Fetch online completion counts per assignment
      const assignmentIds = baseAssignments.map((a) => a.id);
      let onlineMap = new Map<string, number>();
      if (assignmentIds.length > 0) {
        const { data: results } = await supabase
          .from("assignment_results")
          .select("assignment_id, status")
          .in("assignment_id", assignmentIds)
          .eq("status", "completed");
        for (const r of results || []) {
          const k = (r as any).assignment_id as string;
          onlineMap.set(k, (onlineMap.get(k) || 0) + 1);
        }
      }

      setAssignments(
        baseAssignments.map((a) => ({
          ...a,
          online_completed: onlineMap.get(a.id) || 0,
        })),
      );

      // Roster
      const { data: enrollments } = await supabase
        .from("class_enrollments")
        .select("student_id, status")
        .eq("class_id", classId!)
        .eq("status", "active");

      const ids = (enrollments || []).map((e: any) => e.student_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("child_profiles")
          .select("id, name, last_name")
          .in("id", ids);
        setStudents(
          (profiles || []).map((p: any) => ({
            id: p.id,
            name: [p.name, p.last_name].filter(Boolean).join(" ").trim() || p.name,
          })),
        );
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error("ClassGrading.load", err);
      toast.error("Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }

  function handleCorreggi(a: AssignmentRow) {
    // If online completions exist → go directly to manual review (showing AI scores would happen in OcrGradeModal in future)
    // For now: open chooser to let teacher decide. If pure online, suggest the manual review path.
    setChooserAssignment(a);
  }

  function pickPhoto() {
    if (!chooserAssignment) return;
    setOcrAssignment(chooserAssignment);
    setChooserAssignment(null);
  }

  function pickManual() {
    if (!chooserAssignment) return;
    setManualAssignment(chooserAssignment);
    setManualOpen(true);
    setChooserAssignment(null);
  }

  return (
    <div className="min-h-screen bg-muted/30 relative">
      <BackLink label="alla classe" to={`/classe/${classId}`} />
      <div className="max-w-[880px] mx-auto px-4 sm:px-8 py-3 sm:py-4 pb-24">
        {/* Header */}
        <header className="mb-5 sm:mb-6 rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Correggi
            </p>
            <h1 className="mt-2 text-[28px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-none">
              {classe?.nome || "Classe"}
            </h1>
            {classe?.materia && (
              <p className="mt-3 text-[16px] text-muted-foreground">{classe.materia}</p>
            )}
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-6">
            {/* SECTION 1 — Verifiche scritte */}
            <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-xl bg-foreground/5 p-2.5">
                  <FileText className="h-5 w-5 text-foreground/70" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground">
                    Verifiche scritte
                  </h2>
                  <p className="text-[15px] text-muted-foreground mt-1">
                    Correggi le verifiche assegnate alla classe — su carta o consegnate online.
                  </p>
                </div>
              </div>

              {assignments.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-border/70 p-6 text-center">
                  <p className="text-[16px] text-muted-foreground">
                    Nessuna verifica assegnata a questa classe.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {assignments.map((a) => {
                    const isOnline = a.online_completed > 0;
                    return (
                      <div
                        key={a.id}
                        className="rounded-[18px] border border-border/70 p-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[17px] font-semibold text-foreground">{a.title}</p>
                              {isOnline && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Online · {a.online_completed} consegne
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-[14px] text-muted-foreground">
                              {[a.type, a.subject, a.assigned_at && new Date(a.assigned_at).toLocaleDateString("it-IT")]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCorreggi(a)}
                            className="gap-1.5 bg-foreground text-background hover:bg-foreground/90 shrink-0"
                          >
                            Correggi
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECTION 2 — Interrogazioni orali */}
            <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-xl bg-foreground/5 p-2.5">
                  <Mic className="h-5 w-5 text-foreground/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground">
                    Interrogazioni orali
                  </h2>
                  <p className="text-[15px] text-muted-foreground mt-1">
                    Inserisci voti per interrogazioni, esposizioni o verifiche orali.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setOralOpen(true)}
                variant="outline"
                className="w-full sm:w-auto gap-2 h-11 text-[15px] font-semibold"
              >
                <Edit3 className="h-4 w-4" />
                Nuova interrogazione
              </Button>
            </section>
          </div>
        )}
      </div>

      {/* Chooser dialog: photo vs manual */}
      <Dialog open={!!chooserAssignment} onOpenChange={(o) => { if (!o) setChooserAssignment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-bold">
              Come vuoi correggere?
            </DialogTitle>
            <DialogDescription className="text-[15px]">
              {chooserAssignment?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 mt-2">
            <button
              onClick={pickPhoto}
              className="w-full text-left rounded-[18px] border border-border/70 hover:border-foreground/40 hover:bg-muted/40 transition-colors p-4 flex items-start gap-3"
            >
              <div className="rounded-xl bg-foreground/5 p-2.5 shrink-0">
                <Camera className="h-5 w-5 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-foreground">Carica foto degli elaborati</p>
                <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                  L'AI legge i fogli, riconosce i nomi e propone un voto. Tu confermi o modifichi.
                </p>
              </div>
            </button>

            <button
              onClick={pickManual}
              className="w-full text-left rounded-[18px] border border-border/70 hover:border-foreground/40 hover:bg-muted/40 transition-colors p-4 flex items-start gap-3"
            >
              <div className="rounded-xl bg-foreground/5 p-2.5 shrink-0">
                <Edit3 className="h-5 w-5 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-foreground">Inserisci i voti a mano</p>
                <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                  Tabella con tutti gli studenti. Utile per verifiche online o quando preferisci scrivere tu i voti.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals reused from existing flow */}
      {classe && user && (
        <ManualGradeModal
          open={manualOpen}
          onOpenChange={setManualOpen}
          classId={classe.id}
          userId={user.id}
          students={students}
          assignments={manualAssignment ? [{ id: manualAssignment.id, title: manualAssignment.title }] : assignments.map((a) => ({ id: a.id, title: a.title }))}
          defaultAssignmentId={manualAssignment?.id}
          defaultAssignmentTitle={manualAssignment?.title}
          onSaved={() => {
            setManualOpen(false);
            toast.success("Voto salvato");
          }}
        />
      )}

      {/* Oral exam modal — manual grade without assignment */}
      {classe && user && (
        <ManualGradeModal
          open={oralOpen}
          onOpenChange={setOralOpen}
          classId={classe.id}
          userId={user.id}
          students={students}
          assignments={[]}
          onSaved={() => {
            setOralOpen(false);
            toast.success("Voto orale salvato");
          }}
        />
      )}

      {ocrAssignment && classe && user && (
        <OcrGradeModal
          open={!!ocrAssignment}
          onOpenChange={(open) => { if (!open) setOcrAssignment(null); }}
          classId={classe.id}
          userId={user.id}
          assignment={ocrAssignment}
          students={students}
          onSaved={() => {
            setOcrAssignment(null);
            toast.success("Correzione salvata");
          }}
        />
      )}
    </div>
  );
}
