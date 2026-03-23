import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Type, BookOpen, Plus, X, Sparkles, Check, Loader2, CalendarDays, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask, uploadHomeworkImage, extractTasksFromImage } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type InputMode = "choose" | "manual" | "photo-diary" | "photo-book" | "processing" | "task-type" | "review";

interface ExtractedTask {
  id: string;
  subject: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: number;
  selected: boolean;
  task_type: string;
}

const TASK_TYPE_OPTIONS = [
  { value: "read", label: "Leggere e comprendere" },
  { value: "questions", label: "Rispondere a domande" },
  { value: "exercise", label: "Fare esercizi" },
  { value: "study", label: "Studiare teoria" },
  { value: "summarize", label: "Riassumere" },
  { value: "memorize", label: "Memorizzare" },
  { value: "write", label: "Scrivere un testo" },
  { value: "problem", label: "Risolvere problemi" },
  { value: "custom", label: "Scrivi tu stesso" },
];

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

function getTaskTypeLabel(value: string): string {
  return TASK_TYPE_OPTIONS.find(o => o.value === value)?.label || value;
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [extractedSourceType, setExtractedSourceType] = useState<"photo-book" | "photo-diary" | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  // Step 2 state
  const [showFullTypeList, setShowFullTypeList] = useState<Record<string, boolean>>({});
  const [customTypeText, setCustomTypeText] = useState<Record<string, string>>({});

  const handlePhotoAnalysis = async () => {
    if (!photoFile) return;
    const sourceType = mode === "photo-book" ? "photo-book" : "photo-diary";
    setExtractedSourceType(sourceType);
    setMode("processing");

    try {
      const imageUrl = await uploadHomeworkImage(photoFile);
      if (!imageUrl) throw new Error("Upload fallito");
      setUploadedImageUrl(imageUrl);

      const result = await extractTasksFromImage(imageUrl, sourceType, photoNote.trim() || undefined);

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
            task_type: t.task_type || "exercise",
          }))
        );
        setMode("task-type");
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
      setMode(photoFile ? sourceType : "choose");
    }
  };

  const processFile = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) return;
    setPhotoFile(file);
    setUploadedImageUrl(null);
    setExtractedSourceType(null);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview("pdf");
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); };
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

  const handleConfirmExtracted = async () => {
    const selected = extractedTasks.filter(t => t.selected);
    if (selected.length === 0) return;
    setSaving(true);
    try {
      for (const task of selected) {
        await createTask({
          subject: task.subject, title: task.title, description: task.description,
          estimated_minutes: task.estimatedMinutes, difficulty: task.difficulty,
          source_type: extractedSourceType || "photo", source_image_url: uploadedImageUrl || undefined,
          due_date: dueDate, task_type: task.task_type,
        });
      }
      toast({ title: `${selected.length} compiti aggiunti!` });
      navigate("/dashboard");
    } catch {
      toast({ title: "Errore", description: "Non sono riuscito a salvare i compiti.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const updateTask = (id: string, updates: Partial<ExtractedTask>) => {
    setExtractedTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const getStepDescription = () => {
    switch (mode) {
      case "choose": return "Come vuoi inserire i compiti di oggi?";
      case "manual": return "Scrivi i dettagli del compito";
      case "photo-diary": case "photo-book": return "Fotografa o carica un'immagine";
      case "processing": return "Sto analizzando la foto con l'AI...";
      case "task-type": return "Step 2 — Controlla il tipo di attività";
      case "review": return "Step 3 — Modifica e conferma i compiti";
      default: return "";
    }
  };

  const goBack = () => {
    if (mode === "review") setMode("task-type");
    else if (mode === "task-type") setMode(extractedSourceType || "choose");
    else if (mode === "choose") navigate("/dashboard");
    else setMode("choose");
  };

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
    <div className="min-h-screen bg-background pb-12">
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <span className="font-display text-lg font-semibold text-foreground">Aggiungi compiti</span>
          </div>
          {/* Step indicator for photo flow */}
          {(mode === "task-type" || mode === "review") && (
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3].map(step => {
                const current = mode === "task-type" ? 2 : 3;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step < current ? "bg-primary text-primary-foreground" :
                      step === current ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>{step <= current - 1 ? <Check className="w-3.5 h-3.5" /> : step}</div>
                    {step < 3 && <div className={`w-8 h-0.5 ${step < current ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{getStepDescription()}</p>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Choose mode */}
            {mode === "choose" && (
              <motion.div key="choose" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-3">
                <button onClick={() => setMode("manual")} className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-border bg-card hover:bg-muted transition-colors text-left shadow-soft">
                  <div className="w-12 h-12 rounded-xl bg-sage-light flex items-center justify-center"><Type className="w-5 h-5 text-sage-dark" /></div>
                  <div className="flex-1"><p className="font-display font-semibold text-foreground">Scrivi a mano</p><p className="text-sm text-muted-foreground">Descrivi il compito con le tue parole</p></div>
                </button>
                <button onClick={() => setMode("photo-diary")} className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-border bg-card hover:bg-muted transition-colors text-left shadow-soft">
                  <div className="w-12 h-12 rounded-xl bg-clay-light flex items-center justify-center"><Camera className="w-5 h-5 text-clay-dark" /></div>
                  <div className="flex-1"><p className="font-display font-semibold text-foreground">Fotografa il diario</p><p className="text-sm text-muted-foreground">Scatta una foto dei compiti scritti sul diario</p></div>
                </button>
                <button onClick={() => setMode("photo-book")} className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-border bg-card hover:bg-muted transition-colors text-left shadow-soft">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><BookOpen className="w-5 h-5 text-muted-foreground" /></div>
                  <div className="flex-1"><p className="font-display font-semibold text-foreground">Fotografa il libro</p><p className="text-sm text-muted-foreground">Scatta una foto delle pagine da studiare</p></div>
                </button>
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

            {/* Photo upload */}
            {(mode === "photo-diary" || mode === "photo-book") && (
              <motion.div key="photo" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-5">
                {!photoPreview ? (
                  <label className="block cursor-pointer" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
                    <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4"><Camera className="w-7 h-7 text-sage-dark" /></div>
                      <p className="font-display font-semibold text-foreground mb-1">{mode === "photo-diary" ? "Fotografa il diario" : "Fotografa il libro"}</p>
                      <p className="text-sm text-muted-foreground">Tocca per scattare, carica un'immagine/PDF o trascinala qui</p>
                    </div>
                    <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden border border-border">
                      {photoPreview === "pdf" ? (
                        <div className="w-full py-16 flex flex-col items-center justify-center bg-muted/30">
                          <BookOpen className="w-12 h-12 text-muted-foreground mb-3" /><p className="font-medium text-foreground">{photoFile?.name}</p><p className="text-sm text-muted-foreground mt-1">PDF pronto per l'analisi</p>
                        </div>
                      ) : (
                        <img src={photoPreview!} alt="Foto caricata" className="w-full max-h-[70vh] object-contain bg-muted/30" />
                      )}
                      <button onClick={() => { setPhotoPreview(null); setPhotoFile(null); setUploadedImageUrl(null); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-foreground/60 text-background flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Cosa devi fare? (opzionale)</label>
                      <textarea value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Es: Esercizio 3 e 4 a pagina 52, solo le domande vero/falso..." rows={2}
                        className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-sm" />
                    </div>
                    <div className="bg-muted/50 rounded-2xl px-4 py-3"><DatePickerRow /></div>
                    <Button onClick={handlePhotoAnalysis} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base">
                      <Sparkles className="w-4 h-4 mr-2" />Analizza con AI e trova i compiti
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
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Sto analizzando la foto...</h3>
                <p className="text-muted-foreground">Riconosco il testo, trovo le materie e organizzo tutto per te.</p>
              </motion.div>
            )}

            {/* Step 2 — Task type confirmation */}
            {mode === "task-type" && (
              <motion.div key="task-type" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-4">
                <div className="bg-sage-light/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    Ho trovato <strong>{extractedTasks.length} {extractedTasks.length === 1 ? "compito" : "compiti"}</strong>. Controlla che il tipo sia giusto.
                  </p>
                </div>

                {extractedTasks.map((task, i) => (
                  <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.08 }}
                    className="bg-card border border-border rounded-2xl p-4 shadow-soft"
                  >
                    <div className="mb-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{task.subject}</span>
                      <h4 className="font-display font-semibold text-foreground mt-0.5">{task.title}</h4>
                      {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                    </div>

                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-2">L'AI suggerisce:</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-foreground bg-primary/10 px-3 py-1 rounded-lg">{getTaskTypeLabel(task.task_type)}</span>
                      </div>

                      {!showFullTypeList[task.id] ? (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => {/* keep as is */}}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                            ✓ Va bene così
                          </button>
                          <button onClick={() => setShowFullTypeList(prev => ({ ...prev, [task.id]: true }))}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-accent transition-colors">
                            Cambialo
                          </button>
                          <button onClick={() => {/* AI decides = keep */}}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors">
                            Non so, decidi tu
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 mt-1">
                          {TASK_TYPE_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => {
                              if (opt.value === "custom") return;
                              updateTask(task.id, { task_type: opt.value });
                              setShowFullTypeList(prev => ({ ...prev, [task.id]: false }));
                            }}
                              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                                task.task_type === opt.value ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent text-foreground border border-border"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          {/* Custom text field */}
                          <div className="flex gap-2 mt-1">
                            <input type="text" value={customTypeText[task.id] || ""} onChange={(e) => setCustomTypeText(prev => ({ ...prev, [task.id]: e.target.value }))}
                              placeholder="Scrivi tu stesso..."
                              className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            <button onClick={() => {
                              const text = customTypeText[task.id]?.trim();
                              if (text) {
                                updateTask(task.id, { task_type: "custom", title: text });
                                setShowFullTypeList(prev => ({ ...prev, [task.id]: false }));
                              }
                            }} disabled={!customTypeText[task.id]?.trim()} className="text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
                              OK
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                <Button onClick={() => setMode("review")} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base">
                  Avanti — Conferma compiti
                </Button>
              </motion.div>
            )}

            {/* Step 3 — Editable review */}
            {mode === "review" && (
              <motion.div key="review" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-4">
                <div className="bg-sage-light/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Pencil className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <p className="text-sm text-foreground">Puoi modificare tutto prima di salvare.</p>
                </div>

                <div className="bg-muted/50 rounded-2xl px-4 py-3"><DatePickerRow /></div>

                {extractedTasks.map((task, i) => (
                  <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.08 }}
                    className={`bg-card border rounded-2xl p-4 transition-all ${task.selected ? "border-primary shadow-soft" : "border-border opacity-60"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                          {getTaskTypeLabel(task.task_type)}
                        </span>
                        <span className="text-xs text-muted-foreground">~{task.estimatedMinutes} min</span>
                      </div>
                      <button onClick={() => updateTask(task.id, { selected: !task.selected })}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${task.selected ? "bg-primary" : "bg-border"}`}>
                        {task.selected && <Check className="w-4 h-4 text-primary-foreground" />}
                      </button>
                    </div>

                    {task.selected && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Materia</label>
                          <div className="flex flex-wrap gap-1.5">
                            {subjects.map(s => (
                              <button key={s} onClick={() => updateTask(task.id, { subject: s })}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${task.subject === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Titolo</label>
                          <input type="text" value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })}
                            className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrizione</label>
                          <textarea value={task.description} onChange={(e) => updateTask(task.id, { description: e.target.value })} rows={2}
                            className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                <Button onClick={handleConfirmExtracted} disabled={!extractedTasks.some(t => t.selected) || saving}
                  className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Salva {extractedTasks.filter(t => t.selected).length} compiti
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
