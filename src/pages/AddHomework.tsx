import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Type, BookOpen, Plus, X, Sparkles, Check, Loader2, CalendarDays, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask, parseHomeworkFiles } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type InputMode = "choose" | "manual" | "photo-diary" | "photo-book" | "processing" | "confirm";

interface ExtractedTask {
  id: string;
  subject: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: number;
  selected: boolean;
  task_types: string[];
}

interface UploadedFile {
  file: File;
  preview: string;
  uploadedUrl?: string;
}

const subjects = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Arte", "Musica", "Tecnologia",
];

function getToday(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "oggi";
  if (diffDays === 1) return "domani";
  if (diffDays === 2) return "dopodomani";
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

const AddHomework = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<InputMode>("choose");
  const [manualSubject, setManualSubject] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [dueDate, setDueDate] = useState(getToday());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  // uploadedImageUrls no longer needed for storage, kept for preview only
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [extractedSourceType, setExtractedSourceType] = useState<"photo-book" | "photo-diary" | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [photoTags, setPhotoTags] = useState<string[]>([]);

  const handlePhotoAnalysis = async () => {
    if (uploadedFiles.length === 0) return;
    const sourceType = mode === "photo-book" ? "photo-book" : "photo-diary";
    setExtractedSourceType(sourceType);
    setMode("processing");

    try {
      const combinedNote = [...photoTags, photoNote.trim()].filter(Boolean).join(". ") || undefined;
      const result = await parseHomeworkFiles(
        uploadedFiles.map((uf) => uf.file),
        sourceType,
        combinedNote,
      );

      if (result.tasks && result.tasks.length > 0) {
        setExtractedTasks(
          result.tasks.map((t: any, i: number) => ({
            id: `e${i}`,
            subject: t.subject || "Altro",
            title: t.title,
            description: t.exerciseText || t.description || "",
            estimatedMinutes: t.estimatedMinutes || 15,
            difficulty: t.difficulty || 1,
            selected: true,
            task_types: Array.isArray(t.task_types) ? t.task_types : [t.task_type || "exercise"],
          }))
        );
        setMode("confirm");
      } else {
        throw new Error("Nessun compito trovato nella foto");
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      toast({
        title: "Errore nell'analisi",
        description: err.message || "Non sono riuscito ad analizzare la foto. Riprova con un'immagine più chiara.",
        variant: "destructive",
      });
      setMode(sourceType);
    }
  };

  const handleConfirmExtracted = async () => {
    const selected = extractedTasks.filter(t => t.selected);
    if (selected.length === 0) return;
    setSaving(true);
    try {
      for (const task of selected) {
        await createTask({
          subject: task.subject,
          title: task.title,
          description: task.description,
          estimated_minutes: task.estimatedMinutes,
          difficulty: task.difficulty,
          source_type: extractedSourceType || "photo",
          due_date: dueDate,
          task_type: task.task_types.join(", "),
        });
      }
      toast({ title: `${selected.length} ${selected.length === 1 ? "compito aggiunto" : "compiti aggiunti"}! ✨` });
      navigate("/dashboard");
    } catch {
      toast({ title: "Errore", description: "Non sono riuscito a salvare i compiti.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) continue;

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setUploadedFiles(prev => [...prev, { file, preview: ev.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadedFiles(prev => [...prev, { file, preview: "pdf" }]);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFiles(files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); const files = e.dataTransfer.files; if (files.length > 0) processFiles(files); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); };

  const handleManualSave = async () => {
    if (!manualSubject || !manualTitle) return;
    setSaving(true);
    try {
      await createTask({ subject: manualSubject, title: manualTitle, description: manualDescription, estimated_minutes: 15, difficulty: 1, source_type: "manual", due_date: dueDate });
      toast({ title: "Compito aggiunto!" });
      navigate("/dashboard");
    } catch {
      toast({ title: "Errore", description: "Non sono riuscito a salvare il compito.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleTask = (id: string) => {
    setExtractedTasks(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const getStepDescription = () => {
    switch (mode) {
      case "choose": return "Come vuoi inserire i compiti di oggi?";
      case "manual": return "Scrivi i dettagli del compito";
      case "photo-diary": case "photo-book": return "Carica una o più foto, oppure un PDF";
      case "processing": return "Sto analizzando i file con l'AI...";
      case "confirm": return "Seleziona i compiti da salvare";
      default: return "";
    }
  };

  const goBack = () => {
    if (mode === "confirm") {
      setMode(extractedSourceType || "choose");
      return;
    }

    if (mode === "choose") {
      navigate("/dashboard");
      return;
    }

    setUploadedFiles([]);
    setMode("choose");
  };

  const selectedCount = extractedTasks.filter(t => t.selected).length;

  const DatePickerRow = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1">
        <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-foreground">Da fare per <strong>{formatDueDate(dueDate)}</strong></span>
      </div>
      {!showDatePicker ? (
        <button onClick={() => setShowDatePicker(true)} className="text-xs text-primary font-medium hover:underline">Cambia data</button>
      ) : (
        <div className="flex items-center gap-2">
          <input type="date" value={dueDate} min={getToday()} onChange={(e) => { setDueDate(e.target.value); setShowDatePicker(false); }}
            className="text-sm px-2 py-1 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={() => setShowDatePicker(false)} className="text-xs text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 pb-12">
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <span className="font-display text-lg font-semibold text-foreground">Aggiungi compiti</span>
          </div>
          <p className="text-sm text-muted-foreground">{getStepDescription()}</p>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Choose mode */}
             {mode === "choose" && (
              <motion.div key="choose" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring}>
                <div className="bg-card rounded-2xl shadow-sm p-8 space-y-3">
                {[
                  { id: "manual" as InputMode, icon: Type, title: "Scrivi a mano", subtitle: "Descrivi il compito con le tue parole", iconBg: "bg-primary/10", iconColor: "text-primary" },
                  { id: "photo-diary" as InputMode, icon: Camera, title: "Fotografa il diario", subtitle: "Scatta una o più foto dei compiti scritti sul diario", iconBg: "bg-primary/10", iconColor: "text-primary" },
                  { id: "photo-book" as InputMode, icon: BookOpen, title: "Fotografa il libro", subtitle: "Scatta una o più foto delle pagine da studiare", iconBg: "bg-primary/10", iconColor: "text-primary" },
                ].map((card, i) => (
                  <motion.button
                    key={card.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.06 }}
                    onClick={() => setMode(card.id)}
                    className="w-full flex flex-col items-center gap-2 p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-center group"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${card.iconBg} flex items-center justify-center mb-1 group-hover:bg-primary/15 transition-colors`}>
                      <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                    </div>
                    <p className="text-sm font-bold text-foreground">{card.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.subtitle}</p>
                  </motion.button>
                ))}
                </div>
              </motion.div>
            )}

            {/* Manual input */}
            {mode === "manual" && (
              <motion.div key="manual" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Materia</label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => (
                      <button key={s} onClick={() => setManualSubject(s)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${manualSubject === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Cosa devi fare?</label>
                  <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Es: Esercizi sulle frazioni" className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Dettagli (opzionale)</label>
                  <textarea value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} placeholder="Es: Pagina 45, numeri 1-5." rows={3} className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div className="bg-muted/50 rounded-2xl px-4 py-3"><DatePickerRow /></div>
                <Button onClick={handleManualSave} disabled={!manualSubject || !manualTitle || saving} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Aggiungi compito
                </Button>
              </motion.div>
            )}

            {/* Photo upload — multi-file */}
            {(mode === "photo-diary" || mode === "photo-book") && (
              <motion.div key="photo" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-5">
                <label className="block cursor-pointer" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
                  <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <div className="w-14 h-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-3">
                      <Camera className="w-6 h-6 text-sage-dark" />
                    </div>
                    <p className="font-display font-semibold text-foreground mb-1">
                      {uploadedFiles.length === 0
                        ? (mode === "photo-diary" ? "Fotografa il diario" : "Fotografa il libro")
                        : "Aggiungi altri file"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Puoi caricare <strong>più foto</strong> o un <strong>PDF multipagina</strong>
                    </p>
                  </div>
                  <input type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {uploadedFiles.length} {uploadedFiles.length === 1 ? "file caricato" : "file caricati"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {uploadedFiles.map((uf, i) => (
                        <div key={i} className="relative rounded-xl overflow-hidden border border-border bg-muted/30 aspect-square">
                          {uf.preview === "pdf" ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                              <p className="text-[10px] text-muted-foreground text-center truncate w-full">{uf.file.name}</p>
                            </div>
                          ) : (
                            <img src={uf.preview} alt={`File ${i + 1}`} className="w-full h-full object-cover" />
                          )}
                          <button onClick={(e) => { e.preventDefault(); removeFile(i); }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center hover:bg-foreground transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={photoNote}
                        onChange={(e) => setPhotoNote(e.target.value)}
                        placeholder="Indicazioni? Es: 'Solo es. 3 e 5', 'Da pag 42 a 44'..."
                        className="w-full text-sm px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div className="bg-muted/50 rounded-2xl px-4 py-3"><DatePickerRow /></div>
                    <Button onClick={handlePhotoAnalysis} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analizza con AI
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Processing */}
            {mode === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={spring} className="text-center py-16">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-7 h-7 text-sage-dark" />
                </motion.div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  Sto analizzando {uploadedFiles.length === 1 ? "il file" : `${uploadedFiles.length} file`}...
                </h3>
                <p className="text-muted-foreground">Riconosco il testo, trovo le materie e organizzo tutto per te.</p>
              </motion.div>
            )}

            {/* Confirm — select/deselect tasks */}
            {mode === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-4">
                <div className="bg-sage-light/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    Ho trovato <strong>{extractedTasks.length} {extractedTasks.length === 1 ? "compito" : "compiti"}</strong>. Deseleziona quelli che non ti servono.
                  </p>
                </div>

                {extractedTasks.map((task, i) => (
                  <motion.button
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.06 }}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                      task.selected
                        ? "border-primary bg-card shadow-soft"
                        : "border-border bg-muted/30 opacity-50"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      task.selected ? "bg-primary" : "bg-border"
                    }`}>
                      {task.selected && <Check className="w-4 h-4 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{task.subject}</span>
                        <span className="text-[10px] text-muted-foreground">~{task.estimatedMinutes} min</span>
                      </div>
                      <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                    </div>
                  </motion.button>
                ))}

                <Button
                  onClick={handleConfirmExtracted}
                  disabled={selectedCount === 0 || saving}
                  className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Salva {selectedCount} {selectedCount === 1 ? "compito" : "compiti"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AddHomework;
