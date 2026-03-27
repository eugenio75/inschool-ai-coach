import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Mic, MicOff, Loader2, FileText, CheckCircle, AlertTriangle, Target, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { MathText } from "@/components/shared/MathText";
import { useLang } from "@/contexts/LangContext";
import { getPrepLabelKey } from "@/lib/schoolTerms";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExamPlan {
  examName: string;
  daysLeft: number;
  chaptersTotal: number;
  chaptersPerDay: number;
  todayChapter: number;
  todayLabel: string;
}

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

// getPrepLabel now uses i18n — see usage below

function getSchoolLevelPrompt(schoolLevel: string, mode: string, subject: string, weaknessContext: string): string {
  const modeLabel = mode === "orale" ? "interrogazione orale" : "verifica scritta";

  const baseInstructions = `Stai simulando una ${modeLabel} su ${subject}. Dopo ogni risposta valuta brevemente e passa alla domanda successiva. Dopo 5-7 domande, scrivi [SIMULAZIONE_COMPLETATA] e genera un report JSON: {"strengths":["..."],"weaknesses":["..."],"priorities":["..."]}`;

  const weaknessBlock = weaknessContext
    ? `\n\nDATI SULLE LACUNE DELLO STUDENTE — concentra le domande su queste aree deboli:\n${weaknessContext}`
    : "";

  switch (schoolLevel) {
    case "alunno":
    case "elementari":
      return `${baseInstructions}

PROFILO: Studente di scuola elementare (6-10 anni).
TONO: Caldo e incoraggiante. Usa emoji nel testo. Dopo ogni risposta incoraggia sempre lo studente.
DOMANDE: Brevissime, parole semplici, una cosa per volta. Nessun termine tecnico — se necessario spiegalo in modo semplice.
COMPLESSITÀ: Minima. Domande dirette con risposte brevi.
ESEMPIO: "🌟 Bravissimo! Ora dimmi: come si chiama il luogo dove vivono i pesci? 🐟"${weaknessBlock}`;

    case "medie":
      return `${baseInstructions}

PROFILO: Studente di scuola media (11-13 anni).
TONO: Amichevole e motivante. Riconosci i progressi senza essere infantile.
DOMANDE: Chiare e dirette, complessità moderata. Usa termini base della materia con spiegazione semplice se necessario.
COMPLESSITÀ: Media. Domande che richiedono una risposta articolata ma non troppo complessa.${weaknessBlock}`;

    case "superiori":
      return `${baseInstructions}

PROFILO: Studente di scuola superiore (14-18 anni).
TONO: Diretto e orientato al metodo. Rispetta l'autonomia dello studente.
DOMANDE: Coprono sia verifica scritta che interrogazione orale. Domande di ragionamento e applicazione — non solo definizioni. Chiedi connessioni tra concetti.
COMPLESSITÀ: Alta. Richiedi analisi, confronti, applicazioni pratiche.${weaknessBlock}`;

    case "universitario":
      return `${baseInstructions}

PROFILO: Studente universitario.
TONO: Sobrio ed essenziale. Nessun incoraggiamento infantile. Dialogo alla pari.
DOMANDE: Terminologia tecnica specifica della materia. Comprensione profonda, analisi e sintesi. Complessità massima.
COMPLESSITÀ: Massima. Domande che richiedono padronanza della materia, capacità di sintesi e ragionamento critico.${weaknessBlock}`;

    default:
      return `${baseInstructions}${weaknessBlock}`;
  }
}

function formatTimeRemaining(daysLeft: number): string {
  if (daysLeft <= 0) return "La prova è oggi!";
  if (daysLeft === 1) return "Manca 1 giorno alla prova";
  if (daysLeft < 1) {
    const hours = Math.round(daysLeft * 24);
    return `Mancano circa ${hours} ore alla prova`;
  }
  return `Mancano ${daysLeft} giorni alla prova`;
}

export default function PrepSession() {
  const navigate = useNavigate();
  const { subject: paramSubject } = useParams();
  const { user } = useAuth();
  const { t } = useLang();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";

  const [step, setStep] = useState<"setup" | "simulation" | "report">("setup");
  const [subject, setSubject] = useState(paramSubject || "");
  const [mode, setMode] = useState<"scritta" | "orale">("scritta");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [report, setReport] = useState<{ strengths: string[]; weaknesses: string[]; priorities: string[] } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [weaknessContext, setWeaknessContext] = useState("");
  const [examPlan, setExamPlan] = useState<ExamPlan | null>(null);
  const [examDate, setExamDate] = useState<string>("");
  const [daysToExam, setDaysToExam] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const subjects = profile?.favorite_subjects || profile?.difficult_subjects || ["Matematica", "Italiano", "Inglese", "Storia", "Scienze"];
  const prepLabel = t(getPrepLabelKey(schoolLevel));
  const isUniversity = schoolLevel === "universitario";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Load weakness data when subject changes
  useEffect(() => {
    if (!subject || !profile?.id) { setWeaknessContext(""); return; }
    loadWeaknessData(subject, profile.id);
  }, [subject, profile?.id]);

  // Load exam plan for university
  useEffect(() => {
    if (!isUniversity || !subject || !profile?.id) return;
    loadExamPlan(subject, profile.id);
  }, [isUniversity, subject, profile?.id]);

  async function loadWeaknessData(subj: string, profileId: string) {
    try {
      const userId = user?.id || "";
      const [errorsRes, memoryRes] = await Promise.all([
        supabase.from("learning_errors").select("*")
          .eq("user_id", userId).eq("subject", subj).eq("resolved", false).limit(20),
        supabase.from("memory_items").select("*")
          .eq("child_profile_id", profileId).eq("subject", subj).lt("strength", 40).limit(20),
      ]);

      const parts: string[] = [];
      if (errorsRes.data?.length) {
        parts.push("ERRORI RICORRENTI:\n" + errorsRes.data.map(e =>
          `- ${e.topic || "Generico"}: ${e.description || e.error_type || "errore"}`
        ).join("\n"));
      }
      if (memoryRes.data?.length) {
        parts.push("CONCETTI FRAGILI (forza < 40%):\n" + memoryRes.data.map(m =>
          `- ${m.concept} (forza: ${m.strength}%)`
        ).join("\n"));
      }
      setWeaknessContext(parts.join("\n\n"));
    } catch (err) {
      console.error("Error loading weakness data:", err);
      setWeaknessContext("");
    }
  }

  async function loadExamPlan(subj: string, profileId: string) {
    try {
      const { data } = await supabase.from("esami_utente").select("*")
        .eq("profile_id", profileId).eq("completato", false).limit(10);
      
      const exam = data?.find(e => e.nome_esame.toLowerCase().includes(subj.toLowerCase()));
      if (!exam?.data_prevista) { setExamPlan(null); return; }

      const today = new Date();
      const examDateObj = new Date(exam.data_prevista);
      const diffMs = examDateObj.getTime() - today.getTime();
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const chaptersTotal = 6; // Estimate
      const chaptersPerDay = daysLeft > 0 ? Math.max(1, Math.ceil(chaptersTotal / daysLeft)) : chaptersTotal;
      const todayChapter = Math.min(chaptersTotal, Math.max(1, chaptersTotal - Math.floor(daysLeft * chaptersPerDay / chaptersTotal) + 1));

      setExamPlan({
        examName: exam.nome_esame,
        daysLeft,
        chaptersTotal,
        chaptersPerDay: Math.round(chaptersTotal / Math.max(1, daysLeft)),
        todayChapter,
        todayLabel: `Capitolo ${todayChapter}`,
      });
      setDaysToExam(daysLeft);
      setExamDate(exam.data_prevista);
    } catch (err) {
      console.error("Error loading exam plan:", err);
      setExamPlan(null);
    }
  }

  function startSimulation() {
    if (!subject) return;
    setStep("simulation");

    const systemMsg = mode === "orale"
      ? "Simuliamo un'interrogazione orale. Ti farò domande una alla volta."
      : "Simuliamo una verifica scritta. Rispondi a ogni domanda con attenzione.";

    setMessages([{
      role: "assistant",
      content: `${systemMsg}\n\nMateria: ${subject}\n\nPrima domanda in arrivo...`,
    }]);

    sendToAI([{ role: "assistant", content: systemMsg }], "Inizia la simulazione. Fai la prima domanda.");
  }

  async function sendToAI(history: ChatMessage[], userText: string) {
    setSending(true);
    setStreamingText("");

    // Build time-aware priority instruction
    let timePriorityNote = "";
    const effectiveDays = daysToExam ?? (examDate ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000) : null);
    if (effectiveDays !== null && effectiveDays >= 0) {
      timePriorityNote = `\n\nLo studente ha ${effectiveDays} giorni alla prova. Nel report finale, ordina le priorità in base al tempo disponibile: se mancano poche ore concentrati solo sui punti critici; se mancano giorni, suggerisci un piano più completo. Includi nel report la frase "Hai ${effectiveDays} giorni alla prova. Concentrati su questi punti nell'ordine indicato."`;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const allMsgs = [...history, { role: "user" as const, content: userText }];

      const systemPrompt = getSchoolLevelPrompt(schoolLevel, mode, subject, weaknessContext) + timePriorityNote;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
            systemPrompt,
            stream: true,
          }),
        }
      );

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) { fullText += token; setStreamingText(fullText); }
              } catch {}
            }
          }
        }
      }

      let displayText = fullText;
      if (fullText.includes("[SIMULAZIONE_COMPLETATA]")) {
        displayText = fullText.split("[SIMULAZIONE_COMPLETATA]")[0].trim();
        const jsonMatch = fullText.match(/\{[\s\S]*"strengths"[\s\S]*\}/);
        if (jsonMatch) {
          try { setReport(JSON.parse(jsonMatch[0])); } catch {}
        }
        setTimeout(() => setStep("report"), 1500);
      }

      setStreamingText("");
      setMessages(prev => [...prev, { role: "assistant", content: displayText }]);
    } catch (err) {
      console.error("PrepSession AI error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setVoiceTranscript("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    await sendToAI(messages, text);
  }

  // Voice input with visible transcript
  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.lang = "it-IT";
      recognition.continuous = true;
      recognition.interimResults = true;
      let finalTranscript = "";
      recognition.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) { finalTranscript += t + " "; } else { interim = t; }
        }
        const combined = (finalTranscript + interim).trim();
        setVoiceTranscript(combined);
        setInput(combined);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {}
  }

  // Setup screen
  if (step === "setup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-card rounded-xl border border-border p-8"
        >
          <button onClick={() => navigate("/dashboard")} className="mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground mb-6">{prepLabel}</h1>

          <div className="space-y-4">
            {/* Subject picker */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Materia</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s: string) => (
                  <button key={s} onClick={() => setSubject(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      subject === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            {/* Mode picker */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Modalità</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "scritta" as const, label: "Simulazione scritta", icon: FileText },
                  { key: "orale" as const, label: "Simulazione orale", icon: Mic },
                ].map(m => (
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${
                      mode === m.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exam date for non-university */}
            {!isUniversity && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Data della prova (opzionale)
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => {
                    setExamDate(e.target.value);
                    if (e.target.value) {
                      const d = Math.max(0, Math.ceil((new Date(e.target.value).getTime() - Date.now()) / 86400000));
                      setDaysToExam(d);
                    } else {
                      setDaysToExam(null);
                    }
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {/* Exam plan for university */}
            {isUniversity && examPlan && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Calendar className="w-4 h-4" />
                  Esame tra {examPlan.daysLeft} giorni
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Capitoli da coprire: {examPlan.chaptersTotal}</p>
                  <p>Piano suggerito: {examPlan.chaptersPerDay <= 1 ? "1 capitolo ogni 2 giorni" : `${examPlan.chaptersPerDay} capitoli al giorno`}</p>
                  <p className="font-medium text-foreground">Oggi: {examPlan.todayLabel}</p>
                </div>
              </motion.div>
            )}

            {/* Weakness preview */}
            {weaknessContext && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                <p className="text-xs font-medium text-destructive mb-1">📌 Aree di debolezza identificate</p>
                <p className="text-[11px] text-muted-foreground">Le domande saranno calibrate sui tuoi punti deboli reali.</p>
              </div>
            )}

            <Button onClick={startSimulation} disabled={!subject} className="w-full mt-4">
              Inizia simulazione
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Report screen
  if (step === "report" && report) {
    const timeLabel = daysToExam !== null ? formatTimeRemaining(daysToExam) : null;

    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto pt-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
              Risultato simulazione
            </h1>

            {timeLabel && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-primary">{timeLabel}. Concentrati su questi punti nell'ordine indicato.</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-700 dark:text-green-400">Punti forti</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-green-800 dark:text-green-300">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-amber-700 dark:text-amber-400">Da ripassare</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.weaknesses.map((s, i) => (
                    <li key={i} className="text-sm text-amber-800 dark:text-amber-300">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-primary">Priorità di ripasso</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.priorities.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">{i + 1}. {s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => navigate("/memory")} variant="outline" className="flex-1">
                Inizia ripasso
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="flex-1">
                Torna alla dashboard
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Simulation chat
  return (
    <div className="h-screen flex flex-col bg-card">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">{prepLabel}</h1>
          <span className="text-xs text-muted-foreground">{subject} — {mode === "orale" ? "Orale" : "Scritta"}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                <span className="text-primary-foreground text-xs font-bold">C</span>
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              <MathText>{msg.content}</MathText>
            </div>
          </motion.div>
        ))}
        {streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <span className="text-primary-foreground text-xs font-bold">C</span>
            </div>
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              <MathText>{streamingText}</MathText><span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        )}
        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-primary-foreground text-xs font-bold">C</span>
            </div>
            <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Voice transcript preview */}
      {isListening && voiceTranscript && (
        <div className="border-t border-border bg-primary/5 px-4 py-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">Trascrizione in corso...</span>
          </div>
          <p className="text-sm text-foreground">{voiceTranscript}</p>
        </div>
      )}

      <div className="border-t border-border bg-card p-3">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
          {mode === "orale" && (
            <button type="button" onClick={toggleVoice}
              className={`p-2.5 rounded-xl border transition-colors ${isListening ? "bg-destructive/10 border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}>
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={mode === "orale" ? "Parla o scrivi la tua risposta..." : "Scrivi la tua risposta..."}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || sending} className="rounded-xl h-10 w-10">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
