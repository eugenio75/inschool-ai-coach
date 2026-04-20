import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, CheckCircle2, Camera, AlertTriangle } from "lucide-react";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { percentToGrade, type ScaleId } from "./GradeReviewModal";
import { formatName } from "@/lib/formatName";

type Student = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  teacherId: string;
  defaultScale: ScaleId;
  assignment: {
    id: string;
    title: string;
    subject?: string;
    description?: string;
    assigned_at?: string;
    due_date?: string;
    results?: any[];
  };
  students: Student[];
  manualGrades: any[];
  onSaved?: () => void;
}

const SCALE_OPTIONS: { value: ScaleId; label: string }[] = [
  { value: "/10", label: "/10" },
  { value: "/30", label: "/30" },
  { value: "/100", label: "/100" },
  { value: "giudizio", label: "Giudizio" },
];

const GIUDIZIO_OPTIONS = ["Ottimo", "Buono", "Sufficiente", "Insufficiente"];

interface Row {
  studentId: string;
  studentName: string;
  delivered: boolean;
  aiPercent: number | null;       // 0..100 or null
  aiSuggested: string;            // formatted in current scale or "—"
  currentGrade: string;           // editable (pre-filled with confirmed grade or AI suggestion)
  savedGradeId?: string;          // existing manual_grades.id if any
  savedGrade?: string;            // last saved grade text
  saving: boolean;
}

export default function AssignmentDetailModal({
  open, onOpenChange, classId, teacherId, defaultScale,
  assignment, students, manualGrades, onSaved,
}: Props) {
  const [scale, setScale] = useState<ScaleId>(defaultScale);
  const [rows, setRows] = useState<Row[]>([]);
  const [paperUploading, setPaperUploading] = useState(false);
  const [paperProgress, setPaperProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Build rows from students + assignment results + existing grades
  useEffect(() => {
    if (!open) return;
    const results = assignment.results || [];
    const next: Row[] = students.map((s) => {
      const r = results.find((rr: any) =>
        (rr.student_id || rr.id) === s.id ||
        (rr.student_name || "").trim().toLowerCase() === s.name.trim().toLowerCase()
      );
      const delivered = r?.status === "completed";
      const aiPercent = r && r.score != null ? Number(r.score) : null;
      const existing = manualGrades.find(g =>
        g.assignment_id === assignment.id &&
        (g.student_id === s.id || (g.student_name || "").trim().toLowerCase() === s.name.trim().toLowerCase())
      );
      const aiSuggested = aiPercent != null ? percentToGrade(aiPercent, scale) : "—";
      const currentGrade = existing?.grade || (aiPercent != null ? aiSuggested : "");
      return {
        studentId: s.id,
        studentName: s.name,
        delivered,
        aiPercent,
        aiSuggested,
        currentGrade,
        savedGradeId: existing?.id,
        savedGrade: existing?.grade,
        saving: false,
      };
    });
    setRows(next);
  }, [open, assignment.id, students.length, manualGrades.length]);

  // Re-render AI-suggested value & default editable when scale changes (only for unsaved rows)
  useEffect(() => {
    setRows(prev => prev.map(r => {
      const aiSuggested = r.aiPercent != null ? percentToGrade(r.aiPercent, scale) : "—";
      const isSaved = !!r.savedGradeId;
      // only update editable grade if not saved AND user hasn't typed something else than the previous suggestion
      const newGrade = isSaved ? r.currentGrade : (r.aiPercent != null ? aiSuggested : r.currentGrade);
      return { ...r, aiSuggested, currentGrade: newGrade };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const summary = useMemo(() => {
    const total = rows.length;
    const delivered = rows.filter(r => r.delivered).length;
    if (total === 0) return "Nessuno studente in classe.";
    if (delivered === total) return "Tutti hanno consegnato ✅";
    if (delivered === 0) return `Nessuno ha ancora consegnato (${total} studenti).`;
    const missing = total - delivered;
    return `${missing} ${missing === 1 ? "studente non ha" : "studenti non hanno"} ancora consegnato (${delivered}/${total} consegnate).`;
  }, [rows]);

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  async function saveRow(idx: number) {
    const r = rows[idx];
    if (!r.currentGrade.trim()) {
      toast.error("Inserisci un voto prima di salvare.");
      return;
    }
    updateRow(idx, { saving: true });
    const payload: any = {
      teacher_id: teacherId,
      class_id: classId,
      student_id: r.studentId,
      student_name: r.studentName,
      assignment_id: assignment.id,
      assignment_title: assignment.title,
      grade: r.currentGrade.trim(),
      grade_scale: scale,
      ai_proposed_grade: r.aiSuggested !== "—" ? r.aiSuggested : null,
      teacher_confirmed: true,
      source: r.aiPercent != null ? "ai_reviewed" : "manual",
    };
    let error: any = null;
    if (r.savedGradeId) {
      const res = await (supabase as any).from("manual_grades")
        .update(payload).eq("id", r.savedGradeId);
      error = res.error;
    } else {
      const res = await (supabase as any).from("manual_grades").insert(payload).select().single();
      error = res.error;
      if (!error && res.data) updateRow(idx, { savedGradeId: res.data.id });
    }
    updateRow(idx, { saving: false, savedGrade: r.currentGrade.trim() });
    if (error) {
      toast.error("Errore nel salvataggio.");
      console.error(error);
    } else {
      toast.success(`Voto di ${r.studentName} salvato.`);
      onSaved?.();
    }
  }

  async function handlePaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    e.target.value = "";

    setPaperUploading(true);
    setPaperProgress(`Coach AI sta leggendo ${files.length} ${files.length === 1 ? "verifica" : "verifiche"}…`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("assignmentId", assignment.id);
      formData.append("mode", "batch");
      formData.append("studentList", JSON.stringify(students));
      files.forEach(f => formData.append("file", f));

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-grade`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: formData,
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella lettura");
      }
      const data = await res.json();
      const ocrResults: any[] = data.results || [];

      // Apply: for each matched student, fill in the editable grade with AI proposal
      let applied = 0;
      let unmatched = 0;
      setRows(prev => prev.map(row => {
        const m = ocrResults.find(o =>
          o.matched_student?.id === row.studentId ||
          (o.matched_student?.name || "").trim().toLowerCase() === row.studentName.trim().toLowerCase()
        );
        if (!m) return row;
        if (m.error) return row;
        const total = m.total_score || 10;
        const pct = total > 0 ? Math.round(((m.proposed_score || 0) / total) * 100) : 0;
        const aiSuggested = percentToGrade(pct, scale);
        applied++;
        return {
          ...row,
          aiPercent: pct,
          aiSuggested,
          currentGrade: aiSuggested,
        };
      }));
      ocrResults.forEach(o => { if (!o.matched_student) unmatched++; });

      if (applied > 0) {
        toast.success(`${applied} ${applied === 1 ? "verifica letta" : "verifiche lette"}. Controlla i voti proposti e conferma.`);
      }
      if (unmatched > 0) {
        toast.warning(`${unmatched} ${unmatched === 1 ? "verifica non abbinata" : "verifiche non abbinate"} a uno studente.`);
      }
      if (applied === 0 && unmatched === 0) {
        toast.error("Nessun voto è stato proposto.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Errore durante la lettura della verifica.");
    } finally {
      setPaperUploading(false);
      setPaperProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{assignment.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {assignment.subject ? `${assignment.subject} · ` : ""}
            {assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString("it-IT") : ""}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Plain language summary */}
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm text-foreground">{summary}</p>
          </div>

          {/* Scale selector + paper upload */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Scala voti</span>
              <Select value={scale} onValueChange={(v) => setScale(v as ScaleId)}>
                <SelectTrigger className="w-28 h-8 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCALE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs h-8"
              onClick={() => fileRef.current?.click()}
              disabled={paperUploading}
            >
              {paperUploading
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Camera className="w-3.5 h-3.5 mr-1.5" />}
              Carica verifica cartacea
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handlePaperUpload}
            />
          </div>

          {paperUploading && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {paperProgress}
            </div>
          )}

          {/* Student grade rows */}
          <div className="space-y-2">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nessuno studente da valutare.
              </p>
            ) : rows.map((r, i) => {
              const isSaved = !!r.savedGradeId && r.savedGrade === r.currentGrade.trim();
              const placeholder = scale === "/10" ? "es. 7.5"
                : scale === "/30" ? "es. 22"
                : scale === "/100" ? "es. 75"
                : "Giudizio";
              return (
                <div
                  key={r.studentId}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                >
                  <AvatarInitials name={formatName(r.studentName)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{formatName(r.studentName)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.delivered ? "✅ Consegnato" : "🕐 Non ancora consegnato"}
                      {" · "}
                      <span>Voto AI: <span className="text-foreground font-medium">{r.aiSuggested}{scale !== "giudizio" && r.aiSuggested !== "—" ? scale : ""}</span></span>
                    </p>
                  </div>

                  {scale === "giudizio" ? (
                    <Select
                      value={r.currentGrade}
                      onValueChange={(v) => updateRow(i, { currentGrade: v })}
                    >
                      <SelectTrigger className="w-32 h-9 rounded-lg text-xs">
                        <SelectValue placeholder={placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {GIUDIZIO_OPTIONS.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={r.currentGrade}
                      onChange={(e) => updateRow(i, { currentGrade: e.target.value })}
                      placeholder={placeholder}
                      className="w-24 h-9 rounded-lg text-sm"
                    />
                  )}

                  <Button
                    size="sm"
                    className="rounded-lg h-9 text-xs"
                    onClick={() => saveRow(i)}
                    disabled={r.saving || !r.currentGrade.trim()}
                    variant={isSaved ? "outline" : "default"}
                  >
                    {r.saving
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : isSaved
                        ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Salvato</>
                        : "Salva"}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground text-center px-4">
            I voti proposti dal Coach AI sono sempre modificabili. Conferma manualmente prima del salvataggio.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
