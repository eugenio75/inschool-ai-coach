import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Edit3, FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import OcrGradeModal from "@/components/teacher/OcrGradeModal";
import ManualGradeModal from "@/components/teacher/ManualGradeModal";
import { toast } from "sonner";

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

  const [ocrAssignment, setOcrAssignment] = useState<AssignmentRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAssignment, setManualAssignment] = useState<AssignmentRow | null>(null);

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
      setAssignments((assignData || []) as AssignmentRow[]);

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

  function openOcr(a: AssignmentRow) {
    setOcrAssignment(a);
  }

  function openManual(a?: AssignmentRow) {
    setManualAssignment(a || null);
    setManualOpen(true);
  }

  return (
    <div className="min-h-screen bg-muted/30 relative">
      <BackLink label="alla classe" to={`/classe/${classId}`} />
      <div className="max-w-[880px] mx-auto px-4 sm:px-8 py-3 sm:py-4 pb-24">
        {/* Header */}
        <header className="mb-5 sm:mb-6 rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                Correggi verifica
              </p>
              <h1 className="mt-2 text-[26px] sm:text-[30px] font-bold tracking-tight text-foreground leading-none">
                {classe?.nome || "Classe"}
              </h1>
              {classe?.materia && (
                <p className="mt-2.5 text-[14px] text-muted-foreground">{classe.materia}</p>
              )}
            </div>
            <Button variant="outline" onClick={() => openManual()} className="gap-2">
              <Edit3 className="h-4 w-4" /> Voto rapido
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
            <div className="mb-4">
              <h2 className="text-[18px] sm:text-[20px] font-semibold text-foreground">Scegli la verifica</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Carica le foto degli elaborati per la correzione automatica, oppure inserisci i voti manualmente.
              </p>
            </div>

            {assignments.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border/70 p-6 text-center">
                <FileCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-[14px] text-muted-foreground mb-3">
                  Nessuna verifica assegnata a questa classe.
                </p>
                <Button onClick={() => openManual()} variant="outline" size="sm" className="gap-2">
                  <Edit3 className="h-4 w-4" /> Inserisci voto manuale
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-[18px] border border-border/70 p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-foreground line-clamp-1">{a.title}</p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {[a.type, a.subject, a.assigned_at && new Date(a.assigned_at).toLocaleDateString("it-IT")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManual(a)}
                          className="gap-1.5"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Manuale
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openOcr(a)}
                          className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Carica foto
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modals reused from existing flow */}
      {classe && user && (
        <ManualGradeModal
          open={manualOpen}
          onOpenChange={setManualOpen}
          classId={classe.id}
          userId={user.id}
          students={students}
          assignments={manualAssignment ? [{ id: manualAssignment.id, title: manualAssignment.title }] : assignments.map((a) => ({ id: a.id, title: a.title }))}
          onSaved={() => {
            setManualOpen(false);
            toast.success("Voto salvato");
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
