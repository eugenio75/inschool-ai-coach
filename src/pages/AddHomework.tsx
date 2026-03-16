import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Type, BookOpen, Plus, X, Sparkles, Check, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask, uploadHomeworkImage, extractTasksFromImage } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

type InputMode = "choose" | "manual" | "photo-diary" | "photo-book" | "processing" | "review";

interface ExtractedTask {
  id: string;
  subject: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: number;
  selected: boolean;
}

const subjects = [
  "Italiano", "Matematica", "Scienze", "Storia", "Geografia", "Inglese", "Arte", "Musica", "Tecnologia",
];

/** Returns tomorrow's date as YYYY-MM-DD */
function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

/** Format date for display: "domani", "dopodomani", or "gio 20 mar" */
function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return "domani";
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
  const [dueDate, setDueDate] = useState(getTomorrow());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handlePhotoAnalysis = async () => {
    if (!photoFile) return;
    const sourceType = mode === "photo-book" ? "photo-book" : "photo-diary";
    setMode("processing");

    try {
      const imageUrl = await uploadHomeworkImage(photoFile);
      if (!imageUrl) throw new Error("Upload fallito");
      setUploadedImageUrl(imageUrl);

      const result = await extractTasksFromImage(imageUrl, sourceType);

      if (result.tasks && result.tasks.length > 0) {
        setExtractedTasks(
          result.tasks.map((t: any, i: number) => ({
            id: `e${i}`,
            subject: t.subject || "Altro",
            title: t.title,
            description: t.description || "",
            estimatedMinutes: t.estimatedMinutes || 15,
            difficulty: t.difficulty || 1,
            selected: true,
          }))
        );
        setMode("review");
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
      setMode(photoFile ? "photo-diary" : "choose");
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPhotoFile(file);
    setUploadedImageUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleManualSave = async () => {
    if (!manualSubject || !manualTitle) return;
    setSaving(true);
    try {
      await createTask({
        subject: manualSubject,
        title: manualTitle,
        description: manualDescription,
        estimated_minutes: 15,
        difficulty: 1,
        source_type: "manual",
        due_date: dueDate,
      });
      toast({ title: "Compito aggiunto! ✅" });
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Errore", description: "Non sono riuscito a salvare il compito.", variant: "destructive" });
    } finally {
      setSaving(false);
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
          source_type: "photo",
          source_image_url: uploadedImageUrl || undefined,
          due_date: dueDate,
        });
      }
      toast({ title: `${selected.length} compiti aggiunti! ✅` });
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Errore", description: "Non sono riuscito a salvare i compiti.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /** Date picker row component */
  const DatePickerRow = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1">
        <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-foreground">
          Da fare per <strong>{formatDueDate(dueDate)}</strong>
        </span>
      </div>
      {!showDatePicker ? (
        <button
          onClick={() => setShowDatePicker(true)}
          className="text-xs text-primary font-medium hover:underline"
        >
          Cambia data
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dueDate}
            min={getTomorrow()}
            onChange={(e) => {
              setDueDate(e.target.value);
              setShowDatePicker(false);
            }}
            className="text-sm px-2 py-1 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => setShowDatePicker(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => mode === "choose" ? navigate("/dashboard") : setMode("choose")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Aggiungi compiti</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "choose" && "Come vuoi inserire i compiti di oggi?"}
            {mode === "manual" && "Scrivi i dettagli del compito"}
            {(mode === "photo-diary" || mode === "photo-book") && "Fotografa o carica un'immagine"}
            {mode === "processing" && "Sto analizzando la foto con l'AI..."}
            {mode === "review" && "Ecco cosa ho trovato. Conferma i compiti."}
          </p>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Choose mode */}
            {mode === "choose" && (
              <motion.div key="choose" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-3">
                <button onClick={() => setMode("manual")} className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-border bg-card hover:bg-muted transition-colors text-left shadow-soft">
                  <div className="w-12 h-12 rounded-xl bg-sage-light flex items-center justify-center">
                    <Type className="w-5 h-5 text-sage-dark" />
                  </div>
                  <div className="flex-1">
                    <p className="font-display font-semibold text-foreground">Scrivi a mano</p>
                    <p className="text-sm text-muted-foreground">Descrivi il compito con le tue parole</p>
                  </div>
                </button>

                <button onClick={() => setMode("photo-diary")} className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-border bg-card hover:bg-muted transition-colors text-left shadow-soft">
                  <div className="w-12 h-12 rounded-xl bg-clay-light flex items-center justify-center">
                    <Camera className="w-5 h-5 text-clay-dark" />
                  </div>
                  <div className="flex-1">
                    <p className="font-display font-semibold text-foreground">Fotografa il diario</p>
                    <p className="text-sm text-muted-foreground">Scatta una foto dei compiti scritti sul diario</p>
                  </div>
                </button>

                <button onClick={() => setMode("photo-book")} className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl border border-border bg-card hover:bg-muted transition-colors text-left shadow-soft">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-display font-semibold text-foreground">Fotografa il libro</p>
                    <p className="text-sm text-muted-foreground">Scatta una foto delle pagine da studiare</p>
                  </div>
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
                      <button key={s} onClick={() => setManualSubject(s)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${manualSubject === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                        {s}
                      </button>
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
                {/* Due date */}
                <div className="bg-muted/50 rounded-2xl px-4 py-3">
                  <DatePickerRow />
                </div>
                <Button onClick={handleManualSave} disabled={!manualSubject || !manualTitle || saving} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Aggiungi compito
                </Button>
              </motion.div>
            )}

            {/* Photo upload */}
            {(mode === "photo-diary" || mode === "photo-book") && (
              <motion.div key="photo" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-5">
                {!photoPreview ? (
                  <label 
                    className="block cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
                        <Camera className="w-7 h-7 text-sage-dark" />
                      </div>
                      <p className="font-display font-semibold text-foreground mb-1">
                        {mode === "photo-diary" ? "Fotografa il diario" : "Fotografa il libro"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Tocca per scattare, carica un'immagine o trascinala qui
                      </p>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden border border-border">
                      <img src={photoPreview} alt="Foto caricata" className="w-full max-h-[70vh] object-contain bg-muted/30" />
                      <button onClick={() => { setPhotoPreview(null); setPhotoFile(null); setUploadedImageUrl(null); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-foreground/60 text-background flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Due date */}
                    <div className="bg-muted/50 rounded-2xl px-4 py-3">
                      <DatePickerRow />
                    </div>
                    <Button onClick={handlePhotoAnalysis} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analizza con AI e trova i compiti
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
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Sto analizzando la foto con l'AI...</h3>
                <p className="text-muted-foreground">Riconosco il testo, trovo le materie e organizzo tutto per te.</p>
              </motion.div>
            )}

            {/* Review extracted */}
            {mode === "review" && (
              <motion.div key="review" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={spring} className="space-y-4">
                <div className="bg-sage-light/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-sage-dark flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    Ho trovato <strong>{extractedTasks.length} compiti</strong> nella foto. Deseleziona quelli che non servono.
                  </p>
                </div>

                {/* Due date for all extracted tasks */}
                <div className="bg-muted/50 rounded-2xl px-4 py-3">
                  <DatePickerRow />
                </div>

                {extractedTasks.map((task, i) => (
                  <motion.button key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.08 }}
                    onClick={() => { setExtractedTasks(prev => prev.map(t => t.id === task.id ? { ...t, selected: !t.selected } : t)); }}
                    className={`w-full text-left p-5 rounded-2xl border transition-all ${task.selected ? "border-primary bg-card shadow-soft" : "border-border bg-muted/50 opacity-60"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{task.subject} • ~{task.estimatedMinutes} min</span>
                        <h4 className="font-display font-semibold text-foreground mt-1">{task.title}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${task.selected ? "bg-primary" : "bg-border"}`}>
                        {task.selected && <Check className="w-4 h-4 text-primary-foreground" />}
                      </div>
                    </div>
                  </motion.button>
                ))}

                <Button onClick={handleConfirmExtracted} disabled={!extractedTasks.some(t => t.selected) || saving} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-2xl py-5 text-base disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Conferma {extractedTasks.filter(t => t.selected).length} compiti
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
