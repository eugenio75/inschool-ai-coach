import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, Edit3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  userId: string;
  assignment: { id: string; title: string; subject?: string; description?: string };
  students: Array<{ id: string; name: string }>;
  onSaved?: () => void;
}

type CorrectionItem = {
  question: string;
  answer: string;
  result: "corretto" | "parzialmente_corretto" | "sbagliato";
  explanation: string;
};

type GradeResult = {
  ocr_text: string;
  corrections: CorrectionItem[];
  proposed_score: number;
  total_score: number;
  errors: string[];
  summary: string;
};

type Step = "upload" | "processing" | "review";

export default function OcrGradeModal({
  open, onOpenChange, classId, userId, assignment, students, onSaved,
}: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [finalScore, setFinalScore] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleStudentSelect(val: string) {
    const s = students.find(s => s.id === val);
    setStudentId(val);
    setStudentName(s?.name || "");
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  async function handleUpload() {
    if (!studentId || files.length === 0) {
      toast.error("Seleziona uno studente e carica almeno una foto.");
      return;
    }
    setStep("processing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("assignmentId", assignment.id);
      formData.append("studentId", studentId);
      files.forEach(f => formData.append("file", f));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-grade`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella correzione");
      }

      const data: GradeResult = await response.json();
      setResult(data);
      setFinalScore(`${data.proposed_score}/${data.total_score}`);
      setStep("review");
    } catch (e: any) {
      console.error("OCR grade error:", e);
      toast.error(e.message || "Errore durante la correzione automatica.");
      setStep("upload");
    }
  }

  async function handleConfirm(modified: boolean) {
    if (!result) return;
    setSaving(true);

    const { error } = await (supabase as any).from("manual_grades").insert({
      teacher_id: userId,
      class_id: classId,
      student_name: studentName,
      student_id: studentId || null,
      assignment_id: assignment.id,
      assignment_title: assignment.title,
      grade: finalScore,
      grade_scale: `/${result.total_score}`,
      notes: notes.trim() || null,
      ai_proposed_grade: `${result.proposed_score}/${result.total_score}`,
      teacher_confirmed: !modified,
      source: "ocr_corrected",
    });

    setSaving(false);
    if (error) {
      console.error("Save OCR grade error:", error);
      toast.error("Errore nel salvataggio.");
      return;
    }

    toast.success(modified ? "Voto modificato e salvato!" : "Voto confermato e salvato!");
    handleClose();
    onSaved?.();
  }

  function handleClose() {
    setStep("upload");
    setStudentId("");
    setStudentName("");
    setFiles([]);
    setResult(null);
    setFinalScore("");
    setNotes("");
    onOpenChange(false);
  }

  function resultIcon(r: string) {
    if (r === "corretto") return <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (r === "parzialmente_corretto") return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />;
  }

  function resultLabel(r: string) {
    if (r === "corretto") return "Corretto";
    if (r === "parzialmente_corretto") return "Parziale";
    return "Sbagliato";
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📸 Carica e correggi</DialogTitle>
          <p className="text-xs text-muted-foreground">{assignment.title}</p>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div>
              <Label>Studente</Label>
              <Select onValueChange={handleStudentSelect}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Seleziona studente..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Carica foto compito svolto</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-1 border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {files.length > 0
                    ? `${files.length} file selezionat${files.length > 1 ? "i" : "o"}`
                    : "Clicca per caricare — JPG, PNG o PDF"}
                </p>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 justify-center">
                    {files.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{f.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFiles}
                className="hidden"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="rounded-xl">Annulla</Button>
              <Button
                onClick={handleUpload}
                disabled={!studentId || files.length === 0}
                className="rounded-xl"
              >
                Correggi con SarAI
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: PROCESSING */}
        {step === "processing" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <div>
              <p className="font-medium text-foreground">SarAI sta correggendo...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Lettura OCR e confronto con il compito in corso
              </p>
            </div>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === "review" && result && (
          <div className="space-y-4 py-2">
            {/* OCR text */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Risposta studente rilevata
              </Label>
              <div className="mt-1 bg-muted rounded-xl p-3 text-sm text-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                {result.ocr_text || "Nessun testo rilevato"}
              </div>
            </div>

            {/* Corrections */}
            {result.corrections.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Confronto con soluzione
                </Label>
                <div className="mt-1 space-y-2">
                  {result.corrections.map((c, i) => (
                    <div key={i} className="bg-muted/50 border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {resultIcon(c.result)}
                        <span className="text-xs font-medium text-foreground">{c.question}</span>
                        <Badge
                          variant={c.result === "corretto" ? "default" : c.result === "parzialmente_corretto" ? "secondary" : "destructive"}
                          className="text-[10px] ml-auto"
                        >
                          {resultLabel(c.result)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.answer}</p>
                      <p className="text-xs text-muted-foreground italic mt-1">{c.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed score */}
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Punteggio proposto da SarAI
              </p>
              <p className="text-3xl font-bold text-primary">
                {result.proposed_score}/{result.total_score}
              </p>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Errori rilevati
                </Label>
                <ul className="mt-1 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Edit score */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Punteggio finale</Label>
                <Input
                  value={finalScore}
                  onChange={e => setFinalScore(e.target.value)}
                  className="mt-1 rounded-xl"
                  placeholder={`${result.proposed_score}/${result.total_score}`}
                />
              </div>
              <div>
                <Label>Note (opzionale)</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="mt-1 rounded-xl"
                  placeholder="Osservazioni..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} className="rounded-xl">
                Annulla
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleConfirm(true)}
                disabled={saving || !finalScore.trim()}
                className="rounded-xl"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                {saving ? "Salvataggio..." : "Modifica e salva"}
              </Button>
              <Button
                onClick={() => {
                  setFinalScore(`${result.proposed_score}/${result.total_score}`);
                  handleConfirm(false);
                }}
                disabled={saving}
                className="rounded-xl"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                {saving ? "Salvataggio..." : "Conferma"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
