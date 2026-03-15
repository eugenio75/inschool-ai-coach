import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Type, BookOpen, Plus, X, Sparkles, Check, Loader2 } from "lucide-react";
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

const AddHomework = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<InputMode>("choose");
  const [manualSubject, setManualSubject] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePhotoAnalysis = async () => {
    if (!photoFile) return;
    setMode("processing");

    try {
      // Upload image to storage
      const imageUrl = await uploadHomeworkImage(photoFile);
      if (!imageUrl) throw new Error("Upload fallito");

      // Call OCR edge function
      const sourceType = mode === "photo-book" ? "photo-book" : "photo-diary";
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-6">
        <div className="max-w-2xl mx-auto">
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
        <div className="max-w-2xl mx-auto">
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
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/40 transition-colors">
                      <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
                        <Camera className="w-7 h-7 text-sage-dark" />
                      </div>
                      <p className="font-display font-semibold text-foreground mb-1">
                        {mode === "photo-diary" ? "Fotografa il diario" : "Fotografa il libro"}
                      </p>
                      <p className="text-sm text-muted-foreground">Tocca per scattare una foto o caricare un'immagine</p>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-2xl overflow-hidden border border-border">
                      <img src={photoPreview} alt="Foto caricata" className="w-full max-h-64 object-cover" />
                      <button onClick={() => { setPhotoPreview(null); setPhotoFile(null); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-foreground/60 text-background flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
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
