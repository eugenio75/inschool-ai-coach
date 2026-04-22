import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bot, CheckCircle2, Edit3, Loader2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/BackLink";

interface AssignmentInfo {
  id: string;
  title: string;
  subject: string | null;
  class_id: string;
}
interface ClassInfo { id: string; nome: string; materia: string | null }
interface StudentMap { [id: string]: { name: string } }

interface RowState {
  resultId: string;
  studentId: string;
  studentName: string;
  aiScore: number | null; // /10
  finalScore: string;     // editable
  status: "pending" | "confirmed" | "modified";
  saving: boolean;
  editing: boolean;
}

export default function AssignmentReview() {
  const { classId, assignmentId } = useParams<{ classId: string; assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [classe, setClasse] = useState<ClassInfo | null>(null);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    if (!classId || !assignmentId || !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, assignmentId, user]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from("classi").select("id, nome, materia").eq("id", classId!).maybeSingle(),
        supabase.from("teacher_assignments").select("id, title, subject, class_id")
          .eq("id", assignmentId!).maybeSingle(),
      ]);
      if (!c || !a) {
        toast.error("Dati non trovati");
        navigate(`/classe/${classId}/correggi`);
        return;
      }
      setClasse(c as ClassInfo);
      setAssignment(a as AssignmentInfo);

      // Roster
      const { data: enrollments } = await supabase
        .from("class_enrollments")
        .select("student_id, status")
        .eq("class_id", classId!)
        .eq("status", "active");
      const studentIds = (enrollments || []).map((e: any) => e.student_id);
      const studentMap: StudentMap = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("child_profiles")
          .select("id, name, last_name")
          .in("id", studentIds);
        for (const p of profiles || []) {
          const full = [(p as any).name, (p as any).last_name].filter(Boolean).join(" ").trim();
          studentMap[(p as any).id] = { name: full || (p as any).name };
        }
      }

      // SarAI results
      const { data: results } = await supabase
        .from("assignment_results")
        .select("id, student_id, score, status")
        .eq("assignment_id", assignmentId!)
        .eq("status", "completed");

      // Existing manual confirmations (so we know which are already confirmed/modified)
      const { data: existing } = await supabase
        .from("manual_grades")
        .select("student_id, grade, ai_proposed_grade, source")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId!)
        .eq("assignment_id", assignmentId!);

      const existingByStudent = new Map<string, any>();
      for (const g of existing || []) {
        if ((g as any).student_id) existingByStudent.set((g as any).student_id, g);
      }

      const built: RowState[] = (results || []).map((r: any) => {
        const sid = r.student_id as string;
        const aiScore = typeof r.score === "number" ? r.score : null;
        const prev = existingByStudent.get(sid);
        let status: RowState["status"] = "pending";
        let finalScore = aiScore != null ? aiScore.toFixed(1).replace(/\.0$/, "") : "";
        if (prev) {
          finalScore = String(prev.grade ?? finalScore);
          const ai = prev.ai_proposed_grade != null ? String(prev.ai_proposed_grade) : null;
          status = ai && ai !== String(prev.grade) ? "modified" : "confirmed";
        }
        return {
          resultId: r.id,
          studentId: sid,
          studentName: studentMap[sid]?.name || "Studente",
          aiScore,
          finalScore,
          status,
          saving: false,
          editing: false,
        };
      });
      // Sort: pending first, then by name
      built.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return a.studentName.localeCompare(b.studentName, "it");
      });
      setRows(built);
    } catch (err) {
      console.error("AssignmentReview.load", err);
      toast.error("Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const confirmed = rows.filter(r => r.status === "confirmed").length;
    const modified = rows.filter(r => r.status === "modified").length;
    const pending = rows.filter(r => r.status === "pending").length;
    return { total, confirmed, modified, pending };
  }, [rows]);

  function setRowField(id: string, patch: Partial<RowState>) {
    setRows(prev => prev.map(r => r.resultId === id ? { ...r, ...patch } : r));
  }

  async function persistRow(row: RowState): Promise<boolean> {
    if (!assignment || !classe || !user) return false;
    if (!row.finalScore.trim()) {
      toast.error(`Inserisci un voto per ${row.studentName}`);
      return false;
    }
    const ai = row.aiScore != null ? String(row.aiScore) : null;
    const isModified = ai != null && ai !== row.finalScore.trim();
    const payload = {
      teacher_id: user.id,
      class_id: classe.id,
      student_id: row.studentId,
      student_name: row.studentName,
      assignment_id: assignment.id,
      assignment_title: assignment.title,
      grade: row.finalScore.trim(),
      grade_scale: "/10",
      ai_proposed_grade: ai,
      teacher_confirmed: true,
      source: isModified ? "ai_modified" : "ai_confirmed",
    };
    // Upsert by deleting prior row for same teacher/class/assignment/student
    await (supabase as any)
      .from("manual_grades")
      .delete()
      .eq("teacher_id", user.id)
      .eq("class_id", classe.id)
      .eq("assignment_id", assignment.id)
      .eq("student_id", row.studentId);
    const { error } = await (supabase as any).from("manual_grades").insert(payload);
    if (error) {
      console.error("persistRow error", error);
      toast.error(`Errore salvando ${row.studentName}`);
      return false;
    }
    setRowField(row.resultId, {
      status: isModified ? "modified" : "confirmed",
      editing: false,
    });
    return true;
  }

  async function handleConfirmRow(row: RowState) {
    setRowField(row.resultId, { saving: true });
    const ok = await persistRow(row);
    setRowField(row.resultId, { saving: false });
    if (ok) toast.success(`Voto salvato — ${row.studentName}`);
  }

  async function handleConfirmAll() {
    const targets = rows.filter(r => r.status === "pending" && r.finalScore.trim());
    if (targets.length === 0) {
      toast.info("Nessun voto da confermare");
      return;
    }
    setBulkSaving(true);
    let ok = 0;
    for (const r of targets) {
      // eslint-disable-next-line no-await-in-loop
      const success = await persistRow(r);
      if (success) ok++;
    }
    setBulkSaving(false);
    toast.success(`${ok} voti confermati`);
  }

  return (
    <div className="min-h-screen bg-muted/30 relative">
      <BackLink label="alla correzione" to={`/classe/${classId}/correggi`} />
      <div className="max-w-[920px] mx-auto px-4 sm:px-8 py-3 sm:py-4 pb-28">
        {/* Header */}
        <header className="mb-5 sm:mb-6 rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Risultati SarAI · {classe?.nome || "Classe"}
            </p>
            <h1 className="mt-2 text-[26px] sm:text-[30px] font-extrabold tracking-tight text-foreground leading-tight">
              {assignment?.title || "Verifica"}
            </h1>
            {assignment?.subject && (
              <p className="mt-2 text-[15px] text-muted-foreground">{assignment.subject}</p>
            )}
            {!loading && rows.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 font-medium text-foreground">
                  <Bot className="h-3.5 w-3.5" /> {stats.total} consegne SarAI
                </span>
                {stats.pending > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-3 py-1 font-medium">
                    🕐 {stats.pending} in attesa
                  </span>
                )}
                {stats.confirmed > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 px-3 py-1 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {stats.confirmed} confermati
                  </span>
                )}
                {stats.modified > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 px-3 py-1 font-medium">
                    <Pencil className="h-3.5 w-3.5" /> {stats.modified} modificati
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-card p-8 text-center">
            <p className="text-[16px] text-muted-foreground">
              Nessuno studente ha ancora completato questa verifica su SarAI.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => navigate(`/classe/${classId}/correggi`)}
            >
              Torna alla correzione
            </Button>
          </div>
        ) : (
          <section className="rounded-[24px] border border-border/60 bg-card p-3 sm:p-5">
            <div className="space-y-2">
              {rows.map(r => {
                const aiLabel = r.aiScore != null ? `${r.aiScore.toFixed(1).replace(/\.0$/, "")}/10` : "—";
                const statusBadge =
                  r.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confermato
                    </span>
                  ) : r.status === "modified" ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-sky-700 dark:text-sky-300">
                      <Pencil className="h-3.5 w-3.5" /> Modificato
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                      🕐 In attesa
                    </span>
                  );

                return (
                  <div
                    key={r.resultId}
                    className="rounded-[16px] border border-border/60 bg-background/60 p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-semibold text-foreground truncate">
                          {r.studentName}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[13px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Bot className="h-3.5 w-3.5" /> SarAI: {aiLabel}
                          </span>
                          {statusBadge}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {r.editing || r.status === "pending" ? (
                          <Input
                            value={r.finalScore}
                            onChange={e => setRowField(r.resultId, { finalScore: e.target.value })}
                            placeholder="Voto"
                            className="h-9 w-[88px] rounded-lg text-center font-semibold"
                          />
                        ) : (
                          <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[15px] font-semibold tabular-nums">
                            {r.finalScore || "—"}{r.finalScore ? "/10" : ""}
                          </span>
                        )}

                        {r.status === "pending" ? (
                          <Button
                            size="sm"
                            disabled={r.saving}
                            onClick={() => handleConfirmRow(r)}
                            className="rounded-lg bg-foreground text-background hover:bg-foreground/90"
                          >
                            {r.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Conferma"}
                          </Button>
                        ) : r.editing ? (
                          <>
                            <Button
                              size="sm"
                              disabled={r.saving}
                              onClick={() => handleConfirmRow(r)}
                              className="rounded-lg bg-foreground text-background hover:bg-foreground/90 gap-1"
                            >
                              {r.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5" /> Salva</>}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRowField(r.resultId, { editing: false })}
                              className="rounded-lg"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRowField(r.resultId, { editing: true })}
                            className="rounded-lg gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Modifica
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {stats.pending > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleConfirmAll}
                  disabled={bulkSaving}
                  className="rounded-xl bg-foreground text-background hover:bg-foreground/90 gap-2"
                >
                  {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Conferma tutti ({stats.pending})
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
