import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ArrowRight, ArrowLeft, Timer, Brain, Sliders, TrendingUp, 
  FileCheck, BookOpen, Calendar, Lightbulb, ClipboardCheck, 
  Search, Network, Mic, PenLine, FileText, FolderOpen, Home, 
  Users2, Building, FilePlus, CheckSquare, BarChart2, BookMarked, Mail, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import OnboardingLegacy from "./OnboardingLegacy";

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3 } },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0, transition: { duration: 0.3 } })
};

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>({});
  const [initialStep, setInitialStep] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    const check = async () => {
      const session = getChildSession();
      if (session?.profile) {
        setRole(session.profile.school_level);
        setProfileId(session.profile.id);
        const { data } = await (supabase.from as any)("user_preferences").select("*").eq("profile_id", session.profile.id).maybeSingle() as any;
        if (data && data.current_step !== undefined) {
           setInitialStep(data.current_step);
           setInitialData(data.data || {});
        }
      } else if (user) {
        // Genitore che arriva a /onboarding per errore → rimanda a profili figli
        navigate("/profiles");
      }
      setLoadingData(false);
    };
    check();
  }, [user, loading]);

  if (loading || loadingData) return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (["superiori", "universitario", "docente"].includes(role || "")) {
    return <OnboardingAdult role={role!} profileId={profileId!} initialStep={initialStep} initialData={initialData} />;
  }
  return <OnboardingLegacy />;
}

function OnboardingAdult({ role, profileId, initialStep, initialData }: any) {
    const navigate = useNavigate();
    const [step, setStep] = useState(initialStep);
    const [answers, setAnswers] = useState<any>(initialData || {});
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);
    const locationInputRef = useRef<HTMLInputElement>(null);
    const totalSteps = 6;

    useEffect(() => {
        let autocomplete: any = null;
        if (locationInputRef.current && (window as any).google) {
            autocomplete = new (window as any).google.maps.places.Autocomplete(locationInputRef.current, { types: ["school", "university"] });
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete?.getPlace();
                if (place?.name) {
                    const key = role === "superiori" ? "superiori_scuola" : role === "universitario" ? "uni_nome" : "docente_istituto";
                    setAnswers((prev: any) => ({ ...prev, [key]: place.name }));
                }
            });
        }
        return () => { if (autocomplete) (window as any).google.maps.event.clearInstanceListeners(autocomplete); }
    }, [step, role]);

    const handleNext = async () => {
        if (step < totalSteps - 1) {
            const nextStep = step + 1;
            setSaving(true);
            await (supabase.from as any)("user_preferences").upsert({
               profile_id: profileId, role: role, current_step: nextStep, data: answers
            });
            setSaving(false);
            setDirection(1);
            setStep(nextStep);
        } else {
            setSaving(true);
            await (supabase as any).from("user_preferences").upsert({
               profile_id: profileId, role: role, current_step: step, data: answers
            });
            await supabase.from("child_profiles").update({ onboarding_completed: true } as any).eq("id", profileId);
            setSaving(false);
            navigate("/dashboard");
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setDirection(-1);
            setStep(step - 1);
        }
    };

    const toggleArray = (key: string, val: string) => {
        setAnswers((prev: any) => {
            const arr = prev[key] || [];
            if (arr.includes(val)) return { ...prev, [key]: arr.filter((x: string) => x !== val) };
            return { ...prev, [key]: [...arr, val] };
        });
    };

    const toggleArrayMax = (key: string, val: string, max: number) => {
        setAnswers((prev: any) => {
            const arr = prev[key] || [];
            if (arr.includes(val)) return { ...prev, [key]: arr.filter((x: string) => x !== val) };
            if (arr.length >= max) return prev;
            return { ...prev, [key]: [...arr, val] };
        });
    };

    const canProceed = () => {
        if (role === "superiori") {
            if (step === 1) return answers.superiori_anno && answers.superiori_indirizzo;
            if (step === 2) return (answers.materie_critiche || []).length > 0;
            if (step === 3) return answers.metodo_studio;
            if (step === 4) return answers.obiettivo;
        } else if (role === "universitario") {
            if (step === 1) return answers.uni_facolta && answers.uni_anno;
            if (step === 3) return answers.metodo_studio;
            if (step === 4) return (answers.serve_ai || []).length > 0;
        } else if (role === "docente") {
            if (step === 1) return answers.docente_ordine;
            if (step === 2) return answers.docente_studenti;
            if (step === 3) return (answers.docente_uso || []).length > 0;
            if (step === 4) return (answers.docente_auto || []).length > 0;
        }
        return true; 
    };

    function renderSuperiori(step: number, answers: any, setAnswers: any, toggleMax: any, toggle: any, locRef: any) {
      switch (step) {
        case 0:
          return (
            <div className="text-center w-full">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Benvenuto in InSchool</h2>
                <p className="text-slate-500 mb-8">Configuriamo il tuo spazio di studio personale</p>
                <div className="w-24 h-24 mx-auto bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4"><BookOpen className="w-12 h-12" /></div>
            </div>
          );
        case 1:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-slate-900">Il tuo percorso scolastico</h2>
                <div className="space-y-4">
                   <select value={answers.superiori_anno || ""} onChange={e => setAnswers({...answers, superiori_anno: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 text-slate-800">
                      <option value="" disabled>Seleziona anno scolastico</option>
                      {["1ª", "2ª", "3ª", "4ª", "5ª Superiore"].map(a => <option key={a} value={a}>{a}</option>)}
                   </select>
                   <select value={answers.superiori_indirizzo || ""} onChange={e => setAnswers({...answers, superiori_indirizzo: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 text-slate-800">
                      <option value="" disabled>Seleziona indirizzo</option>
                      {["Scientifico", "Classico", "Linguistico", "Tecnico Economico", "Tecnico Tecnologico", "Professionale", "Artistico", "Altro"].map(a => <option key={a} value={a}>{a}</option>)}
                   </select>
                   <input ref={locRef} type="text" placeholder="Nome Scuola (Opzionale)" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 text-slate-800" defaultValue={answers.superiori_scuola || ""} />
                </div>
            </div>
          );
        case 2:
          const materie = answers.superiori_indirizzo === "Scientifico" ? ["Matematica", "Fisica", "Chimica", "Latino", "Inglese", "Storia", "Filosofia", "Informatica", "Scienze", "Arte"] : 
                          answers.superiori_indirizzo === "Classico" ? ["Greco", "Latino", "Italiano", "Matematica", "Fisica", "Storia", "Filosofia", "Arte", "Inglese"] :
                          ["Matematica", "Italiano", "Storia", "Inglese", "Scienze", "Fisica", "Chimica", "Economia", "Informatica", "Diritto", "Lingue"];
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-slate-900">Le tue materie critiche</h2>
                <p className="text-slate-500 text-sm">Seleziona le materie su cui vuoi concentrarti (max 5)</p>
                <div className="flex flex-wrap gap-2 mt-4">
                    {materie.map((m: string) => {
                       const isSel = (answers.materie_critiche || []).includes(m);
                       return <button key={m} onClick={() => toggleMax("materie_critiche", m, 5)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isSel ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{m}</button>;
                    })}
                </div>
            </div>
          );
        case 3:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-slate-900">Come studi meglio?</h2>
                <div className="space-y-3">
                   {[
                     { id: "pomodoro", title: "Sessioni brevi e frequenti", sub: "Pomodoro 25/5 min", icon: Timer },
                     { id: "deep", title: "Sessioni lunghe e immersive", sub: "Deep Work 50/10 min", icon: Brain },
                     { id: "flex", title: "Flexible", sub: "Imposto io i tempi", icon: Sliders }
                   ].map(opt => {
                     const isSel = answers.metodo_studio === opt.id;
                     return <button key={opt.id} onClick={() => setAnswers({...answers, metodo_studio: opt.id})} className={`w-full flex items-center p-4 rounded-2xl border transition-all ${isSel ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-6 h-6 mr-4 ${isSel ? "text-blue-600" : "text-slate-400"}`}/><div className="text-left"><p className={`font-bold ${isSel ? "text-blue-900" : "text-slate-800"}`}>{opt.title}</p><p className="text-sm text-slate-500">{opt.sub}</p></div></button>
                   })}
                </div>
            </div>
          );
        case 4:
          return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-slate-900">Il tuo obiettivo principale</h2>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { id: "lacune", title: "Recuperare lacune", icon: TrendingUp },
                     { id: "esami", title: "Prepararmi agli esami", icon: FileCheck },
                     { id: "approfondire", title: "Approfondire", icon: BookOpen },
                     { id: "organizzare", title: "Organizzazione", icon: Calendar }
                   ].map(opt => {
                     const isSel = answers.obiettivo === opt.id;
                     return <button key={opt.id} onClick={() => setAnswers({...answers, obiettivo: opt.id})} className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${isSel ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-8 h-8 mb-3 ${isSel ? "text-blue-600" : "text-slate-400"}`}/><span className={`font-bold text-sm text-center ${isSel ? "text-blue-900" : "text-slate-600"}`}>{opt.title}</span></button>
                   })}
                </div>
            </div>
          );
        case 5:
          return (
            <div className="text-left w-full space-y-6">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Tutto pronto!</h2>
                <p className="text-slate-500 mb-6">Ecco il tuo profilo accademico</p>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Percorso</span><p className="font-medium text-slate-800">{answers.superiori_anno} {answers.superiori_indirizzo}</p></div>
                    <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Materie Focus</span><p className="font-medium text-slate-800">{(answers.materie_critiche || []).join(", ")}</p></div>
                    <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metodo</span><p className="font-medium text-slate-800">{answers.metodo_studio === "pomodoro" ? "Pomodoro" : answers.metodo_studio === "deep" ? "Deep Work" : "Flessibile"}</p></div>
                </div>
            </div>
          );
      }
    }

    function renderUniversitario(step: number, answers: any, setAnswers: any, toggleMax: any, toggle: any, locRef: any) {
        switch (step) {
            case 0:
              return (
                <div className="text-center w-full">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Benvenuto in InSchool</h2>
                    <p className="text-slate-500 mb-8">Configuriamo il tuo spazio di studio personale</p>
                    <div className="w-24 h-24 mx-auto bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4"><BookOpen className="w-12 h-12" /></div>
                </div>
              );
            case 1:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Il tuo percorso universitario</h2>
                    <div className="space-y-4">
                       <input ref={locRef} type="text" placeholder="Nome Università" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-indigo-500 text-slate-800" defaultValue={answers.uni_nome || ""} />
                       <select value={answers.uni_facolta || ""} onChange={e => setAnswers({...answers, uni_facolta: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-indigo-500 text-slate-800">
                          <option value="" disabled>Seleziona Facoltà</option>
                          {["Medicina", "Ingegneria", "Economia", "Giurisprudenza", "Lettere", "Psicologia", "Architettura", "Scienze", "Farmacia", "Scienze Politiche", "Informatica", "Matematica", "Fisica", "Chimica", "Biologia", "Altro"].map(a => <option key={a} value={a}>{a}</option>)}
                       </select>
                       <select value={answers.uni_anno || ""} onChange={e => setAnswers({...answers, uni_anno: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-indigo-500 text-slate-800">
                          <option value="" disabled>Seleziona Anno</option>
                          {["1°", "2°", "3°", "Fuori corso", "Magistrale 1°", "Magistrale 2°", "Dottorato"].map(a => <option key={a} value={a}>{a}</option>)}
                       </select>
                       <input type="text" placeholder="Corso di laurea (Es. Ingegneria Aerospaziale)" value={answers.uni_corso || ""} onChange={e => setAnswers({...answers, uni_corso: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-indigo-500 text-slate-800" />
                    </div>
                </div>
              );
            case 2:
              const tempEsami = answers.uni_esami || [];
              const handleAddEsame = (e: any) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const nm = (form.elements.namedItem("nome") as HTMLInputElement).value;
                  const dt = (form.elements.namedItem("data") as HTMLInputElement).value;
                  if (nm && tempEsami.length < 5) {
                      setAnswers({...answers, uni_esami: [...tempEsami, {nome: nm, data: dt}]});
                      form.reset();
                  }
              };
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Esami in vista</h2>
                    <p className="text-slate-500 text-sm">Aggiungi gli esami che devi sostenere nei prossimi mesi (Max 5)</p>
                    <form onSubmit={handleAddEsame} className="flex gap-2">
                        <input name="nome" type="text" placeholder="Es. Analisi II" className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm" required />
                        <input name="data" type="date" className="p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm text-slate-600" />
                        <Button type="submit" disabled={tempEsami.length >= 5} className="bg-indigo-600 text-white rounded-xl">Add</Button>
                    </form>
                    {tempEsami.map((es: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 border border-slate-100 bg-slate-50 rounded-xl">
                            <span className="font-medium text-slate-800">{es.nome}</span>
                            <div className="flex items-center gap-3 text-slate-500 text-sm">
                                <span>{es.data}</span>
                                <button onClick={() => setAnswers({...answers, uni_esami: tempEsami.filter((_:any,idx:number)=>idx!==i)})} className="text-red-400 hover:text-red-600">x</button>
                            </div>
                        </div>
                    ))}
                </div>
              );
            case 3:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Metodologia di studio</h2>
                    <div className="space-y-3">
                       {[
                         { id: "pomodoro", title: "Pomodoro Tecnica", sub: "Timer 25/5 min", icon: Timer },
                         { id: "deep", title: "Deep Work", sub: "Sessioni 1h+", icon: Brain },
                         { id: "misto", title: "Misto", sub: "Flessibile", icon: Sliders },
                         { id: "nessuno", title: "Non ho un metodo fisso", sub: "Suggerisci tu", icon: Lightbulb }
                       ].map(opt => {
                         const isSel = answers.metodo_studio === opt.id;
                         return <button key={opt.id} onClick={() => setAnswers({...answers, metodo_studio: opt.id})} className={`w-full flex items-center p-4 rounded-2xl border transition-all ${isSel ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-6 h-6 mr-4 ${isSel ? "text-indigo-600" : "text-slate-400"}`}/><div className="text-left"><p className={`font-bold ${isSel ? "text-indigo-900" : "text-slate-800"}`}>{opt.title}</p><p className="text-sm text-slate-500">{opt.sub}</p></div></button>
                       })}
                    </div>
                </div>
              );
            case 4:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Cosa ti serve di più dall'AI?</h2>
                    <p className="text-slate-500 text-sm">Seleziona max 3 opzioni</p>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { id: "spiegazione", title: "Spiegare concetti", icon: Lightbulb },
                         { id: "ripasso", title: "Ripasso e quiz", icon: ClipboardCheck },
                         { id: "ricerca", title: "Supporto ricerca", icon: Search },
                         { id: "schemi", title: "Schemi e mappe", icon: Network },
                         { id: "orale", title: "Simulazione orale", icon: Mic },
                         { id: "correzione", title: "Revisione paper", icon: PenLine },
                       ].map(opt => {
                         const isSel = (answers.serve_ai || []).includes(opt.id);
                         return <button key={opt.id} onClick={() => toggleMax("serve_ai", opt.id, 3)} className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${isSel ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-6 h-6 mb-2 ${isSel ? "text-indigo-600" : "text-slate-400"}`}/><span className={`font-medium text-xs text-center ${isSel ? "text-indigo-900" : "text-slate-600"}`}>{opt.title}</span></button>
                       })}
                    </div>
                </div>
              );
            case 5:
              return (
                <div className="text-left w-full space-y-6">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Tutto pronto!</h2>
                    <p className="text-slate-500 mb-6">Ecco il tuo profilo Universitario</p>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
                        <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Laurea</span><p className="font-medium text-slate-800">{answers.uni_anno} {answers.uni_facolta}</p></div>
                        {answers.uni_corso && <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Corso di laurea</span><p className="font-medium text-slate-800">{answers.uni_corso}</p></div>}
                        <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skill IA</span><p className="font-medium text-slate-800">{(answers.serve_ai || []).join(", ")}</p></div>
                        <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Esami tracciati</span><p className="font-medium text-slate-800">{(answers.uni_esami || []).length} inseriti</p></div>
                    </div>
                </div>
              );
        }
    }

    function renderDocente(step: number, answers: any, setAnswers: any, toggleMax: any, toggle: any, locRef: any) {
        switch (step) {
            case 0:
              return (
                <div className="text-center w-full">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Benvenuto Docente</h2>
                    <p className="text-slate-500 mb-8">Il tuo assistente didattico intelligente</p>
                    <div className="w-24 h-24 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4"><Users className="w-12 h-12" /></div>
                </div>
              );
            case 1:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Il tuo ruolo</h2>
                    <div className="space-y-4">
                       <select value={answers.docente_ordine || ""} onChange={e => setAnswers({...answers, docente_ordine: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-emerald-500 text-slate-800">
                          <option value="" disabled>Ordine scolastico</option>
                          {["Scuola Primaria", "Scuola Secondaria I grado", "Scuola Secondaria II grado", "Università", "Formazione Professionale"].map(a => <option key={a} value={a}>{a}</option>)}
                       </select>
                       <input ref={locRef} type="text" placeholder="Nome Istituto" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-emerald-500 text-slate-800" defaultValue={answers.docente_istituto || ""} />
                    </div>
                </div>
              );
            case 2:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Quanti studenti gestisci?</h2>
                    <div className="space-y-3">
                       {[
                         { id: "s30", title: "Fino a 30 studenti", icon: Users },
                         { id: "s100", title: "Da 30 a 100 studenti", icon: Users2 },
                         { id: "l100", title: "Più di 100 studenti", icon: Building }
                       ].map(opt => {
                         const isSel = answers.docente_studenti === opt.id;
                         return <button key={opt.id} onClick={() => setAnswers({...answers, docente_studenti: opt.id})} className={`w-full flex items-center p-4 rounded-2xl border transition-all ${isSel ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-6 h-6 mr-4 ${isSel ? "text-emerald-600" : "text-slate-400"}`}/><p className={`font-bold ${isSel ? "text-emerald-900" : "text-slate-800"}`}>{opt.title}</p></button>
                       })}
                    </div>
                </div>
              );
            case 3:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Cosa usi di più in classe?</h2>
                    <p className="text-slate-500 text-sm">Seleziona max 4 opzioni</p>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { id: "verifiche", title: "Verifiche scritte", icon: FileText },
                         { id: "orali", title: "Interrogazioni", icon: Mic },
                         { id: "progetti", title: "Progetti", icon: FolderOpen },
                         { id: "compiti", title: "Compiti a casa", icon: Home },
                         { id: "gruppi", title: "Lavori di gruppo", icon: Users2 },
                       ].map(opt => {
                         const isSel = (answers.docente_uso || []).includes(opt.id);
                         return <button key={opt.id} onClick={() => toggleMax("docente_uso", opt.id, 4)} className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${isSel ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-6 h-6 mb-2 ${isSel ? "text-emerald-600" : "text-slate-400"}`}/><span className={`font-medium text-xs text-center ${isSel ? "text-emerald-900" : "text-slate-600"}`}>{opt.title}</span></button>
                       })}
                    </div>
                </div>
              );
            case 4:
              return (
                <div className="w-full space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Cosa vuoi automatizzare?</h2>
                    <p className="text-slate-500 text-sm">Seleziona max 3 opzioni</p>
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { id: "generare", title: "Generare prove", icon: FilePlus },
                         { id: "correzione", title: "Correzione auto", icon: CheckSquare },
                         { id: "statistiche", title: "Statistiche", icon: BarChart2 },
                         { id: "materiali", title: "Materiali didattici", icon: BookMarked },
                         { id: "comunicazioni", title: "Comunicazioni", icon: Mail },
                       ].map(opt => {
                         const isSel = (answers.docente_auto || []).includes(opt.id);
                         return <button key={opt.id} onClick={() => toggleMax("docente_auto", opt.id, 3)} className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${isSel ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 hover:bg-slate-50"}`}><opt.icon className={`w-6 h-6 mb-2 ${isSel ? "text-emerald-600" : "text-slate-400"}`}/><span className={`font-medium text-xs text-center ${isSel ? "text-emerald-900" : "text-slate-600"}`}>{opt.title}</span></button>
                       })}
                    </div>
                </div>
              );
            case 5:
              return (
                <div className="text-left w-full space-y-6">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Tutto pronto!</h2>
                    <p className="text-slate-500 mb-6">Il tuo cruscotto didattico ti attende</p>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
                        <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classe</span><p className="font-medium text-slate-800">{answers.docente_ordine}</p></div>
                        <div><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Automazioni IA</span><p className="font-medium text-slate-800">{(answers.docente_auto || []).join(", ")}</p></div>
                    </div>
                </div>
              );
        }
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative overflow-x-hidden font-sans">
        <div className="absolute top-0 w-full p-6 z-20">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <span className="font-display font-bold text-slate-800 text-lg">InSchool Onboarding</span>
                <span className="text-sm font-medium text-slate-400">Step {step + 1} di {totalSteps}</span>
            </div>
            <div className="max-w-2xl mx-auto mt-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <motion.div className="h-full bg-blue-600 rounded-full" animate={{ width: `${((step + 1) / totalSteps) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>
        </div>

        <div className="flex-1 w-full relative flex items-center justify-center px-4 pt-24 pb-32">
            <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                    key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
                    className="w-full max-w-2xl absolute flex flex-col items-center justify-center p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100"
                >
                    {role === "superiori" && renderSuperiori(step, answers, setAnswers, toggleArrayMax, toggleArray, locationInputRef)}
                    {role === "universitario" && renderUniversitario(step, answers, setAnswers, toggleArrayMax, toggleArray, locationInputRef)}
                    {role === "docente" && renderDocente(step, answers, setAnswers, toggleArrayMax, toggleArray, locationInputRef)}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-6 z-20">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack} disabled={step === 0 || saving} className="text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-800 rounded-xl">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
                </Button>
                <Button onClick={handleNext} disabled={!canProceed() || saving} className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl px-8 font-bold shadow-sm transition-all h-12">
                    {step === totalSteps - 1 ? (saving ? "Salvataggio..." : "Inizia") : "Avanti"} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
            </div>
        </div>
      </div>
    );
}
