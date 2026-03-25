import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Users, Heart, BookOpen, MessageSquare,
  Plus, Mail, Copy, Shield, AlertTriangle, CheckCircle2,
  FilePlus, Save, Trash2, Send, ChevronRight, FileText, BarChart2, Download,
  Upload, Sparkles, PenLine, CalendarIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

async function fetchTeacherClassData(classId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/teacher-class-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ classId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Errore nel caricamento della classe");
  }

  return response.json();
}

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getChildSession();
  const profileId = session?.profileId;

  const [classe, setClasse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignmentResults, setAssignmentResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("classe");
  const [materialFilter, setMaterialFilter] = useState("tutti");

  // Unified assign dialog
  // Unified assign form (inline in Materiali tab)
  const [assignMode, setAssignMode] = useState<"text" | "ai" | "file">("text");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignType, setAssignType] = useState("esercizi");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDueDate, setAssignDueDate] = useState<Date | undefined>(undefined);
  const [assignTarget, setAssignTarget] = useState<"all" | "selected">("all");
  const [assignSelectedStudents, setAssignSelectedStudents] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  // AI generation within dialog
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLivello, setAiLivello] = useState("intermedio");
  const [aiNumero, setAiNumero] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiQuestionType, setAiQuestionType] = useState<"aperte" | "chiuse" | "miste">("miste");

  // File upload within dialog
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI mode file context upload
  const [aiContextFile, setAiContextFile] = useState<File | null>(null);
  const [aiContextText, setAiContextText] = useState<string | null>(null);
  const [aiContextUploading, setAiContextUploading] = useState(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  function resetAssignForm() {
    setAssignTitle("");
    setAssignType("esercizi");
    setAssignDesc("");
    setAssignDueDate(undefined);
    setAssignTarget("all");
    setAssignSelectedStudents([]);
    setAssignMode("text");
    setAiPrompt("");
    setAiOutput(null);
    setAiLoading(false);
    setAiQuestionType("miste");
    setUploadFile(null);
    setUploadUrl(null);
    setAiContextFile(null);
    setAiContextText(null);
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `assignments/${classId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("homework-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("homework-images").getPublicUrl(path);
      setUploadUrl(urlData.publicUrl);
      setUploadFile(file);
      if (!assignTitle) setAssignTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success("File caricato!");
    } catch (err: any) {
      toast.error("Errore upload: " + (err.message || "Riprova"));
    }
    setUploading(false);
  }

  async function handleAiContextUpload(file: File) {
    setAiContextUploading(true);
    setAiContextFile(file);
    try {
      // For images, convert to base64 and use OCR edge function
      if (file.type.startsWith("image/")) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const ocrRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ images: [base64] }),
        });
        const ocrData = await ocrRes.json();
        const extracted = ocrData.tasks?.map((t: any) => t.title || t).join("\n") || ocrData.text || "Contenuto estratto dal documento.";
        setAiContextText(extracted);
        toast.success("Documento analizzato!");
      } else {
        // For PDFs/docs, read as text if possible
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

  async function generateAiContent() {
    if (!aiPrompt.trim() && !aiContextText) { toast.error("Descrivi cosa vuoi generare o carica un documento"); return; }
    setAiLoading(true);
    setAiOutput(null);
    try {
      let systemPrompt = `Sei un docente esperto. Genera materiale didattico: ${assignType}, livello ${aiLivello}, ${aiNumero} elementi. Classe: ${classe?.nome || ""}. Materia: ${classe?.materia || ""}.`;

      if (assignType === "verifica") {
        const qTypeDesc = aiQuestionType === "aperte" ? "solo domande aperte (risposta libera)" :
          aiQuestionType === "chiuse" ? "solo domande a risposta chiusa (scelta multipla con 4 opzioni, indica la risposta corretta)" :
          "un mix di domande aperte e chiuse (scelta multipla con 4 opzioni, indica la risposta corretta per le chiuse)";
        systemPrompt += ` La verifica deve contenere ${qTypeDesc}. Formatta con numerazione chiara. Per le domande chiuse usa A) B) C) D). Alla fine aggiungi una sezione "SOLUZIONI" con tutte le risposte corrette.`;
      }

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
      const content = data.choices?.[0]?.message?.content?.trim() || "Errore nella generazione.";
      setAiOutput(content);
      if (!assignTitle) setAssignTitle(aiPrompt.slice(0, 60) || "Materiale generato");
      setAssignDesc(content);
    } catch {
      toast.error("Errore nella generazione.");
    } finally {
      setAiLoading(false);
    }
  }

  function exportToPdf(title: string, content: string, type: string) {
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
${isVerifica ? `.question { margin: 16px 0; padding: 12px 16px; border-left: 3px solid ${headerColor}20; background: #fafafa; border-radius: 0 8px 8px 0; }` : ""}
footer { margin-top: 40px; font-size: 0.7em; color: #999; border-top: 1px solid #e5e5e5; padding-top: 10px; display: flex; justify-content: space-between; }
.student-info { margin-top: 20px; margin-bottom: 24px; border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; }
.student-info span { color: #888; font-size: 0.85em; }
.line { display: inline-block; border-bottom: 1px solid #333; width: 200px; margin-left: 8px; }
@media print { body { padding: 0; } }
</style></head><body>
<h1>${title}</h1>
<div class="meta">
  <span class="badge">${headerLabel}</span> · ${classe?.nome || ""} · ${classe?.materia || ""} · Livello: ${aiLivello}
</div>
${isVerifica ? `<div class="student-info"><span>Nome e cognome:</span> <span class="line"></span> &nbsp;&nbsp; <span>Data:</span> <span class="line" style="width:120px"></span></div>` : ""}
<pre>${content}</pre>
<footer><span>Generato con InSchool</span><span>${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</span></footer>
</body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 400);
  }

  async function handleAssignActivity() {
    if (!assignTitle.trim() || !user || !classId) {
      toast.error("Inserisci almeno un titolo");
      return;
    }
    setAssignSaving(true);
    try {
      const targetStudents = assignTarget === "all"
        ? students
        : students.filter(s => assignSelectedStudents.includes(s.student_id || s.id));

      if (targetStudents.length === 0) {
        toast.error("Nessuno studente selezionato");
        setAssignSaving(false);
        return;
      }

      const metadata: any = {};
      if (uploadUrl) metadata.attachment_url = uploadUrl;
      if (uploadFile) metadata.attachment_name = uploadFile.name;
      if (aiOutput) metadata.ai_generated = true;

      const inserts = targetStudents.map(s => ({
        teacher_id: user.id,
        class_id: classId,
        student_id: s.student_id || s.id,
        title: assignTitle.trim(),
        type: assignType,
        subject: classe?.materia || null,
        description: assignDesc.trim() || null,
        due_date: assignDueDate ? assignDueDate.toISOString() : null,
        metadata,
      }));

      const { error } = await supabase.from("teacher_assignments").insert(inserts);
      if (error) throw error;

      // Also save as material if AI-generated
      if (aiOutput) {
        await supabase.from("teacher_materials").insert({
          teacher_id: user.id,
          class_id: classId,
          title: assignTitle.trim(),
          subject: classe?.materia,
          type: assignType,
          level: aiLivello,
          content: aiOutput,
          status: "assigned",
          assigned_at: new Date().toISOString(),
        });
      }

      toast.success(`Attività assegnata a ${targetStudents.length} studenti`);
      resetAssignForm();
      loadClass();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Riprova"));
    }
    setAssignSaving(false);
  }

  useEffect(() => {
    if (!classId || (!profileId && !user)) return;
    loadClass();
  }, [classId, profileId, user]);

  async function loadClass() {
    setLoading(true);
    try {
      if (user) {
        const data = await fetchTeacherClassData(classId!);
        setClasse(data.classe);
        setStudents(data.students || []);
        setAssignmentResults(data.assignmentResults || []);

        const { data: mats } = await (supabase as any)
          .from("teacher_materials")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("class_id", classId)
          .order("created_at", { ascending: false });
        setMaterials(mats || []);
      } else {
        const { data: cl } = await (supabase as any)
          .from("classi").select("*").eq("id", classId).single();
        setClasse(cl);

        const { data: enr } = await (supabase as any)
          .from("class_enrollments").select("*").eq("class_id", classId).eq("status", "active");

        const enrollments = enr || [];
        let profilesList: any[] = [];
        if (enrollments.length > 0) {
          const studentIds = enrollments.map((e: any) => e.student_id);
          const { data: profiles } = await (supabase as any)
            .from("child_profiles")
            .select("id, name, parent_id, avatar_emoji, school_level")
            .in("parent_id", studentIds);
          profilesList = profiles || [];

          const profileMap: Record<string, any> = {};
          profilesList.forEach((p: any) => { profileMap[p.parent_id] = p; });

          const enriched = enrollments.map((e: any) => ({
            ...e,
            profile: profileMap[e.student_id] || null,
          }));
          setStudents(enriched);
        } else {
          setStudents([]);
        }

        setAssignmentResults([]);
        setMaterials([]);
      }
    } catch (error) {
      console.error("loadClass error:", error);
      toast.error("Non sono riuscito a caricare studenti e risultati.");
      setStudents([]);
      setAssignmentResults([]);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!classe) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Classe non trovata.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")} className="mt-4">Torna alla dashboard</Button>
      </div>
    );
  }

  const filteredMaterials = materialFilter === "tutti"
    ? materials
    : materials.filter(m => m.status === materialFilter);

  const matLower = (classe.materia || '').toLowerCase();
  const gradientMap: Record<string, string> = {
    'musica': 'from-violet-500 to-fuchsia-500',
    'educazione civica': 'from-emerald-500 to-teal-500',
    'italiano': 'from-sky-500 to-blue-500',
    'matematica': 'from-orange-500 to-amber-500',
    'storia': 'from-rose-500 to-red-500',
    'scienze': 'from-green-500 to-lime-500',
    'inglese': 'from-indigo-500 to-blue-500',
  };
  const gradient = gradientMap[matLower] || 'from-[#1A3A5C] to-[#0070C0]';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="rounded-xl mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>

        <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Classe</p>
              <h1 className="text-2xl font-bold">{classe.nome}</h1>
              <div className="flex items-center gap-3 mt-2">
                {classe.materia && (
                  <span className="text-sm bg-white/20 px-3 py-0.5 rounded-full font-medium">{classe.materia}</span>
                )}
                <span className="text-sm text-white/80">{students.length} studenti</span>
                {classe.ordine_scolastico && (
                  <span className="text-sm text-white/60">{classe.ordine_scolastico}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Codice classe</p>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-2xl tracking-[0.2em]">{classe.codice_invito}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}
                  className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 rounded-xl">
          <TabsTrigger value="classe" className="text-xs rounded-lg">
            <Users className="w-3.5 h-3.5 mr-1" /> La classe
          </TabsTrigger>
          <TabsTrigger value="benessere" className="text-xs rounded-lg">
            <Heart className="w-3.5 h-3.5 mr-1" /> Benessere
          </TabsTrigger>
          <TabsTrigger value="materiali" className="text-xs rounded-lg">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Materiali
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-xs rounded-lg">
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Coach AI
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: La classe */}
        <TabsContent value="classe" className="mt-6 space-y-4">
          {students.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Nessuno studente ancora</p>
              <p className="text-sm text-muted-foreground mb-4">
                Condividi il codice classe per invitare gli studenti
              </p>
              <div className="bg-muted rounded-xl py-3 px-4 inline-block mb-3">
                <span className="font-mono font-bold text-2xl tracking-widest text-foreground">
                  {classe.codice_invito}
                </span>
              </div>
              <br />
              <Button variant="outline" size="sm" className="rounded-xl"
                onClick={() => { navigator.clipboard.writeText(classe.codice_invito); toast.success("Codice copiato!"); }}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copia codice
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Risultati verifiche */}
              {assignmentResults.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5" /> Risultati verifiche
                  </p>
                  <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {assignmentResults.map((a: any) => {
                      const avgScore = a.results.length > 0
                        ? Math.round(a.results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / a.results.length)
                        : 0;
                      const completed = a.results.filter((r: any) => r.status === 'completed').length;
                      return (
                        <div key={a.id} className="border border-border rounded-xl p-4 bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {a.subject} · {a.type === 'verifica' ? 'Verifica' : 'Compito'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-center">
                                <p className={`text-lg font-bold ${avgScore >= 70 ? 'text-green-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {avgScore}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">media</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-foreground">{completed}/{a.results.length}</p>
                                <p className="text-[10px] text-muted-foreground">completati</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1 mt-3 pt-3 border-t border-border">
                            {a.results.map((r: any) => (
                              <div key={r.id} className="flex items-center gap-2 text-xs">
                                <AvatarInitials name={r.student_name} size="sm" />
                                <span className="flex-1 text-foreground truncate">{r.student_name}</span>
                                <span className={`font-semibold ${(r.score || 0) >= 70 ? 'text-green-600' : (r.score || 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {r.score != null ? `${Math.round(r.score)}%` : '—'}
                                </span>
                                <Badge variant={r.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                  {r.status === 'completed' ? 'Completato' : r.status === 'in_progress' ? 'In corso' : 'Assegnato'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista studenti */}
              <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Studenti ({students.length})
              </p>
              {students.map((s: any) => {
                const name = s.profile?.name || "Studente";
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/studente/${s.student_id}?classId=${classId}`)}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/50 hover:shadow-sm transition-all text-left"
                  >
                    <AvatarInitials name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.profile?.school_level || "Iscritto"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">Attivo</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Benessere */}
        <TabsContent value="benessere" className="mt-6">
          {students.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Nessun dato ancora</p>
              <p className="text-sm text-muted-foreground">
                I segnali appariranno quando gli studenti inizieranno a usare l'app.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-6">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <p className="font-medium text-foreground">La classe procede regolarmente</p>
                <p className="text-sm text-muted-foreground mt-1">Nessun segnale rilevante</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "studenti con segnali da osservare", value: 0, color: "text-amber-600" },
                  { label: "studenti con continuità regolare", value: students.length, color: "text-green-600" },
                  { label: "studenti con calo recente", value: 0, color: "text-amber-600" },
                  { label: "sessioni questa settimana", value: 0, color: "text-blue-600" },
                ].map((item, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-5">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                I dati mostrati sono aggregati anonimi. Per vedere i dettagli di un singolo studente,
                vai alla tab "La classe" e clicca sul suo nome.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Materiali */}
        <TabsContent value="materiali" className="mt-6 space-y-8">
          {/* === Sezione: Assegna attività === */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Send className="w-3.5 h-3.5" /> Assegna attività alla classe
            </p>

            {/* Mode selector */}
            <div className="flex gap-1 bg-muted p-1 rounded-xl">
              {([
                { key: "text" as const, icon: PenLine, label: "Testo" },
                { key: "ai" as const, icon: Sparkles, label: "Genera con AI" },
                { key: "file" as const, icon: Upload, label: "Allega file" },
              ]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setAssignMode(key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
                    assignMode === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Titolo *</Label>
                <Input placeholder="es. Esercizi sulle equazioni" value={assignTitle}
                  onChange={e => setAssignTitle(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipologia</Label>
                <Select value={assignType} onValueChange={setAssignType}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["esercizi", "verifica", "recupero", "potenziamento", "compito", "progetto"].map(t => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Scadenza</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 rounded-xl justify-start text-left font-normal", !assignDueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {assignDueDate ? format(assignDueDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={assignDueDate} onSelect={setAssignDueDate}
                      disabled={(date) => date < new Date()}
                      initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Mode-specific content */}
            {assignMode === "text" && (
              <div>
                <Label className="text-xs text-muted-foreground">Descrizione / Istruzioni</Label>
                <Textarea placeholder="Scrivi le istruzioni per gli studenti..." value={assignDesc}
                  onChange={e => setAssignDesc(e.target.value)} className="mt-1 rounded-xl min-h-[80px]" />
              </div>
            )}

            {assignMode === "ai" && (
              <div className="space-y-3">
                {/* Document context upload */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Carica un documento di riferimento (opzionale)</Label>
                  <input
                    ref={aiFileInputRef}
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
                      onClick={() => aiFileInputRef.current?.click()}
                      disabled={aiContextUploading}
                      className="w-full border border-dashed border-border rounded-xl p-3 text-center hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {aiContextUploading ? "Analisi in corso..." : "Foto o documento per contestualizzare"}
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
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Descrivi cosa vuoi generare</Label>
                  <Textarea
                    placeholder={aiContextFile
                      ? "Es: 'Genera una verifica basandoti sul documento caricato'"
                      : "Es: 'Crea 5 domande sul Risorgimento per una terza media, difficoltà media'"}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    className="mt-1 rounded-xl min-h-[60px]"
                  />
                </div>

                {/* Question type for verifica */}
                {assignType === "verifica" && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo di domande</Label>
                    <div className="flex gap-1.5">
                      {([
                        { key: "aperte" as const, label: "Aperte" },
                        { key: "chiuse" as const, label: "Chiuse" },
                        { key: "miste" as const, label: "Miste" },
                      ]).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setAiQuestionType(key)}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all border",
                            aiQuestionType === key
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Livello</Label>
                    <Select value={aiLivello} onValueChange={setAiLivello}>
                      <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="intermedio">Intermedio</SelectItem>
                        <SelectItem value="avanzato">Avanzato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">N. domande/elementi</Label>
                    <Input type="number" min={1} max={20} value={aiNumero}
                      onChange={e => setAiNumero(Number(e.target.value))} className="mt-1 rounded-xl" />
                  </div>
                </div>
                <Button onClick={generateAiContent} disabled={aiLoading} variant="outline" className="w-full rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  {aiLoading ? "Generazione in corso..." : "Genera contenuto"}
                </Button>
                {aiOutput && (
                  <div className="space-y-2">
                    <div className="bg-muted/50 border border-border rounded-xl p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {aiOutput}
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl w-full" onClick={() => exportToPdf(assignTitle || "Materiale", aiOutput, assignType)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Esporta in PDF
                    </Button>
                  </div>
                )}
              </div>
            )}

            {assignMode === "file" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Descrizione (opzionale)</Label>
                  <Textarea placeholder="Istruzioni per gli studenti..." value={assignDesc}
                    onChange={e => setAssignDesc(e.target.value)} className="mt-1 rounded-xl min-h-[60px]" />
                </div>
                <input
                  ref={fileInputRef}
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      {uploading ? "Caricamento..." : "Carica PDF, immagine o documento"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC (max 20MB)</p>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-xl">
                    <FileText className="w-8 h-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0" onClick={() => {
                      setUploadFile(null);
                      setUploadUrl(null);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Destinatari */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Destinatari</Label>
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant={assignTarget === "all" ? "default" : "outline"} className="rounded-xl text-xs"
                  onClick={() => setAssignTarget("all")}>Tutta la classe</Button>
                <Button size="sm" variant={assignTarget === "selected" ? "default" : "outline"} className="rounded-xl text-xs"
                  onClick={() => setAssignTarget("selected")}>Studenti specifici</Button>
              </div>
              {assignTarget === "selected" && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 space-y-1">
                  {students.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nessuno studente iscritto</p>
                  ) : students.map(s => {
                    const sid = s.student_id || s.id;
                    const checked = assignSelectedStudents.includes(sid);
                    return (
                      <label key={sid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setAssignSelectedStudents(prev => v ? [...prev, sid] : prev.filter(x => x !== sid));
                        }} />
                        <span className="text-sm">{s.profile?.name || s.name || "Studente"}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <Button className="w-full rounded-xl" onClick={handleAssignActivity} disabled={assignSaving}>
              <Send className="w-3.5 h-3.5 mr-1" />
              {assignSaving ? "Salvataggio..." : "Assegna attività"}
            </Button>
          </div>

          {/* === Sezione: Materiali salvati === */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Materiali salvati ({materials.length})
              </p>
              <div className="flex gap-1">
                {["tutti", "draft", "assigned"].map(f => (
                  <button
                    key={f}
                    onClick={() => setMaterialFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      materialFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f === "tutti" ? "Tutti" : f === "draft" ? "Bozze" : "Assegnati"}
                  </button>
                ))}
              </div>
            </div>
            {filteredMaterials.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <BookOpen className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nessun materiale salvato. I materiali generati con AI appariranno qui.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMaterials.map(m => (
                  <div key={m.id} className="flex items-center p-4 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {m.type && <Badge variant="secondary" className="text-xs">{m.type}</Badge>}
                        {m.level && <Badge variant="outline" className="text-xs">{m.level}</Badge>}
                        <Badge variant={m.status === "draft" ? "outline" : "default"} className="text-xs capitalize">{m.status}</Badge>
                      </div>
                    </div>
                    {m.content && (
                      <Button size="sm" variant="ghost" className="rounded-xl shrink-0" onClick={() => exportToPdf(m.title, m.content, m.type || "esercizi")}>
                        <Download className="w-3.5 h-3.5 mr-1" /> PDF
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Coach AI */}
        <TabsContent value="coach" className="mt-6">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">Coach AI per {classe.nome}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {students.length === 0
                ? "La classe è vuota ma puoi già generare materiali e pianificare attività."
                : "Chiedi consigli su questa classe, piani di recupero o strategie didattiche."
              }
            </p>
            <Button className="rounded-xl" onClick={() => navigate("/challenge/new")}>
              <MessageSquare className="w-4 h-4 mr-1" /> Apri il Coach AI
            </Button>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
