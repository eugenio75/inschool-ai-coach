import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Users, Heart, BookOpen, MessageSquare,
  Plus, Mail, Copy, Shield, AlertTriangle, CheckCircle2,
  FilePlus, Save, Trash2, Send, ChevronRight, FileText, BarChart2, Download,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

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

  // Material generation
  const [genArgomento, setGenArgomento] = useState("");
  const [genTipo, setGenTipo] = useState("esercizi");
  const [genLivello, setGenLivello] = useState("intermedio");
  const [genTarget, setGenTarget] = useState("");
  const [genNumero, setGenNumero] = useState(5);
  const [genFreeText, setGenFreeText] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genOutput, setGenOutput] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState("tutti");

  // Assign activity dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignType, setAssignType] = useState("esercizi");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDueDate, setAssignDueDate] = useState<Date | undefined>(undefined);
  const [assignTarget, setAssignTarget] = useState<"all" | "selected">("all");
  const [assignSelectedStudents, setAssignSelectedStudents] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

  function resetAssignForm() {
    setAssignTitle("");
    setAssignType("esercizi");
    setAssignDesc("");
    setAssignDueDate(undefined);
    setAssignTarget("all");
    setAssignSelectedStudents([]);
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

      const inserts = targetStudents.map(s => ({
        teacher_id: user.id,
        class_id: classId,
        student_id: s.student_id || s.id,
        title: assignTitle.trim(),
        type: assignType,
        subject: classe?.materia || null,
        description: assignDesc.trim() || null,
        due_date: assignDueDate ? assignDueDate.toISOString() : null,
      }));

      const { error } = await supabase.from("teacher_assignments").insert(inserts);
      if (error) throw error;

      toast.success(`Attività assegnata a ${targetStudents.length} studenti`);
      setAssignOpen(false);
      resetAssignForm();
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

  async function generateMaterial() {
    const prompt = genFreeText.trim() || genArgomento.trim();
    if (!prompt) { toast.error("Inserisci un argomento o una descrizione."); return; }
    setGenLoading(true);
    setGenOutput(null);
    try {
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
            maxTokens: 2000,
            systemPrompt: `Sei un docente esperto. Genera materiale didattico: ${genTipo}, livello ${genLivello}, ${genNumero} elementi. Classe: ${classe?.nome || ""}. Materia: ${classe?.materia || ""}. Target: ${genTarget || "generico"}.`,
            messages: [{ role: "user", content: genFreeText.trim() || `Genera ${genTipo} su: ${genArgomento}` }],
          }),
        }
      );
      const data = await res.json();
      setGenOutput(data.choices?.[0]?.message?.content?.trim() || "Errore nella generazione.");
    } catch {
      toast.error("Errore nella generazione.");
    } finally {
      setGenLoading(false);
    }
  }

  async function saveMaterial() {
    if (!genOutput || !user) return;
    await (supabase as any).from("teacher_materials").insert({
      teacher_id: user.id,
      class_id: classId,
      title: genArgomento || genFreeText.slice(0, 50) || "Materiale",
      subject: classe?.materia,
      type: genTipo,
      level: genLivello,
      target_profile: genTarget || null,
      content: genOutput,
      status: "draft",
    });
    toast.success("Materiale salvato!");
    loadClass();
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

  // Gradient per materia
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

      <div className="flex justify-end mb-4">
        <Button size="sm" className="rounded-xl" onClick={() => setAssignOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Assegna attività
        </Button>
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
                          {/* Student results */}
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
              {/* Traffic light */}
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
        <TabsContent value="materiali" className="mt-6 space-y-6">
          {/* Generation form */}
          <div className="bg-muted/50 border border-border rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Genera nuovo materiale</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Argomento</Label>
                <Input placeholder="es. Equazioni di secondo grado" value={genArgomento}
                  onChange={e => setGenArgomento(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipologia</Label>
                <Select value={genTipo} onValueChange={setGenTipo}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Verifica", "Esercizi", "Schema", "Spiegazione", "Recupero", "Potenziamento", "Altro"].map(t => (
                      <SelectItem key={t.toLowerCase()} value={t.toLowerCase()}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Livello</Label>
                <Select value={genLivello} onValueChange={setGenLivello}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="intermedio">Intermedio</SelectItem>
                    <SelectItem value="avanzato">Avanzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">N. domande/step</Label>
                <Input type="number" min={1} max={20} value={genNumero}
                  onChange={e => setGenNumero(Number(e.target.value))} className="mt-1 rounded-xl" />
              </div>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs text-muted-foreground">
                <span className="bg-muted/50 px-2">oppure</span>
              </div>
            </div>

            <Textarea
              placeholder="Descrivi liberamente cosa ti serve... Es: 'Crea 5 domande sul Risorgimento per una terza media, difficoltà media'"
              value={genFreeText}
              onChange={e => setGenFreeText(e.target.value)}
              className="rounded-xl min-h-[80px]"
            />

            <Button onClick={generateMaterial} disabled={genLoading} className="w-full rounded-xl mt-4">
              {genLoading ? "Generazione in corso..." : "Genera materiale"}
            </Button>

            {genOutput && (
              <div className="mt-4">
                <div className="bg-card border border-primary/20 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {genOutput}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" className="rounded-xl" onClick={saveMaterial}><Save className="w-3 h-3 mr-1" /> Salva</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(genOutput); toast.success("Copiato!"); }}>
                    <Copy className="w-3 h-3 mr-1" /> Copia
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
                    const printWin = window.open("", "_blank");
                    if (!printWin) { toast.error("Popup bloccato dal browser"); return; }
                    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${genArgomento || "Materiale"} - ${classe?.materia || ""}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.7;color:#1a1a1a}h1{font-size:1.4em;border-bottom:2px solid #1a3a5c;padding-bottom:8px;color:#1a3a5c}pre{white-space:pre-wrap;font-family:inherit;font-size:0.95em}footer{margin-top:40px;font-size:0.75em;color:#888;border-top:1px solid #ddd;padding-top:8px}</style></head><body><h1>${genArgomento || "Materiale didattico"}</h1><p style="color:#666;font-size:0.85em">${classe?.nome || ""} · ${classe?.materia || ""} · ${genTipo} · Livello: ${genLivello}</p><pre>${genOutput}</pre><footer>Generato con InSchool · ${new Date().toLocaleDateString("it-IT")}</footer></body></html>`);
                    printWin.document.close();
                    setTimeout(() => printWin.print(), 300);
                  }}>
                    <Download className="w-3 h-3 mr-1" /> Esporta PDF
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-xl" onClick={generateMaterial}>Rigenera</Button>
                </div>
              </div>
            )}
          </div>

          {/* Saved materials */}
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
                <p className="text-sm text-muted-foreground">Nessun materiale ancora. Generane uno sopra.</p>
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
