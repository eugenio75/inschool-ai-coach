import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, Edit3, AlertTriangle, Users, User } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/contexts/LangContext";
import { formatName } from "@/lib/formatName";

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

type BatchResult = {
  fileName: string;
  detected_student_name: string | null;
  matched_student: { id: string; name: string } | null;
  ocr_text: string;
  corrections: CorrectionItem[];
  proposed_score: number;
  total_score: number;
  errors: string[];
  summary: string;
  // Local UI state
  finalScore: string;
  notes: string;
  manualStudentId: string;
  manualStudentName: string;
  confirmed: boolean;
  modified: boolean;
  error?: string;
};

type SingleResult = {
  ocr_text: string;
  corrections: CorrectionItem[];
  proposed_score: number;
  total_score: number;
  errors: string[];
  summary: string;
};

type Step = "upload" | "processing" | "review-single" | "review-batch";
type Mode = "single" | "batch";

export default function OcrGradeModal({
  open, onOpenChange, classId, userId, assignment, students, onSaved,
}: Props) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>("upload");
  const [mode, setMode] = useState<Mode>("batch");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [finalScore, setFinalScore] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [processingProgress, setProcessingProgress] = useState("");
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
    if (mode === "single" && !studentId) {
      toast.error(t("ocr.selectStudentError") || "Seleziona uno studente.");
      return;
    }
    if (files.length === 0) {
      toast.error(t("ocr.noFilesError") || "Carica almeno una foto.");
      return;
    }
    setStep("processing");
    setProcessingProgress(mode === "batch"
      ? `${t("ocr.processingBatch") || "Elaborazione"} 0/${files.length}...`
      : t("ocr.processing") || "SarAI sta correggendo...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      if (mode === "batch") {
        // Send all files to batch endpoint
        const formData = new FormData();
        formData.append("assignmentId", assignment.id);
        formData.append("mode", "batch");
        formData.append("studentList", JSON.stringify(students));
        files.forEach(f => formData.append("file", f));

        setProcessingProgress(`${t("ocr.processingBatch") || "Elaborazione"} ${files.length} ${t("ocr.files") || "compiti"}...`);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-grade`,
          { method: "POST", headers, body: formData }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Errore nella correzione");
        }

        const data = await response.json();
        const results: BatchResult[] = (data.results || []).map((r: any) => ({
          ...r,
          finalScore: r.error ? "" : `${r.proposed_score}/${r.total_score}`,
          notes: "",
          manualStudentId: r.matched_student?.id || "",
          manualStudentName: r.matched_student?.name || "",
          confirmed: false,
          modified: false,
        }));
        setBatchResults(results);
        setStep("review-batch");
      } else {
        // Single mode
        const formData = new FormData();
        formData.append("assignmentId", assignment.id);
        formData.append("studentId", studentId);
        formData.append("mode", "single");
        files.forEach(f => formData.append("file", f));

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-grade`,
          { method: "POST", headers, body: formData }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Errore nella correzione");
        }

        const data: SingleResult = await response.json();
        setSingleResult(data);
        setFinalScore(`${data.proposed_score}/${data.total_score}`);
        setStep("review-single");
      }
    } catch (e: any) {
      console.error("OCR grade error:", e);
      toast.error(e.message || "Errore durante la correzione automatica.");
      setStep("upload");
    }
  }

  async function handleConfirmSingle(modified: boolean) {
    if (!singleResult) return;
    setSaving(true);

    const { error } = await (supabase as any).from("manual_grades").insert({
      teacher_id: userId,
      class_id: classId,
      student_name: studentName,
      student_id: studentId || null,
      assignment_id: assignment.id,
      assignment_title: assignment.title,
      grade: finalScore,
      grade_scale: `/${singleResult.total_score}`,
      notes: notes.trim() || null,
      ai_proposed_grade: `${singleResult.proposed_score}/${singleResult.total_score}`,
      teacher_confirmed: !modified,
      source: "ocr_corrected",
    });

    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio.");
      return;
    }
    toast.success(modified ? t("ocr.modifiedSaved") || "Voto modificato e salvato!" : t("ocr.confirmedSaved") || "Voto confermato e salvato!");
    handleClose();
    onSaved?.();
  }

  async function handleConfirmAll() {
    const toSave = batchResults.filter(r => !r.error && (r.manualStudentId || r.manualStudentName));
    if (toSave.length === 0) {
      toast.error(t("ocr.noResultsToSave") || "Nessun risultato da salvare. Assegna gli studenti mancanti.");
      return;
    }
    setSaving(true);

    const rows = toSave.map(r => ({
      teacher_id: userId,
      class_id: classId,
      student_name: r.manualStudentName || r.matched_student?.name || r.detected_student_name || "Sconosciuto",
      student_id: r.manualStudentId || null,
      assignment_id: assignment.id,
      assignment_title: assignment.title,
      grade: r.finalScore,
      grade_scale: `/${r.total_score}`,
      notes: r.notes.trim() || null,
      ai_proposed_grade: `${r.proposed_score}/${r.total_score}`,
      teacher_confirmed: !r.modified,
      source: "ocr_corrected",
    }));

    const { error } = await (supabase as any).from("manual_grades").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio.");
      return;
    }
    toast.success(`${toSave.length} ${t("ocr.gradesSaved") || "voti salvati con successo!"}`);
    handleClose();
    onSaved?.();
  }

  function updateBatchResult(index: number, updates: Partial<BatchResult>) {
    setBatchResults(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  }

  function handleClose() {
    setStep("upload");
    setMode("batch");
    setStudentId("");
    setStudentName("");
    setFiles([]);
    setSingleResult(null);
    setBatchResults([]);
    setFinalScore("");
    setNotes("");
    setProcessingProgress("");
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
      <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("ocr.title") || "📸 Carica e correggi"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{assignment.title}</p>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            {/* Mode selector */}
            <div className="flex gap-2">
              <Button
                variant={mode === "batch" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("batch")}
                className="rounded-xl flex-1"
              >
                <Users className="w-4 h-4 mr-1.5" />
                {t("ocr.batchMode") || "Più studenti"}
              </Button>
              <Button
                variant={mode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("single")}
                className="rounded-xl flex-1"
              >
                <User className="w-4 h-4 mr-1.5" />
                {t("ocr.singleMode") || "Uno studente"}
              </Button>
            </div>

            {mode === "single" && (
              <div>
                <Label>{t("ocr.student") || "Studente"}</Label>
                <Select onValueChange={handleStudentSelect}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue placeholder={t("ocr.selectStudent") || "Seleziona studente..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "batch" && (
              <div className="bg-muted/50 rounded-xl p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  {t("ocr.batchInfo") || "Carica più foto insieme"}
                </p>
                <p className="text-xs">
                  {t("ocr.batchInfoDesc") || "SarAI legge il nome dal foglio e abbina automaticamente ogni foto allo studente corretto"}
                </p>
              </div>
            )}

            <div>
              <Label>{t("ocr.uploadPhotos") || "Carica foto"}</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-1 border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {files.length > 0
                    ? `${files.length} file selezionat${files.length > 1 ? "i" : "o"}`
                    : (t("ocr.clickToUpload") || "Clicca per caricare o trascina qui le foto")}
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
              <Button variant="outline" onClick={handleClose} className="rounded-xl">{t("cancel") || "Annulla"}</Button>
              <Button
                onClick={handleUpload}
                disabled={files.length === 0 || (mode === "single" && !studentId)}
                className="rounded-xl"
              >
                {t("ocr.correctWithSarAI") || "Correggi con SarAI"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: PROCESSING */}
        {step === "processing" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <div>
              <p className="font-medium text-foreground">{t("ocr.processing") || "SarAI sta correggendo..."}</p>
              <p className="text-sm text-muted-foreground mt-1">{processingProgress}</p>
            </div>
          </div>
        )}

        {/* STEP: REVIEW SINGLE */}
        {step === "review-single" && singleResult && (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                {t("ocr.detectedAnswer") || "Risposta studente rilevata"}
              </Label>
              <div className="mt-1 bg-muted rounded-xl p-3 text-sm text-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                {singleResult.ocr_text || t("ocr.noTextDetected") || "Nessun testo rilevato"}
              </div>
            </div>

            {singleResult.corrections.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("ocr.comparison") || "Confronto con soluzione"}
                </Label>
                <div className="mt-1 space-y-2">
                  {singleResult.corrections.map((c, i) => (
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

            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {t("ocr.proposedScore") || "Punteggio proposto da SarAI"}
              </p>
              <p className="text-3xl font-bold text-primary">
                {singleResult.proposed_score}/{singleResult.total_score}
              </p>
            </div>

            {singleResult.errors.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("ocr.errorsDetected") || "Errori rilevati"}
                </Label>
                <ul className="mt-1 space-y-1">
                  {singleResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />{e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("ocr.finalScore") || "Punteggio finale"}</Label>
                <Input value={finalScore} onChange={e => setFinalScore(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>{t("ocr.notesOptional") || "Note (opzionale)"}</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 rounded-xl" placeholder="Osservazioni..." />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} className="rounded-xl">{t("cancel") || "Annulla"}</Button>
              <Button variant="secondary" onClick={() => handleConfirmSingle(true)} disabled={saving || !finalScore.trim()} className="rounded-xl">
                <Edit3 className="w-3.5 h-3.5 mr-1" />{saving ? "..." : t("ocr.modifyAndSave") || "Modifica e salva"}
              </Button>
              <Button onClick={() => { setFinalScore(`${singleResult.proposed_score}/${singleResult.total_score}`); handleConfirmSingle(false); }} disabled={saving} className="rounded-xl">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />{saving ? "..." : t("ocr.confirm") || "Conferma"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: REVIEW BATCH */}
        {step === "review-batch" && batchResults.length > 0 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t("ocr.batchReviewDesc") || "Controlla i risultati e conferma o modifica i punteggi."}
            </p>

            <div className="space-y-3">
              {batchResults.map((r, i) => (
                <div key={i} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground font-mono shrink-0">#{i + 1}</span>
                      {r.error ? (
                        <Badge variant="destructive" className="text-[10px]">{t("ocr.error") || "Errore"}</Badge>
                      ) : (
                        <>
                          {r.matched_student ? (
                            <Badge variant="default" className="text-[10px]">
                              ✅ {formatName(r.matched_student.name)}
                            </Badge>
                          ) : r.detected_student_name && r.detected_student_name !== "NON_RILEVATO" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              🔍 {formatName(r.detected_student_name)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              ❓ {t("ocr.nameNotDetected") || "Nome non rilevato"}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    {!r.error && (
                      <span className="text-lg font-bold text-primary shrink-0">
                        {r.proposed_score}/{r.total_score}
                      </span>
                    )}
                  </div>

                  {!r.error && !r.matched_student && (
                    <div>
                      <Label className="text-xs">{t("ocr.assignStudent") || "Assegna studente"}</Label>
                      <Select
                        value={r.manualStudentId}
                        onValueChange={val => {
                          const s = students.find(s => s.id === val);
                          updateBatchResult(i, {
                            manualStudentId: val,
                            manualStudentName: s?.name || "",
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1 rounded-xl h-8 text-xs">
                          <SelectValue placeholder={t("ocr.selectStudent") || "Seleziona..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!r.error && (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">{t("ocr.finalScore") || "Punteggio"}</Label>
                        <Input
                          value={r.finalScore}
                          onChange={e => updateBatchResult(i, { finalScore: e.target.value, modified: true })}
                          className="mt-1 rounded-xl h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">{t("ocr.notes") || "Note"}</Label>
                        <Input
                          value={r.notes}
                          onChange={e => updateBatchResult(i, { notes: e.target.value })}
                          className="mt-1 rounded-xl h-8 text-xs"
                          placeholder="..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Expandable corrections summary */}
                  {!r.error && r.corrections.length > 0 && (
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                        {t("ocr.viewDetails") || "Vedi dettaglio correzione"} ({r.corrections.filter(c => c.result === "corretto").length}/{r.corrections.length} {t("ocr.correct") || "corrette"})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {r.corrections.map((c, ci) => (
                          <div key={ci} className="flex items-start gap-1.5">
                            {resultIcon(c.result)}
                            <span className="text-foreground">{c.question}: <span className="text-muted-foreground">{c.explanation}</span></span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} className="rounded-xl">{t("cancel") || "Annulla"}</Button>
              <Button onClick={handleConfirmAll} disabled={saving} className="rounded-xl">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                {saving ? "..." : `${t("ocr.confirmAll") || "Conferma tutti"} (${batchResults.filter(r => !r.error && (r.manualStudentId || r.matched_student)).length})`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
