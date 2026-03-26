import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine, Sparkles, Upload, ArrowLeft, Send, Download,
  FileText, Trash2, CalendarIcon, BookOpen, Eye, Archive, RotateCcw, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ACTIVITY_TYPES = ["compito", "verifica", "esercizi", "recupero", "potenziamento"] as const;
type ActivityType = typeof ACTIVITY_TYPES[number];

const PLACEHOLDERS_FORM_A: Record<ActivityType, string> = {
  compito: "Es. Leggi il brano a pagina 34 e rispondi alle domande 1, 2 e 3 sul quaderno.",
  verifica: "Es. Parte A — 5 domande aperte sulla Rivoluzione Francese. Parte B — 5 domande a scelta multipla. Tempo: 45 minuti.",
  esercizi: "Es. Completa gli esercizi 5, 6 e 7 a pagina 52. Mostra il procedimento per ogni calcolo.",
  recupero: "Es. Rileggi il paragrafo 3.2 e riscrivi con parole tue le 3 regole principali. Poi fai i primi 3 esercizi.",
  potenziamento: "Es. Risolvi i problemi 8, 9 e 10 a pagina 78. Per il problema 10 spiega il ragionamento usato.",
};

const PLACEHOLDERS_FORM_B: Record<ActivityType, string> = {
  compito: "Es. Un compito di comprensione del testo per una seconda media — brano di narrativa con 5 domande aperte, livello medio.",
  verifica: "Es. Una verifica sui Promessi Sposi per una terza media, 8 domande misto aperto e chiuso, con soluzione, difficoltà media.",
  esercizi: "Es. 5 esercizi sulle equazioni di secondo grado con procedimento guidato, livello medio, per un quarto liceo scientifico.",
  recupero: "Es. Una scheda di recupero sulla differenza tra area e perimetro per una seconda media — spiegazione semplice, 3 esempi pratici, 4 esercizi facili.",
  potenziamento: "Es. 3 problemi avanzati di logica matematica per chi ha già acquisito le basi, quarta liceo scientifico, con soluzione commentata.",
};

type FormMode = null | "write" | "ai" | "file";
type DestinationType = "all" | "selected" | "pdf";

interface Props {
  classId: string;
  classe: any;
  students: any[];
  materials: any[];
  userId: string;
  onReload: () => void;
  autoCreate?: boolean;
}

export default function TeacherMaterialsTab({ classId, classe, students, materials, userId, onReload, autoCreate }: Props) {
  const [mode, setMode] = useState<FormMode>(autoCreate ? "write" : null);
  const [activityType, setActivityType] = useState<ActivityType>("compito");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [destination, setDestination] = useState<DestinationType>("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiContextFile, setAiContextFile] = useState<File | null>(null);
  const [aiContextText, setAiContextText] = useState<string | null>(null);
  const [aiContextUploading, setAiContextUploading] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Saved materials
  const [materialFilter, setMaterialFilter] = useState("tutti");

  function resetForm() {
    setMode(null);
    setActivityType("compito");
    setContent("");
    setDueDate(undefined);
    setDestination("all");
    setSelectedStudents([]);
    setShowPreview(false);
    setAiPrompt("");
    setAiOutput(null);
    setAiLoading(false);
    setAiContextFile(null);
    setAiContextText(null);
    setUploadFile(null);
    setUploadUrl(null);
    setOcrText(null);
  }

  function getPreviewContent(): string {
    if (mode === "write") return content;
    if (mode === "ai") return aiOutput || "";
    if (mode === "file") return ocrText || "";
    return "";
  }

  function getTitle(): string {
    const previewContent = getPreviewContent();
    if (previewContent) {
      return previewContent.slice(0, 60).replace(/\n/g, " ").trim() || `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} — ${classe?.nome || ""}`;
    }
    return `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} — ${classe?.nome || ""}`;
  }

  // --- File upload for Form C ---
  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadFile(file);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `assignments/${classId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("homework-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("homework-images").getPublicUrl(path);
      setUploadUrl(urlData.publicUrl);
      toast.success("File caricato!");

      // Run OCR for images
      if (file.type.startsWith("image/")) {
        setOcrLoading(true);
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const { data: { session } } = await supabase.auth.getSession();
        const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ images: [base64] }),
        });
        const ocrData = await ocrRes.json();
        const extracted = ocrData.tasks?.map((t: any) => t.title || t).join("\n") || ocrData.text || "";
        setOcrText(extracted);
        setOcrLoading(false);
      } else {
        const text = await file.text().catch(() => null);
        setOcrText(text || `[Documento: ${file.name}]`);
      }
    } catch (err: any) {
      toast.error("Errore upload: " + (err.message || "Riprova"));
    }
    setUploading(false);
  }

  // --- AI context upload for Form B ---
  async function handleAiContextUpload(file: File) {
    setAiContextUploading(true);
    setAiContextFile(file);
    try {
      if (file.type.startsWith("image/")) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const { data: { session } } = await supabase.auth.getSession();
        const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ images: [base64] }),
        });
        const ocrData = await ocrRes.json();
        const extracted = ocrData.tasks?.map((t: any) => t.title || t).join("\n") || ocrData.text || "Contenuto estratto dal documento.";
        setAiContextText(extracted);
        toast.success("Documento analizzato!");
      } else {
        const text = await file.text().catch(() => null);
        setAiContextText(text || `[Documento caricato: ${file.name}]`);
        toast.success("Documento caricato!");
      }
    } catch (err: any) {
      toast.error("Errore analisi documento: " + (err.message || "Riprova"));
      setAiContextText(`[Documento: ${file.name}]`);
    }
    setAiContextUploading(false);
  }

  // --- AI generate ---
  async function generateAiContent() {
    if (!aiPrompt.trim() && !aiContextText) {
      toast.error("Descrivi cosa vuoi generare o carica un documento");
      return;
    }
    setAiLoading(true);
    setAiOutput(null);
    try {
      let systemPrompt = `Sei un docente esperto. Genera materiale didattico di tipo "${activityType}". Classe: ${classe?.nome || ""}. Materia: ${classe?.materia || ""}.`;
      let userMessage = aiPrompt;
      if (aiContextText) {
        userMessage = `CONTESTO DAL DOCUMENTO CARICATO:\n---\n${aiContextText}\n---\n\nRICHIESTA: ${aiPrompt || "Genera materiale basandoti sul documento caricato."}`;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            stream: false,
            maxTokens: 3000,
            systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          }),
        }
      );
      const data = await res.json();
      const aiContent = data.choices?.[0]?.message?.content?.trim() || "Errore nella generazione.";
      setAiOutput(aiContent);
    } catch {
      toast.error("Errore nella generazione.");
    } finally {
      setAiLoading(false);
    }
  }

  // --- Export PDF ---
  function exportToPdf(title: string, pdfContent: string, type: string) {
    const printWin = window.open("", "_blank");
    if (!printWin) { toast.error("Popup bloccato dal browser"); return; }
    const isVerifica = type === "verifica";
    const headerColor = isVerifica ? "#b91c1c" : "#1a3a5c";
    const headerLabel = type.charAt(0).toUpperCase() + type.slice(1);
    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { margin: 2cm; }
body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #1a1a1a; font-size: 14px; }
h1 { font-size: 1.5em; color: ${headerColor}; border-bottom: 3px solid ${headerColor}; padding-bottom: 10px; margin-bottom: 5px; }
.meta { color: #666; font-size: 0.85em; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e5e5e5; }
.badge { display: inline-block; background: ${headerColor}15; color: ${headerColor}; padding: 2px 10px; border-radius: 12px; font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
pre { white-space: pre-wrap; font-family: inherit; font-size: 0.95em; }
${isVerifica ? `.student-info { margin-top: 20px; margin-bottom: 24px; border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; } .student-info span { color: #888; font-size: 0.85em; } .line { display: inline-block; border-bottom: 1px solid #333; width: 200px; margin-left: 8px; }` : ""}
footer { margin-top: 40px; font-size: 0.7em; color: #999; border-top: 1px solid #e5e5e5; padding-top: 10px; display: flex; justify-content: space-between; }
@media print { body { padding: 0; } }
</style></head><body>
<h1>${title}</h1>
<div class="meta"><span class="badge">${headerLabel}</span> · ${classe?.nome || ""} · ${classe?.materia || ""}</div>
${isVerifica ? `<div class="student-info"><span>Nome e cognome:</span> <span class="line"></span> &nbsp;&nbsp; <span>Data:</span> <span class="line" style="width:120px"></span></div>` : ""}
<pre>${pdfContent}</pre>
<footer><span>Generato con InSchool</span><span>${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</span></footer>
</body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 400);
  }

  // --- Confirm & assign ---
  async function handleConfirm() {
    const previewContent = getPreviewContent();
    const title = getTitle();

    if (!previewContent.trim()) {
      toast.error("Il contenuto è vuoto");
      return;
    }

    setSaving(true);
    try {
      // Always save as material
      const materialPayload = {
        teacher_id: userId,
        class_id: classId,
        title,
        subject: classe?.materia || null,
        type: activityType,
        content: previewContent,
        status: destination === "pdf" ? "draft" : "assigned",
        assigned_at: destination !== "pdf" ? new Date().toISOString() : null,
      };
      await supabase.from("teacher_materials").insert(materialPayload);

      if (destination === "pdf") {
        exportToPdf(title, previewContent, activityType);
        toast.success("Materiale salvato e PDF generato");
      } else {
        const targetStudents = destination === "all"
          ? students
          : students.filter(s => selectedStudents.includes(s.student_id || s.id));

        if (targetStudents.length === 0) {
          toast.error("Nessuno studente selezionato");
          setSaving(false);
          return;
        }

        const metadata: any = {};
        if (uploadUrl) metadata.attachment_url = uploadUrl;
        if (uploadFile) metadata.attachment_name = uploadFile.name;
        if (mode === "ai") metadata.ai_generated = true;

        const inserts = targetStudents.map(s => ({
          teacher_id: userId,
          class_id: classId,
          student_id: s.student_id || s.id,
          title,
          type: activityType,
          subject: classe?.materia || null,
          description: previewContent,
          due_date: dueDate ? dueDate.toISOString() : null,
          metadata,
        }));

        const { error } = await supabase.from("teacher_assignments").insert(inserts);
        if (error) throw error;
        toast.success(`Attività assegnata a ${targetStudents.length} studenti`);
      }

      resetForm();
      onReload();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Riprova"));
    }
    setSaving(false);
  }

  // --- Saved materials ---
  const filteredMaterials = materialFilter === "tutti"
    ? materials
    : materialFilter === "archiviato"
      ? materials.filter(m => m.status === "archived")
      : materials.filter(m => m.status === materialFilter);

  // --- Card selector ---
  if (mode === null) {
    return (
      <div className="space-y-8">
        {/* Selection cards */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Send className="w-3.5 h-3.5" /> Crea e assegna
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              {
                key: "write" as const,
                icon: PenLine,
                title: "Scrivo io",
                desc: "Sai già cosa assegnare e vuoi scriverlo direttamente.",
              },
              {
                key: "ai" as const,
                icon: Sparkles,
                title: "Genera con AI",
                desc: "Non hai il materiale — descrivi cosa vuoi e il sistema lo costruisce per te. Puoi anche caricare un tuo materiale come modello.",
              },
              {
                key: "file" as const,
                icon: Upload,
                title: "Carico e assegno",
                desc: "Hai già un file pronto — una foto del libro, un PDF, un documento. Il sistema lo legge e lo assegna.",
              },
            ]).map(({ key, icon: Icon, title, desc }) => (
              <motion.button
                key={key}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode(key)}
                className="flex flex-col items-center text-center p-6 bg-card border border-border rounded-2xl hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-foreground text-sm mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Saved materials */}
        <SavedMaterialsList
          materials={materials}
          filteredMaterials={filteredMaterials}
          materialFilter={materialFilter}
          setMaterialFilter={setMaterialFilter}
          exportToPdf={exportToPdf}
          classe={classe}
          userId={userId}
          classId={classId}
          students={students}
          onReload={onReload}
        />
      </div>
    );
  }

  // --- Preview view ---
  if (showPreview) {
    const previewContent = getPreviewContent();
    const title = getTitle();
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Modifica
        </Button>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Anteprima</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Titolo</p>
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Tipo</p>
            <Badge variant="secondary">{activityType.charAt(0).toUpperCase() + activityType.slice(1)}</Badge>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Contenuto</p>
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
              {previewContent}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Destinazione</p>
            <p className="text-sm text-foreground">
              {destination === "all" ? `Tutta la classe (${students.length} studenti)` :
                destination === "selected" ? `${selectedStudents.length} studenti selezionati` :
                  "Solo scarica PDF (non assegnato digitalmente)"}
            </p>
          </div>
          {dueDate && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Scadenza</p>
              <p className="text-sm text-foreground">{format(dueDate, "dd MMMM yyyy", { locale: it })}</p>
            </div>
          )}
          <Button className="w-full rounded-xl" onClick={handleConfirm} disabled={saving}>
            <Send className="w-3.5 h-3.5 mr-1" />
            {saving ? "Salvataggio..." : "Conferma e assegna"}
          </Button>
        </div>
      </div>
    );
  }

  // --- Form view ---
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => { resetForm(); }} className="rounded-xl">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna alla scelta
      </Button>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          {mode === "write" && <><PenLine className="w-4 h-4 text-primary" /> Scrivo io</>}
          {mode === "ai" && <><Sparkles className="w-4 h-4 text-primary" /> Genera con AI</>}
          {mode === "file" && <><Upload className="w-4 h-4 text-primary" /> Carico e assegno</>}
        </p>

        {/* Activity type */}
        <div>
          <Label className="text-xs text-muted-foreground">Tipo attività</Label>
          <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
            <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* --- FORM A: Scrivo io --- */}
        {mode === "write" && (
          <div>
            <Label className="text-xs text-muted-foreground">Contenuto</Label>
            <Textarea
              placeholder={PLACEHOLDERS_FORM_A[activityType]}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="mt-1 rounded-xl min-h-[120px]"
            />
          </div>
        )}

        {/* --- FORM B: Genera con AI --- */}
        {mode === "ai" && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Descrivi cosa vuoi</Label>
              <Textarea
                placeholder={PLACEHOLDERS_FORM_B[activityType]}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="mt-1 rounded-xl min-h-[100px]"
              />
            </div>

            {/* Model upload */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Carica modello (opzionale)</Label>
              <input
                ref={aiFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAiContextUpload(file);
                }}
              />
              {!aiContextFile ? (
                <button
                  onClick={() => aiFileRef.current?.click()}
                  disabled={aiContextUploading}
                  className="w-full border border-dashed border-border rounded-xl p-3 text-center hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {aiContextUploading ? "Analisi in corso..." : "Carica un file come riferimento di formato e livello"}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{aiContextFile.name}</p>
                    {aiContextText && <p className="text-[10px] text-muted-foreground truncate">{aiContextText.slice(0, 80)}...</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0 h-7 w-7 p-0" onClick={() => {
                    setAiContextFile(null);
                    setAiContextText(null);
                  }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {aiContextFile && (
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                  Il sistema userà questo materiale come modello. Descrivi l'argomento e la classe e l'AI creerà qualcosa di simile nello stesso formato e allo stesso livello.
                </p>
              )}
            </div>

            <Button onClick={generateAiContent} disabled={aiLoading} variant="outline" className="w-full rounded-xl">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {aiLoading ? "Generazione in corso..." : "Genera contenuto"}
            </Button>

            {aiOutput && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Anteprima generata (modificabile)</Label>
                <Textarea
                  value={aiOutput}
                  onChange={e => setAiOutput(e.target.value)}
                  className="rounded-xl min-h-[160px] text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* --- FORM C: Carico e assegno --- */}
        {mode === "file" && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Carica file</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {!uploadFile ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    {uploading ? "Caricamento..." : "Carica PDF, immagine o documento"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Puoi caricare la foto di una pagina del libro, un PDF con esercizi o qualsiasi documento già pronto. Il sistema estrae il testo automaticamente.
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-xl">
                  <FileText className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => {
                    setUploadFile(null);
                    setUploadUrl(null);
                    setOcrText(null);
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {ocrLoading && (
              <p className="text-xs text-muted-foreground text-center animate-pulse">Estrazione testo in corso...</p>
            )}

            {ocrText && (
              <div>
                <Label className="text-xs text-muted-foreground">Anteprima contenuto estratto (modificabile)</Label>
                <Textarea
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                  className="mt-1 rounded-xl min-h-[120px] text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* --- Destination (shared) --- */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Destinazione</Label>
          <RadioGroup value={destination} onValueChange={(v) => setDestination(v as DestinationType)} className="flex gap-2 flex-wrap">
            {([
              { value: "all", label: "Tutta la classe" },
              { value: "selected", label: "Studenti specifici" },
              { value: "pdf", label: "Scarica PDF" },
            ] as const).map(({ value, label }) => (
              <label
                key={value}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-xs font-medium",
                  destination === value
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/20"
                )}
              >
                <RadioGroupItem value={value} className="sr-only" />
                {label}
              </label>
            ))}
          </RadioGroup>
          {destination === "selected" && (
            <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 space-y-1 mt-2">
              {students.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Nessuno studente iscritto</p>
              ) : students.map(s => {
                const sid = s.student_id || s.id;
                const checked = selectedStudents.includes(sid);
                return (
                  <label key={sid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={(v) => {
                      setSelectedStudents(prev => v ? [...prev, sid] : prev.filter(x => x !== sid));
                    }} />
                    <span className="text-sm">{s.profile?.name || s.name || "Studente"}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Due date */}
        <div>
          <Label className="text-xs text-muted-foreground">Scadenza (opzionale)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full mt-1 rounded-xl justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={setDueDate}
                disabled={(date) => date < new Date()}
                initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* CTA */}
        <Button
          className="w-full rounded-xl"
          onClick={() => {
            const pc = getPreviewContent();
            if (!pc.trim()) {
              toast.error("Inserisci o genera il contenuto prima di procedere");
              return;
            }
            setShowPreview(true);
          }}
          disabled={
            (mode === "write" && !content.trim()) ||
            (mode === "ai" && !aiOutput) ||
            (mode === "file" && !ocrText)
          }
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          Anteprima e conferma
        </Button>
      </div>
    </div>
  );
}

// --- Saved Materials Sub-component ---
function SavedMaterialsList({
  materials, filteredMaterials, materialFilter, setMaterialFilter, exportToPdf, classe, userId, classId, students, onReload,
}: {
  materials: any[];
  filteredMaterials: any[];
  materialFilter: string;
  setMaterialFilter: (f: string) => void;
  exportToPdf: (title: string, content: string, type: string) => void;
  classe: any;
  userId: string;
  classId: string;
  students: any[];
  onReload: () => void;
}) {
  async function archiveMaterial(id: string) {
    await supabase.from("teacher_materials").update({ status: "archived" }).eq("id", id);
    toast.success("Materiale archiviato");
    onReload();
  }

  async function reassignMaterial(material: any) {
    if (students.length === 0) {
      toast.error("Nessuno studente nella classe");
      return;
    }
    try {
      const inserts = students.map(s => ({
        teacher_id: userId,
        class_id: classId,
        student_id: s.student_id || s.id,
        title: material.title,
        type: material.type || "esercizi",
        subject: material.subject || classe?.materia || null,
        description: material.content,
        metadata: { ai_generated: true, reassigned: true },
      }));
      const { error } = await supabase.from("teacher_assignments").insert(inserts);
      if (error) throw error;
      await supabase.from("teacher_materials").update({ status: "assigned", assigned_at: new Date().toISOString() }).eq("id", material.id);
      toast.success(`Riassegnato a ${students.length} studenti`);
      onReload();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Riprova"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Materiali salvati ({materials.length})
        </p>
        <div className="flex gap-1">
          {["tutti", "assigned", "draft", "archiviato"].map(f => (
            <button
              key={f}
              onClick={() => setMaterialFilter(f)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full transition-colors",
                materialFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f === "tutti" ? "Tutti" : f === "draft" ? "Non assegnati" : f === "assigned" ? "Assegnati" : "Archiviati"}
            </button>
          ))}
        </div>
      </div>
      {filteredMaterials.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <BookOpen className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {materials.length === 0
              ? "Nessun materiale salvato. Ogni materiale creato verrà salvato automaticamente qui."
              : "Nessun materiale per questo filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMaterials.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {m.type && <Badge variant="secondary" className="text-[10px]">{m.type}</Badge>}
                  <Badge variant={m.status === "assigned" ? "default" : m.status === "archived" ? "outline" : "secondary"} className="text-[10px] capitalize">
                    {m.status === "assigned" ? "Assegnato" : m.status === "archived" ? "Archiviato" : "Non assegnato"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {m.created_at ? format(new Date(m.created_at), "dd MMM yyyy", { locale: it }) : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {m.status !== "archived" && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Riassegna"
                    onClick={() => reassignMaterial(m)}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
                {m.content && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Scarica PDF"
                    onClick={() => exportToPdf(m.title, m.content, m.type || "esercizi")}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                )}
                {m.status !== "archived" && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Archivia"
                    onClick={() => archiveMaterial(m.id)}>
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
