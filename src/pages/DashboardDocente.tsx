import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, Plus, FilePlus, BarChart2, BookMarked, CheckSquare,
  FileText, Mic, FolderOpen, Home, Users2, Bell, Copy,
  Minus, Printer, ChevronRight, Trash2, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RecentConversations } from "@/components/shared/RecentConversations";
import { LogoutButton } from "@/components/shared/LogoutButton";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default function DashboardDocente() {
  const navigate = useNavigate();
  
  const session = getChildSession();
  const profile = session?.profile;
  const profileId = session?.profileId;

  const [onboarding, setOnboarding] = useState<any>({});
  const [classi, setClassi] = useState<any[]>([]);
  const [loadingClassi, setLoadingClassi] = useState(true);
  const [verificheCount, setVerificheCount] = useState(0);
  const [verificheSalvate, setVerificheSalvate] = useState<any[]>([]);
  const [loadingVerifiche, setLoadingVerifiche] = useState(true);
  const [verificaPreview, setVerificaPreview] = useState<any>(null);
  const [deleteVerificaId, setDeleteVerificaId] = useState<string | null>(null);

  // Nuova classe modal
  const [showClasseModal, setShowClasseModal] = useState(false);
  const [newClasse, setNewClasse] = useState({ nome: "", materia: "", ordine_scolastico: "", num_studenti: "" });
  const [savingClasse, setSavingClasse] = useState(false);
  const [classeCreata, setClasseCreata] = useState<any>(null);

  // Generatore verifiche
  const [genMateria, setGenMateria] = useState("");
  const [genArgomento, setGenArgomento] = useState("");
  const [genTipo, setGenTipo] = useState<string>("misto");
  const [genNumero, setGenNumero] = useState(10);
  const [genDifficolta, setGenDifficolta] = useState<string>("medio");
  const [genLoading, setGenLoading] = useState(false);
  const [genOutput, setGenOutput] = useState<string | null>(null);
  const [genError, setGenError] = useState(false);
  const [savingVerifica, setSavingVerifica] = useState(false);

  const od = onboarding;
  const materie: string[] = od?.docente_materie || [];
  const ordine: string = od?.docente_ordine || "";
  const istituto: string = od?.docente_istituto || "";
  const cognome = profile?.name?.split(" ").slice(-1)[0] || profile?.name || "";

  useEffect(() => { if (!profileId) return; loadAll(); }, [profileId]);

  async function loadAll() {
    setLoadingClassi(true);
    setLoadingVerifiche(true);
    try {
      const { data: prefs } = await (supabase as any)
        .from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
      setOnboarding(prefs?.data || {});

      const { data: c } = await (supabase as any)
        .from("classi").select("*").eq("docente_profile_id", profileId)
        .order("created_at", { ascending: false });
      setClassi(c || []);

      const { count } = await (supabase as any)
        .from("verifiche").select("id", { count: "exact", head: true })
        .eq("docente_profile_id", profileId);
      setVerificheCount(count || 0);

      const { data: v } = await (supabase as any)
        .from("verifiche").select("*").eq("docente_profile_id", profileId)
        .order("created_at", { ascending: false }).limit(5);
      setVerificheSalvate(v || []);
    } finally {
      setLoadingClassi(false);
      setLoadingVerifiche(false);
    }
  }

  async function saveClasse() {
    if (!newClasse.nome.trim() || !profileId) return;
    setSavingClasse(true);
    const { data, error } = await (supabase as any)
      .from("classi").insert({
        docente_profile_id: profileId,
        nome: newClasse.nome,
        materia: newClasse.materia || null,
        ordine_scolastico: newClasse.ordine_scolastico || ordine || null,
        num_studenti: newClasse.num_studenti ? parseInt(newClasse.num_studenti) : 0,
      }).select().single();
    setSavingClasse(false);
    if (!error && data) {
      setClasseCreata(data);
      setNewClasse({ nome: "", materia: "", ordine_scolastico: "", num_studenti: "" });
      loadAll();
    } else {
      toast.error("Errore nella creazione della classe.");
    }
  }

  async function generateVerifica() {
    if (!genArgomento.trim()) { toast.error("Inserisci un argomento."); return; }
    setGenLoading(true);
    setGenOutput(null);
    setGenError(false);
    const tipoLabel = { multipla: "risposta multipla", aperta: "domande aperte", vero_falso: "vero/falso", misto: "misto" }[genTipo] || genTipo;
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
            systemPrompt: `Sei un professore esperto di ${genMateria || "materia"} per ${ordine || "scuola secondaria"}. Genera una verifica completa e professionale su: ${genArgomento}. Struttura: ${genNumero} domande di tipo ${tipoLabel}, difficoltà ${genDifficolta}. Per ogni domanda fornisci: il testo, le opzioni di risposta (se multipla o vero/falso), la risposta corretta e una breve spiegazione. Formatta in modo chiaro con numerazione progressiva. Usa un linguaggio formale e appropriato al livello scolastico.`,
            messages: [{ role: "user", content: "Genera la verifica." }],
          }),
        }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGenOutput(data.choices?.[0]?.message?.content?.trim() || null);
    } catch {
      setGenError(true);
    } finally {
      setGenLoading(false);
    }
  }

  async function saveVerifica() {
    if (!genOutput || !profileId) return;
    setSavingVerifica(true);
    const { error } = await (supabase as any).from("verifiche").insert({
      docente_profile_id: profileId,
      materia: genMateria || null,
      argomento: genArgomento,
      contenuto: genOutput,
      tipo: genTipo,
      difficolta: genDifficolta,
      numero_domande: genNumero,
    });
    setSavingVerifica(false);
    if (!error) {
      toast.success("Verifica salvata!");
      setVerificheCount(c => c + 1);
    } else {
      toast.error("Errore nel salvataggio.");
    }
  }

  function copyVerifica() {
    if (!genOutput) return;
    navigator.clipboard.writeText(genOutput);
    toast.success("Verifica copiata negli appunti!");
  }

  function printVerifica() {
    const el = document.getElementById("verifica-preview");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Verifica — ${genArgomento}</title><style>body{font-family:serif;max-width:720px;margin:40px auto;line-height:1.7;font-size:14px;}h1{font-size:18px;margin-bottom:4px;}p{margin:8px 0;}</style></head><body><h1>Verifica: ${genArgomento}</h1><hr/>${el.innerText.replace(/\n/g, "<br/>")}</body></html>`);
    w.document.close();
    w.print();
  }

  function printSavedVerifica(v: any) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Verifica — ${v.argomento}</title><style>body{font-family:serif;max-width:720px;margin:40px auto;line-height:1.7;font-size:14px;}h1{font-size:18px;margin-bottom:4px;}p{margin:8px 0;}</style></head><body><h1>Verifica: ${v.argomento}</h1><hr/>${(v.contenuto || "").replace(/\n/g, "<br/>")}</body></html>`);
    w.document.close();
    w.print();
  }

  async function deleteVerifica(id: string) {
    await (supabase as any).from("verifiche").delete().eq("id", id);
    setVerificheSalvate(prev => prev.filter(v => v.id !== id));
    setVerificheCount(c => c - 1);
    setDeleteVerificaId(null);
    toast.success("Verifica eliminata.");
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {getGreeting()}, Prof. {cognome}
            </h1>
            {(materie.length > 0 || istituto) && (
              <p className="text-muted-foreground mt-1 text-sm">
                {[materie.slice(0, 3).join(", "), istituto].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {[
                { label: `${classi.length} classi attive`, icon: <Users className="w-3.5 h-3.5" /> },
                { label: `${verificheCount} verifiche generate`, icon: <FileText className="w-3.5 h-3.5" /> },
              ].map((k, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5">
                  <span className="text-primary">{k.icon}</span>{k.label}
                </div>
              ))}
            </div>
          </div>
          <LogoutButton showLabel />
        </motion.div>

        {/* CLASSI */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Le tue classi</h2>
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl"
              onClick={() => setShowClasseModal(true)}>
              <Plus className="w-3 h-3 mr-1" />Nuova classe
            </Button>
          </div>
          {loadingClassi ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : classi.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Non hai ancora creato nessuna classe</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Crea la prima classe e condividi il codice con i tuoi studenti
              </p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl text-xs"
                onClick={() => setShowClasseModal(true)}>
                <Plus className="w-3 h-3 mr-1" />Crea la prima classe
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {classi.map((cl, i) => (
                <motion.div key={cl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-foreground text-lg">{cl.nome}</p>
                      {cl.materia && <Badge variant="secondary" className="mt-1">{cl.materia}</Badge>}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />{cl.num_studenti} studenti
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Creata il {format(new Date(cl.created_at), "d MMM yyyy", { locale: it })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Codice</p>
                      <span className="font-mono font-bold text-foreground bg-muted px-2 py-1 rounded-lg text-sm">
                        {cl.codice_invito}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3 w-full rounded-xl text-xs text-muted-foreground"
                    onClick={() => { navigator.clipboard.writeText(cl.codice_invito); toast.success("Codice copiato!"); }}>
                    <Copy className="w-3 h-3 mr-1" />Copia codice invito
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* GENERATORE VERIFICHE */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
            <FilePlus className="w-4 h-4 text-primary" /> Generatore Verifiche con AI
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Materia</Label>
              {materie.length > 0 ? (
                <Select value={genMateria} onValueChange={setGenMateria}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona materia" /></SelectTrigger>
                  <SelectContent>{materie.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input placeholder="es. Matematica, Fisica..." value={genMateria}
                  onChange={e => setGenMateria(e.target.value)} className="rounded-xl" />
              )}
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Argomento *</Label>
              <Input placeholder="es. Seconda legge della termodinamica" value={genArgomento}
                onChange={e => setGenArgomento(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Tipo domande</Label>
              <Select value={genTipo} onValueChange={setGenTipo}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="multipla">Risposta multipla</SelectItem>
                  <SelectItem value="aperta">Domande aperte</SelectItem>
                  <SelectItem value="vero_falso">Vero e Falso</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Numero domande</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl"
                  onClick={() => setGenNumero(n => Math.max(5, n - 1))}><Minus className="w-3 h-3" /></Button>
                <span className="flex-1 text-center font-semibold text-slate-800">{genNumero}</span>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl"
                  onClick={() => setGenNumero(n => Math.min(20, n + 1))}><Plus className="w-3 h-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Difficoltà</Label>
              <Select value={genDifficolta} onValueChange={setGenDifficolta}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facile">Facile</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="difficile">Difficile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={generateVerifica} disabled={!genArgomento.trim() || genLoading}
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold">
            {genLoading ? "Generazione in corso..." : "Genera con AI"}
          </Button>

          {/* OUTPUT VERIFICA */}
          {genLoading && (
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-4 w-full" />)}
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          {genError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              Impossibile generare la verifica. Verifica la connessione e riprova.
              <button onClick={generateVerifica} className="underline ml-2">Riprova</button>
            </div>
          )}
          {genOutput && (
            <div className="mt-4">
              <div id="verifica-preview"
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">
                {genOutput}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={saveVerifica} disabled={savingVerifica}>
                  {savingVerifica ? "Salvataggio..." : "Salva verifica"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={copyVerifica}>
                  <Copy className="w-3 h-3 mr-1" />Copia testo
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={printVerifica}>
                  <Printer className="w-3 h-3 mr-1" />Stampa / PDF
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl text-slate-500" onClick={generateVerifica}>
                  Rigenera
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* VERIFICHE SALVATE */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Verifiche salvate</h2>
          {loadingVerifiche ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : verificheSalvate.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
              <FileText className="w-7 h-7 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nessuna verifica salvata ancora</p>
            </div>
          ) : (
            <div className="space-y-2">
              {verificheSalvate.map(v => (
                <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{v.argomento}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {v.materia && <Badge variant="secondary" className="text-xs">{v.materia}</Badge>}
                      {v.tipo && <span className="text-xs text-slate-400">{v.tipo}</span>}
                      <span className="text-xs text-slate-400">
                        {format(new Date(v.created_at), "d MMM", { locale: it })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => setVerificaPreview(v)}>
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => printSavedVerifica(v)}>
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => setDeleteVerificaId(v.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ATTIVITA STUDENTI */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-purple-600" /> Attività studenti
          </h2>
          <div className="flex flex-col items-center py-6 text-center">
            <Bell className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Collega i tuoi studenti alle classi condividendo il codice invito. Quando saranno attivi, 
              vedrai qui il loro andamento in tempo reale.
            </p>
          </div>
        </section>

        {/* CONVERSAZIONI RECENTI */}
        <RecentConversations profileId={profileId} title="Le tue sessioni con il Coach AI" />

      </div>

      {/* DIALOG — NUOVA CLASSE */}
      <Dialog open={showClasseModal && !classeCreata} onOpenChange={v => { setShowClasseModal(v); if (!v) setClasseCreata(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Nuova Classe</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome classe *</Label>
              <Input placeholder="es. 3A, 4B, 5C..." value={newClasse.nome}
                onChange={e => setNewClasse(p => ({ ...p, nome: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Materia</Label>
              {materie.length > 0 ? (
                <Select value={newClasse.materia} onValueChange={v => setNewClasse(p => ({ ...p, materia: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Seleziona materia" /></SelectTrigger>
                  <SelectContent>{materie.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input placeholder="es. Matematica" value={newClasse.materia}
                  onChange={e => setNewClasse(p => ({ ...p, materia: e.target.value }))} className="mt-1 rounded-xl" />
              )}
            </div>
            <div>
              <Label>Ordine scolastico</Label>
              <Select value={newClasse.ordine_scolastico} onValueChange={v => setNewClasse(p => ({ ...p, ordine_scolastico: v }))}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder={ordine || "Seleziona..."} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scuola Primaria">Scuola Primaria</SelectItem>
                  <SelectItem value="Scuola Secondaria I grado">Scuola Secondaria I grado</SelectItem>
                  <SelectItem value="Scuola Secondaria II grado">Scuola Secondaria II grado</SelectItem>
                  <SelectItem value="Università">Università</SelectItem>
                  <SelectItem value="Formazione Professionale">Formazione Professionale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero studenti</Label>
              <Input type="number" min="0" placeholder="es. 25" value={newClasse.num_studenti}
                onChange={e => setNewClasse(p => ({ ...p, num_studenti: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClasseModal(false)} className="rounded-xl">Annulla</Button>
            <Button onClick={saveClasse} disabled={!newClasse.nome.trim() || savingClasse}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white">
              {savingClasse ? "Creazione..." : "Crea classe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG — CLASSE CREATA CON CODICE */}
      <Dialog open={!!classeCreata} onOpenChange={() => { setClasseCreata(null); setShowClasseModal(false); }}>
        <DialogContent className="rounded-2xl text-center">
          <CheckSquare className="w-10 h-10 text-green-500 mx-auto mt-2" />
          <DialogHeader><DialogTitle className="text-center mt-2">Classe creata!</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Condividi questo codice con i tuoi studenti</p>
          <div className="bg-slate-100 rounded-2xl py-5 px-4 my-2">
            <p className="font-mono font-black text-4xl tracking-[0.3em] text-slate-900">
              {classeCreata?.codice_invito}
            </p>
          </div>
          <Button className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => {
              navigator.clipboard.writeText(classeCreata?.codice_invito);
              toast.success("Codice copiato!");
              setClasseCreata(null);
              setShowClasseModal(false);
            }}>
            <Copy className="w-4 h-4 mr-2" />Copia codice e chiudi
          </Button>
        </DialogContent>
      </Dialog>

      {/* DIALOG — PREVIEW VERIFICA */}
      <Dialog open={!!verificaPreview} onOpenChange={() => setVerificaPreview(null)}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{verificaPreview?.argomento}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono bg-slate-50 rounded-xl p-4 border border-slate-200">
            {verificaPreview?.contenuto}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { printSavedVerifica(verificaPreview); }}>
              <Printer className="w-3.5 h-3.5 mr-1.5" />Stampa
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(verificaPreview?.contenuto || ""); toast.success("Copiato!"); }}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />Copia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG — ELIMINA VERIFICA */}
      <Dialog open={!!deleteVerificaId} onOpenChange={() => setDeleteVerificaId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Eliminare la verifica?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Questa azione non può essere annullata.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteVerificaId(null)} className="rounded-xl">Annulla</Button>
            <Button variant="destructive" onClick={() => deleteVerificaId && deleteVerifica(deleteVerificaId)} className="rounded-xl">
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
