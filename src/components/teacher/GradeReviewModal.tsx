import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bot, PenLine, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type ScaleId = "/10" | "/30" | "/100" | "giudizio";

const SCALE_OPTIONS: { value: ScaleId; label: string }[] = [
  { value: "/10", label: "/10" },
  { value: "/30", label: "/30" },
  { value: "/100", label: "/100" },
  { value: "giudizio", label: "Giudizio" },
];

const GIUDIZIO_OPTIONS = ["Ottimo", "Buono", "Sufficiente", "Insufficiente"];

interface AnswerDetail {
  question?: string;
  expected?: string;
  given?: string;
  correct?: boolean;
  topic?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  teacherId: string;
  studentId?: string;
  studentName: string;
  assignmentId?: string;
  assignmentTitle: string;
  /** Score 0-100 from AI (assignment_results.score) */
  aiScorePercent?: number | null;
  /** Errors summary from AI */
  errorsSummary?: Record<string, number>;
  /** Optional detailed answers */
  answers?: AnswerDetail[];
  /** Default scale for the class */
  defaultScale?: ScaleId;
  onSaved?: () => void;
}

/** Convert 0–100 score to a grade in the chosen scale. */
function percentToGrade(percent: number, scale: ScaleId): string {
  if (scale === "giudizio") {
    if (percent >= 80) return "Ottimo";
    if (percent >= 65) return "Buono";
    if (percent >= 50) return "Sufficiente";
    return "Insufficiente";
  }
  if (scale === "/30") {
    return Math.round((percent * 30) / 100).toString();
  }
  if (scale === "/100") {
    return Math.round(percent).toString();
  }
  // /10 with 0.5 step
  const v = Math.round((percent * 10) / 100 * 2) / 2;
  return v.toString();
}

export default function GradeReviewModal({
  open, onOpenChange, classId, teacherId, studentId,
  studentName, assignmentId, assignmentTitle,
  aiScorePercent, errorsSummary = {}, answers = [],
  defaultScale = "/10", onSaved,
}: Props) {
  const [scale, setScale] = useState<ScaleId>(defaultScale);
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const aiProposedGrade = useMemo(() => {
    if (aiScorePercent == null) return null;
    return percentToGrade(aiScorePercent, scale);
  }, [aiScorePercent, scale]);

  // Pre-fill grade with AI proposal when modal opens or scale changes
  useEffect(() => {
    if (!open) return;
    if (aiProposedGrade && !grade) {
      setGrade(aiProposedGrade);
    }
  }, [open, aiProposedGrade]);

  // Reset when scale changes (re-pre-fill)
  useEffect(() => {
    if (aiProposedGrade) setGrade(aiProposedGrade);
  }, [scale]);

  function reset() {
    setScale(defaultScale);
    setGrade("");
    setNotes("");
  }

  async function handleSave() {
    if (!grade.trim()) {
      toast.error("Inserisci o conferma il voto.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("manual_grades").insert({
      teacher_id: teacherId,
      class_id: classId,
      student_id: studentId || null,
      student_name: studentName,
      assignment_id: assignmentId || null,
      assignment_title: assignmentTitle || null,
      grade: grade.trim(),
      grade_scale: scale,
      notes: notes.trim() || null,
      ai_proposed_grade: aiProposedGrade,
      teacher_confirmed: true,
      source: aiProposedGrade ? "ai_reviewed" : "manual",
    });
    setSaving(false);
    if (error) {
      console.error("GradeReviewModal save error:", error);
      toast.error("Errore nel salvataggio del voto.");
      return;
    }
    toast.success(
      aiProposedGrade && grade.trim() === aiProposedGrade
        ? "Voto AI confermato!"
        : "Voto aggiornato!"
    );
    onOpenChange(false);
    reset();
    onSaved?.();
  }

  const errorEntries = Object.entries(errorsSummary).sort(([, a], [, b]) => b - a);
  const hasDetails = answers.length > 0 || errorEntries.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            Rivedi e conferma voto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Header: assignment + student */}
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Verifica</p>
            <p className="text-sm font-semibold text-foreground truncate">{assignmentTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">Studente: {studentName}</p>
          </div>

          {/* AI proposal */}
          {aiScorePercent != null && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Voto proposto dall'AI
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {aiProposedGrade}
                  {scale !== "giudizio" && <span className="text-base text-muted-foreground">{scale}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  (basato su {Math.round(aiScorePercent)}% risposte corrette)
                </span>
              </div>
            </div>
          )}

          {/* Detail: errors by topic */}
          {hasDetails && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Dettaglio risposte
              </p>

              {errorEntries.length > 0 && (
                <div className="space-y-1.5">
                  {errorEntries.slice(0, 5).map(([topic, count]) => (
                    <div key={topic} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="flex-1 truncate text-foreground">{topic}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {count} error{count > 1 ? "i" : "e"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {answers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {answers.slice(0, 6).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {a.correct ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        {a.question && <p className="text-foreground truncate">{a.question}</p>}
                        {a.given && (
                          <p className="text-muted-foreground truncate">
                            Risposta: <span className="text-foreground">{a.given}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {answers.length > 6 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      +{answers.length - 6} altre risposte non mostrate
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teacher override */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Voto finale del docente
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Voto</Label>
                {scale === "giudizio" ? (
                  <Select onValueChange={setGrade} value={grade}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="Giudizio..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GIUDIZIO_OPTIONS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder={`es. ${scale === "/10" ? "7.5" : scale === "/30" ? "22" : "75"}`}
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    className="mt-1 rounded-xl"
                  />
                )}
              </div>
              <div>
                <Label className="text-xs">Scala</Label>
                <Select onValueChange={(v) => setScale(v as ScaleId)} value={scale}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCALE_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Note (opzionale)</Label>
              <Textarea
                placeholder="Osservazioni per il registro..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1 rounded-xl min-h-[60px] text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Annulla
          </Button>
          {aiProposedGrade && grade === aiProposedGrade ? (
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {saving ? "Salvataggio..." : "Conferma voto AI"}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !grade.trim()} className="rounded-xl">
              {saving ? "Salvataggio..." : "Salva voto"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { percentToGrade };
export type { ScaleId };
