import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Send, Mic, MicOff, Loader2, CheckCircle, AlertTriangle, Target, Clock, BookOpen,
  MessageCircle, Brain, Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { MathText } from "@/components/shared/MathText";
import { useLang } from "@/contexts/LangContext";
import { PageBackButton } from "@/components/shared/PageBackButton";
import { getPrepLabelKey } from "@/lib/schoolTerms";
import { findMaturitaTrack, type MaturitaTrack } from "@/lib/maturitaMapping";
import UniversityStudyPlan, { type StudyPlanExam } from "@/components/UniversityStudyPlan";
import { loadStudyPlan, saveStudyPlan as saveStudyPlanService } from "@/lib/studyPlanService";
import { GameSession } from "@/components/study/GameSession";


/* ── Types ── */
interface ChatMessage { role: "user" | "assistant"; content: string; }
type ExamType = "verifica" | "orale" | "terza_media" | "maturita" | "universitario";

interface ExamConfig {
  type: ExamType;
  subject?: string;
  topic?: string;
  examDate?: string;
  tone?: "normale" | "esigente";
  prove?: string[];
  indirizzo?: string;
  uniMode?: "orale" | "scritto";
}

/* ── Maturità mapping ── */
const SECONDA_PROVA: Record<string, string> = {
  "Liceo Classico": "Latino",
  "Liceo Scientifico": "Matematica",
  "Liceo Scientifico Scienze Applicate": "Matematica",
  "Liceo Linguistico": "Lingua e cultura straniera 1",
  "Liceo Scienze Umane": "Scienze Umane",
  "Liceo Scienze Umane ES": "Diritto ed Economia politica",
  "Liceo Artistico": "Discipline progettuali",
  "Liceo Musicale": "Teoria, analisi e composizione",
  "ITE AFM": "Economia Aziendale",
  "ITE Turismo": "Discipline turistiche e aziendali",
  "ITT CAT": "Progettazione, costruzioni e impianti",
  "ITT Informatica": "Sistemi e reti",
  "ITT Agrario": "Produzioni vegetali",
  "Scientifico": "Matematica",
  "Classico": "Latino",
  "Linguistico": "Lingua e cultura straniera 1",
  "Tecnico Economico": "Economia Aziendale",
  "Tecnico Tecnologico": "Sistemi e reti",
  "Professionale": "Materia di indirizzo",
  "Artistico": "Discipline progettuali",
};

interface MaturitaTopic {
  argomento: string;
  probabilita: "alta" | "media" | "bassa";
  motivazione: string;
  ultimo_anno_uscito?: string;
}

/* ── Helpers ── */
function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function formatTimeRemaining(d: number): string {
  if (d <= 0) return "La prova è oggi!";
  if (d === 1) return "Manca 1 giorno alla prova";
  return `Mancano ${d} giorni alla prova`;
}

/* ── Progressive difficulty tier ── */
function getTimeTierPrompt(days: number): string {
  if (days > 30)
    return "Mancano più di 30 giorni alla prova. Modalità comprensione profonda: concentrati su metodo, struttura, identificazione delle lacune fondamentali. Sii paziente e approfondito.";
  if (days >= 8)
    return `Mancano ${days} giorni alla prova. Modalità consolidamento: alterna ripasso concettuale a simulazioni parziali. Sii focalizzato ed efficiente.`;
  if (days >= 3)
    return `Mancano ${days} giorni alla prova. Modalità ripasso mirato: concentrati solo sugli essenziali. Simulazioni complete. Sii diretto e privilegia i temi ad alto impatto.`;
  return `Mancano meno di 3 giorni alla prova. Modalità massima concentrazione: rafforza ciò che lo studente sa meglio (costruisci sicurezza) + ripasso rapido dei punti critici. Sii conciso, rassicurante, energizzante.`;
}

/* ── System prompt builder ── */
function buildSystemPrompt(config: ExamConfig, weaknessContext: string): string {
  const { type, subject, topic, examDate, tone, prove, indirizzo, uniMode } = config;
  const topicNote = topic ? ` — ${topic}` : "";
  const weakBlock = weaknessContext
    ? `\n\nDATI SULLE LACUNE DELLO STUDENTE — concentra le domande su queste aree deboli:\n${weaknessContext}`
    : "";

  let dateBlock = "";
  if (examDate) {
    const days = daysUntil(examDate);
    dateBlock = `\n\nLa prova è il ${examDate}. ${getTimeTierPrompt(days)}`;
  }

  const endInstructions = `\n\nAl termine della simulazione (dopo 5-8 domande/risposte), scrivi [SIMULAZIONE_COMPLETATA] e genera un report JSON con questo schema esatto:
{"score":"<voto nella scala appropriata>","strengths":["..."],"weaknesses":["..."],"priorities":["Prima della prova ti consiglio di ripassare ancora: ..."]}
Se emergono lacune ricorrenti, segnalatele esplicitamente nelle priorities.`;

  let core = "";
  switch (type) {
    case "verifica":
      core = `Sei un professore che sta somministrando una verifica scritta su ${subject}${topicNote}. Genera una verifica realistica con domande graduate (dal più semplice al più complesso). Includi domande aperte, a risposta breve e almeno un esercizio applicativo. Dopo che lo studente risponde, valuta ogni risposta con un feedback preciso e un voto parziale. Tieni conto delle lacune note dello studente per calibrare le domande più difficili.`;
      break;
    case "orale":
      core = `Sei un professore che sta interrogando lo studente su ${subject}${topicNote}. Inizia con una domanda aperta, poi approfondisci in base alle risposte. ${tone === "esigente" ? "Fai domande di approfondimento impreviste e non accettare risposte vaghe. Sii esigente e critico." : "Mantieni un tono professionale ma non intimidatorio."} Alla fine dai un voto e un feedback dettagliato su cosa ha funzionato e cosa no.`;
      break;
    case "terza_media": {
      const proveStr = prove?.join(", ") || "tutte le prove";
      core = `Stai simulando ${proveStr} dell'esame di terza media. Segui il formato ministeriale italiano. Per il colloquio orale, inizia da un elaborato multidisciplinare e poi spazia su tutte le materie dell'anno. Valuta con indicatori analitici (conoscenza, comprensione, esposizione). Per le prove scritte genera tracce realistiche nel formato ministeriale.`;
      break;
    }
    case "maturita": {
      const proveStr = prove?.join(", ") || "tutte le prove";
      core = `Stai simulando ${proveStr} dell'esame di maturità per indirizzo ${indirizzo || "non specificato"}. Per la prima prova segui le tipologie A/B/C ministeriali. Per la seconda prova genera tracce coerenti con l'indirizzo. Per il colloquio simula una commissione con domande che partono dall'elaborato e si collegano a tutte le discipline. Valuta in quindicesimi per le scritte, trentesimi per il colloquio.`;
      break;
    }
    case "universitario":
      core = `Stai simulando un esame universitario di ${subject}. ${uniMode === "scritto"
        ? "Genera esercizi o domande aperte tipiche di quell'esame. Formato scritto."
        : "Fai domande teoriche graduate, chiedi definizioni precise, esempi e applicazioni. Formato orale."} Valuta in trentesimi con lode se appropriato.`;
      break;
  }

  return core + weakBlock + dateBlock + endInstructions;
}

/* ── Exam type cards ── */
const EXAM_TYPES: { id: ExamType; emoji: string; labelKey: string; descKey: string }[] = [
  { id: "verifica", emoji: "📝", labelKey: "exam_type_verifica", descKey: "exam_type_verifica_desc" },
  { id: "orale", emoji: "🎤", labelKey: "exam_type_orale", descKey: "exam_type_orale_desc" },
  { id: "terza_media", emoji: "🏫", labelKey: "exam_type_terza_media", descKey: "exam_type_terza_media_desc" },
  { id: "maturita", emoji: "🎓", labelKey: "exam_type_maturita", descKey: "exam_type_maturita_desc" },
  { id: "universitario", emoji: "🎓", labelKey: "exam_type_universitario", descKey: "exam_type_universitario_desc" },
];

// Subject list now comes from shared utility
import { getSubjectsByLevel } from "@/lib/subjectsByLevel";

const TERZA_MEDIA_PROVE = ["Italiano scritto", "Matematica scritta", "Lingua straniera scritta", "Colloquio orale interdisciplinare"];
const MATURITA_PROVE = ["Prima prova (italiano)", "Seconda prova", "Colloquio orale"];

/* ══════════════ Component ══════════════ */
export default function PrepSession() {
  const navigate = useNavigate();
  const { subject: paramSubject } = useParams();
  const { user } = useAuth();
  const { t } = useLang();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || profile?.schoolLevel || "superiori";
  const prepLabel = t(getPrepLabelKey(schoolLevel));

  /* State */
  const [step, setStep] = useState<"type" | "setup" | "plan" | "mode-select" | "simulation" | "report" | "maturita-setup" | "maturita-analysis" | "maturita-mode-select" | "maturita-sim" | "games">("type");
  const [examType, setExamType] = useState<ExamType | null>(null);
  const [studyMode, setStudyMode] = useState<null | "coach" | "flashcard" | "games">(null);
  const [userPrefsData, setUserPrefsData] = useState<any>(null);
  const [coachName, setCoachName] = useState<string | undefined>(undefined);

  // Setup fields
  const [subject, setSubject] = useState(paramSubject || "");
  const [topic, setTopic] = useState("");
  const [examDate, setExamDate] = useState("");
  const [tone, setTone] = useState<"normale" | "esigente">("normale");
  const [selectedProve, setSelectedProve] = useState<string[]>([]);
  const [indirizzo, setIndirizzo] = useState("");
  const [uniMode, setUniMode] = useState<"orale" | "scritto">("orale");

  // Maturità auto-detect
  const [detectedTrack, setDetectedTrack] = useState<MaturitaTrack | null>(null);
  const [trackConfirmed, setTrackConfirmed] = useState(false);

  // Maturità 3-screen state
  const [maturitaProva, setMaturitaProva] = useState<"prima" | "seconda" | "colloquio" | null>(null);
  const [maturitaTopics, setMaturitaTopics] = useState<MaturitaTopic[]>([]);
  const [maturitaLoading, setMaturitaLoading] = useState(false);
  const [maturitaCustomTopic, setMaturitaCustomTopic] = useState("");
  const [maturitaSelectedTopic, setMaturitaSelectedTopic] = useState<string | undefined>(undefined);
  const [maturitaTimerSeconds, setMaturitaTimerSeconds] = useState(0);
  const [maturitaTimerActive, setMaturitaTimerActive] = useState(false);
  const maturitaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondaProvaMateria = indirizzo ? (SECONDA_PROVA[indirizzo] || "Materia di indirizzo") : "Materia di indirizzo";

  // University study plan
  const [studyPlan, setStudyPlan] = useState<StudyPlanExam[]>([]);
  const [planLoaded, setPlanLoaded] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [report, setReport] = useState<{ score?: string; strengths: string[]; weaknesses: string[]; priorities: string[] } | null>(null);
  const [weaknessContext, setWeaknessContext] = useState("");

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic subjects based on school level
  const favSubjects = profile?.favorite_subjects || profile?.favoriteSubjects || [];
  const diffSubjects = profile?.difficult_subjects || profile?.difficultSubjects || [];
  const profileSubjects = [
    ...favSubjects,
    ...diffSubjects.filter((s: string) => !favSubjects.includes(s)),
  ];
  const subjects = profileSubjects.length > 0 ? profileSubjects : getSubjectsByLevel(schoolLevel, userPrefsData?.superiori_indirizzo);
  const daysToExam = examDate ? daysUntil(examDate) : null;

  // Filter exam types by school level
  const isFifthYear = schoolLevel === "superiori" && (
    userPrefsData?.superiori_anno === "5" || userPrefsData?.superiori_anno === 5
  );
  const filteredExamTypes = EXAM_TYPES.filter(et => {
    if (et.id === "terza_media") return schoolLevel?.startsWith("media") || schoolLevel === "medie";
    if (et.id === "maturita") return schoolLevel === "superiori" && isFifthYear;
    if (et.id === "universitario") return schoolLevel === "universitario";
    if (et.id === "verifica" || et.id === "orale") return true;
    return true;
  });

  // Maturità timer
  useEffect(() => {
    if (maturitaTimerActive && step === "maturita-sim") {
      maturitaTimerRef.current = setInterval(() => {
        setMaturitaTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(maturitaTimerRef.current!);
            setMaturitaTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (maturitaTimerRef.current) clearInterval(maturitaTimerRef.current); };
  }, [maturitaTimerActive, step]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Load weakness data
  useEffect(() => {
    if (!subject || !profile?.id) { setWeaknessContext(""); return; }
    loadWeaknessData(subject, profile.id);
  }, [subject, profile?.id]);

  // Load coach name from preferences
  useEffect(() => {
    const pid = getChildSession()?.profileId || profile?.id;
    if (!pid) return;
    supabase.from("user_preferences").select("data").eq("profile_id", pid).maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.data as any) || {};
        if (prefs.coach_name) setCoachName(prefs.coach_name);
      });
  }, []);

  // Load user_preferences for maturità indirizzo + study plan
  useEffect(() => {
    if (!profile?.id) return;
    loadUserPreferences(profile.id);
  }, [profile?.id]);

  async function loadUserPreferences(profileId: string) {
    try {
      const { data } = await supabase.from("user_preferences")
        .select("data").eq("profile_id", profileId).maybeSingle();
      const prefData = data?.data as any;
      if (prefData) setUserPrefsData(prefData);
      if (prefData?.indirizzo_scolastico) {
        const track = findMaturitaTrack(prefData.indirizzo_scolastico);
        if (track) {
          setDetectedTrack(track);
          setIndirizzo(track.label);
        }
      }
      const plan = await loadStudyPlan(profileId);
      setStudyPlan(plan);
      setPlanLoaded(true);
    } catch { setPlanLoaded(true); }
  }

  function handleSaveStudyPlan(newPlan: StudyPlanExam[]) {
    setStudyPlan(newPlan);
    if (profile?.id) saveStudyPlanService(profile.id, newPlan);
  }

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
          `- ${e.topic || "Generico"}: ${e.description || e.error_type || "errore"}`).join("\n"));
      }
      if (memoryRes.data?.length) {
        parts.push("CONCETTI FRAGILI (forza < 40%):\n" + memoryRes.data.map(m =>
          `- ${m.concept} (forza: ${m.strength}%)`).join("\n"));
      }
      setWeaknessContext(parts.join("\n\n"));
    } catch { setWeaknessContext(""); }
  }

  /* ── Start simulation ── */
  function startSimulation() {
    if (!examType) return;
    const needsSubject = examType === "verifica" || examType === "orale" || examType === "universitario";
    if (needsSubject && !subject) return;

    const config: ExamConfig = {
      type: examType,
      subject: subject || undefined,
      topic: topic || undefined,
      examDate: examDate || undefined,
      tone: examType === "orale" ? tone : undefined,
      prove: (examType === "terza_media" || examType === "maturita") ? selectedProve : undefined,
      indirizzo: examType === "maturita" ? indirizzo : undefined,
      uniMode: examType === "universitario" ? uniMode : undefined,
    };

    const systemPrompt = buildSystemPrompt(config, weaknessContext);
    setStep("simulation");
    setMessages([{ role: "assistant", content: "" }]);
    sendToAI([], "Inizia la simulazione. Fai la prima domanda.", systemPrompt, true);
  }

  async function sendToAI(history: ChatMessage[], userText: string, systemPrompt?: string, isFirst = false) {
    setSending(true);
    setStreamingText("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const allMsgs = [...history, { role: "user" as const, content: userText }];
      const body: any = { messages: allMsgs.map(m => ({ role: m.role, content: m.content })), stream: true };
      if (systemPrompt) body.systemPrompt = systemPrompt;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(body),
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
      if (isFirst) setMessages([{ role: "assistant", content: displayText }]);
      else setMessages(prev => [...prev, { role: "assistant", content: displayText }]);
    } catch {
      const fallback = "Si è verificato un errore. Riprova.";
      if (isFirst) setMessages([{ role: "assistant", content: fallback }]);
      else setMessages(prev => [...prev, { role: "assistant", content: fallback }]);
    }
    setSending(false);
  }

  function sendMessage() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput(""); setVoiceTranscript("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    sendToAI(messages, text);
  }

  function toggleVoice() {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const recognition = new SR();
      recognition.lang = "it-IT"; recognition.continuous = true; recognition.interimResults = true;
      let finalTranscript = "";
      recognition.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTranscript += tr + " "; else interim = tr;
        }
        const combined = (finalTranscript + interim).trim();
        setVoiceTranscript(combined); setInput(combined);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition; recognition.start(); setIsListening(true);
    } catch {}
  }

  function toggleProva(prova: string) {
    setSelectedProve(prev => prev.includes(prova) ? prev.filter(p => p !== prova) : [...prev, prova]);
  }

  const isOralMode = examType === "orale" || (examType === "universitario" && uniMode === "orale");

  // University exams available for quick select
  const availableUniExams = studyPlan.filter(e => e.stato !== "superato");

  // Format timer
  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  };

  // Maturità: analyze topics
  async function analyzeMaturitaTopics() {
    setMaturitaLoading(true);
    setMaturitaTopics([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const provaLabel = maturitaProva === "prima" ? "Prima prova (Italiano)" : maturitaProva === "seconda" ? `Seconda prova (${secondaProvaMateria})` : "Colloquio orale";
      const body = {
        messages: [{ role: "user", content: `Analizza gli argomenti più probabili per la ${provaLabel} della maturità 2026, indirizzo ${indirizzo}. Rispondi SOLO con un JSON array: [{"argomento":"...","probabilita":"alta|media|bassa","motivazione":"...","ultimo_anno_uscito":"..."}]. Fornisci 3-5 argomenti.` }],
        systemPrompt: `You are an expert Italian maturità exam coach. The student's indirizzo is "${indirizzo}". The proof type is "${provaLabel}". Based on ministerial programs and historical exam patterns, return 3-5 probable topics as a JSON array. Weak subjects: ${weaknessContext || "none identified"}.`,
      };
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const topics = JSON.parse(jsonMatch[0]) as MaturitaTopic[];
        setMaturitaTopics(topics);
      }
    } catch (err) {
      console.error("Maturità analysis error:", err);
    }
    setMaturitaLoading(false);
  }

  // Start maturità simulation on a specific topic
  function startMaturitaSim(topicOverride?: string) {
    const provaLabel = maturitaProva === "prima" ? "Prima prova (Italiano)" : maturitaProva === "seconda" ? `Seconda prova (${secondaProvaMateria})` : "Colloquio orale";
    const timerDuration = maturitaProva === "colloquio" ? 30 * 60 : 6 * 60 * 60; // 30min or 6h
    setMaturitaTimerSeconds(timerDuration);
    setMaturitaTimerActive(true);
    setStep("maturita-sim");
    setMessages([{ role: "assistant", content: "" }]);

    const topicNote = topicOverride ? ` sull'argomento: ${topicOverride}` : "";
    const systemPrompt = `You are an expert Italian maturità exam coach with deep knowledge of the Italian school system, ministerial programs, and exam history.

MATURITÀ 2026 KEY FACTS:
- Prima prova: June 18, 2026 (same for all indirizzi, 6 hours)
  - 7 tracce in 3 tipologie: A (analisi testo: 2), B (testo argomentativo: 3), C (tema attualità: 2)
- Seconda prova: June 19, 2026 (specific to each indirizzo)
- Colloquio orale 2026: only 4 specific disciplines chosen by MIM

SECOND PROOF SUBJECT FOR THIS STUDENT: ${secondaProvaMateria} (indirizzo: ${indirizzo})

YOUR ROLE: Generate a REALISTIC traccia matching exact MIM format for ${provaLabel}${topicNote}.
${maturitaProva === "colloquio" ? "Simula una commissione con domande che partono dall'elaborato e si collegano a tutte le discipline." : ""}

At the end of the simulation (after the student responds), write [SIMULAZIONE_COMPLETATA] and generate a report JSON:
{"score":"<voto>/20","strengths":["..."],"weaknesses":["..."],"priorities":["..."]}
${maturitaProva === "prima" ? "Griglia: padronanza linguistica(4)+capacità testuale(4)+conoscenze(4)+pensiero critico(4)+originalità(4)" : maturitaProva === "seconda" ? "Griglia: conoscenze(6)+applicazione(6)+argomentazione(4)+forma(4)" : "Griglia: 5pt per disciplina×4+collegamento bonus"}

${weaknessContext ? `STUDENT WEAK AREAS:\n${weaknessContext}` : ""}`;

    sendToAI([], `Inizia la simulazione della ${provaLabel} della maturità${topicNote}. Genera la traccia.`, systemPrompt, true);
  }

  /* ══════════════ MATURITÀ SCREEN 1: Indirizzo e prova ══════════════ */
  if (step === "maturita-setup" && examType === "maturita") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => { setStep("type"); setExamType(null); }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl">🎓</span>
          <h1 className="text-lg font-bold text-foreground">{t("exam_type_maturita")}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              {t("exam_field_indirizzo")}
            </label>
            <Input value={indirizzo} onChange={e => {
              setIndirizzo(e.target.value);
              const track = findMaturitaTrack(e.target.value);
              if (track) { setDetectedTrack(track); setIndirizzo(track.label); }
            }} placeholder={t("exam_field_indirizzo_placeholder")} />
            {indirizzo && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("exam_maturita_seconda")}: <strong>{secondaProvaMateria}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              {t("exam_maturita_choose_prova")}
            </label>
            <div className="space-y-2">
              <button onClick={() => setMaturitaProva("prima")}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${maturitaProva === "prima" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                📝 {t("exam_maturita_prima")}
              </button>
              <button onClick={() => setMaturitaProva("seconda")}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${maturitaProva === "seconda" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                📐 {t("exam_maturita_seconda_btn")} ({secondaProvaMateria})
              </button>
              <button onClick={() => setMaturitaProva("colloquio")}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${maturitaProva === "colloquio" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                🎤 {t("exam_maturita_colloquio_btn")}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              {t("exam_field_date")}
            </label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground" />
          </div>

          <Button onClick={() => { setStep("maturita-analysis"); analyzeMaturitaTopics(); }}
            disabled={!indirizzo || !maturitaProva} className="w-full">
            {t("exam_maturita_analyze")} →
          </Button>
        </div>
      </div>
    );
  }

  /* ══════════════ MATURITÀ SCREEN 2: AI Analysis ══════════════ */
  if (step === "maturita-analysis" && examType === "maturita") {
    const probColor: Record<string, string> = {
      alta: "bg-destructive/10 text-destructive border-destructive/20",
      media: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
      bassa: "bg-muted text-muted-foreground border-border",
    };

    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => setStep("maturita-setup")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl">🔍</span>
          <h1 className="text-lg font-bold text-foreground">{t("exam_maturita_analysis_title")}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {maturitaLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{t("exam_maturita_analyzing")}</p>
            </div>
          ) : (
            <>
              {maturitaTopics.length > 0 ? (
                <div className="space-y-3">
                  {maturitaTopics.map((topic, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="border border-border rounded-xl p-4 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground text-sm">{topic.argomento}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase ${probColor[topic.probabilita] || probColor.bassa}`}>
                          {topic.probabilita}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{topic.motivazione}</p>
                      {topic.ultimo_anno_uscito && (
                        <p className="text-[10px] text-muted-foreground">Ultimo anno uscito: {topic.ultimo_anno_uscito}</p>
                      )}
                      <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => { setMaturitaSelectedTopic(topic.argomento); setStep("maturita-mode-select"); }}>
                        {t("exam_maturita_simulate_topic")}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t("exam_maturita_no_topics")}</p>
              )}

              <div className="border-t border-border pt-4 space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">{t("exam_maturita_custom_topic")}</label>
                <div className="flex gap-2">
                  <Input value={maturitaCustomTopic} onChange={e => setMaturitaCustomTopic(e.target.value)}
                    placeholder={t("exam_maturita_custom_placeholder")} />
                  <Button onClick={() => { setMaturitaSelectedTopic(maturitaCustomTopic); setStep("maturita-mode-select"); }} disabled={!maturitaCustomTopic.trim()}>
                    {t("exam_start")}
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => { setMaturitaSelectedTopic(undefined); setStep("maturita-mode-select"); }}>
                {t("exam_maturita_start_generic")}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════ GAMES SESSION (both regular + maturità) ══════════════ */
  if (step === "games") {
    const gameTopic = examType === "maturita"
      ? (maturitaSelectedTopic || `${maturitaProva} — ${indirizzo}`)
      : (topic || subject || "Preparazione");
    const gameSubject = examType === "maturita"
      ? (maturitaProva === "seconda" ? secondaProvaMateria : "Italiano")
      : (subject || "");
    const syntheticConcepts = [{ concept: gameTopic, summary: gameSubject ? `Materia: ${gameSubject}` : "" }];
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => { setStudyMode(null); setStep(examType === "maturita" ? "maturita-mode-select" : "mode-select"); }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">{t("study_mode_games_title")}</h1>
        </div>
        <GameSession
          subject={gameSubject}
          topic={gameTopic}
          section="ripasso"
          concepts={syntheticConcepts}
          onClose={() => { setStudyMode(null); setStep(examType === "maturita" ? "maturita-mode-select" : "mode-select"); }}
        />
      </div>
    );
  }

  /* ══════════════ MODE SELECT — Regular exams ══════════════ */
  if (step === "mode-select" && examType && examType !== "maturita") {
    const displayCoachName = coachName || "il Coach";
    const modeCards = [
      { id: "coach" as const, icon: MessageCircle, titleKey: "prep_mode_coach_title", descKey: "prep_mode_coach_desc" },
      { id: "flashcard" as const, icon: Brain, titleKey: "study_mode_flashcard_title", descKey: "prep_mode_flashcard_desc" },
      { id: "games" as const, icon: Gamepad2, titleKey: "study_mode_games_title", descKey: "study_mode_games_desc" },
    ];
    const handleModeSelect = (modeId: "coach" | "flashcard" | "games") => {
      setStudyMode(modeId);
      if (modeId === "coach") {
        startSimulation();
      } else if (modeId === "flashcard") {
        const params = new URLSearchParams();
        params.set("mode", "topic");
        if (topic) params.set("topic", topic);
        if (subject) params.set("subject", subject);
        navigate(`/flashcards?${params.toString()}`);
      } else {
        setStep("games");
      }
    };
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => { setStudyMode(null); setStep("setup"); }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">{prepLabel}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">{t("prep_mode_heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("prep_mode_subtitle")}</p>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {subject && <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{subject}</span>}
              {topic && <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{topic}</span>}
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {modeCards.map((card, i) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 30, delay: i * 0.06 }}
                onClick={() => handleModeSelect(card.id)}
                className="w-full flex flex-col items-center gap-2 p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-1 group-hover:bg-primary/15 transition-colors">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {card.id === "coach" ? t(card.titleKey).replace("{{coachName}}", displayCoachName) : t(card.titleKey)}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(card.descKey)}</p>
              </motion.button>
            ))}
          </div>
          <Button variant="outline" onClick={() => { setStudyMode(null); setStep("setup"); }} className="w-full">
            ← {t("exam_back_setup")}
          </Button>
        </div>
      </div>
    );
  }

  /* ══════════════ MODE SELECT — Maturità ══════════════ */
  if (step === "maturita-mode-select" && examType === "maturita") {
    const displayCoachName = coachName || "il Coach";
    const topicLabel = maturitaSelectedTopic || t("exam_maturita_start_generic");
    const modeCards = [
      { id: "coach" as const, icon: MessageCircle, titleKey: "prep_mode_coach_title", descKey: "prep_mode_coach_desc" },
      { id: "flashcard" as const, icon: Brain, titleKey: "study_mode_flashcard_title", descKey: "prep_mode_flashcard_desc" },
      { id: "games" as const, icon: Gamepad2, titleKey: "study_mode_games_title", descKey: "study_mode_games_desc" },
    ];
    const handleModeSelect = (modeId: "coach" | "flashcard" | "games") => {
      setStudyMode(modeId);
      if (modeId === "coach") {
        startMaturitaSim(maturitaSelectedTopic);
      } else if (modeId === "flashcard") {
        const params = new URLSearchParams();
        params.set("mode", "topic");
        const flashTopic = maturitaSelectedTopic || `Maturità ${maturitaProva}`;
        params.set("topic", flashTopic);
        params.set("subject", maturitaProva === "seconda" ? secondaProvaMateria : "Italiano");
        navigate(`/flashcards?${params.toString()}`);
      } else {
        setStep("games");
      }
    };
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => { setStudyMode(null); setStep("maturita-analysis"); }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl">🎓</span>
          <h1 className="font-display text-lg font-bold text-foreground">{t("exam_type_maturita")}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">{t("prep_mode_heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("prep_mode_subtitle")}</p>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{topicLabel}</span>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{indirizzo}</span>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {modeCards.map((card, i) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 30, delay: i * 0.06 }}
                onClick={() => handleModeSelect(card.id)}
                className="w-full flex flex-col items-center gap-2 p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-1 group-hover:bg-primary/15 transition-colors">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {card.id === "coach" ? t(card.titleKey).replace("{{coachName}}", displayCoachName) : t(card.titleKey)}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(card.descKey)}</p>
              </motion.button>
            ))}
          </div>
          <Button variant="outline" onClick={() => { setStudyMode(null); setStep("maturita-analysis"); }} className="w-full">
            ← {t("exam_back_analysis")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "maturita-sim" && examType === "maturita") {
    const provaLabel = maturitaProva === "prima" ? "Prima prova" : maturitaProva === "seconda" ? `Seconda prova` : "Colloquio";
    return (
      <div className="h-screen flex flex-col bg-card">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => { setMaturitaTimerActive(false); setStep("maturita-analysis"); }} className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">🎓 {provaLabel}</h1>
            <span className="text-xs text-muted-foreground">{indirizzo}</span>
          </div>
          {maturitaTimerActive && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-mono font-bold">{formatTimer(maturitaTimerSeconds)}</span>
            </div>
          )}
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
                {msg.content ? <MathText>{msg.content}</MathText> : (sending && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : null)}
              </div>
            </motion.div>
          ))}
          {streamingText && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                <span className="text-primary-foreground text-xs font-bold">C</span>
              </div>
              <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                <MathText>{streamingText}</MathText><span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
            {maturitaProva === "colloquio" && (
              <button type="button" onClick={toggleVoice}
                className={`p-2.5 rounded-xl border transition-colors ${isListening ? "bg-destructive/10 border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder={maturitaProva === "colloquio" ? t("exam_input_oral") : t("exam_input_written")}
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-foreground"
              disabled={sending} />
            <Button type="submit" size="icon" disabled={!input.trim() || sending} className="rounded-xl h-10 w-10">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  /* ══════════════ STEP: Type selector ══════════════ */
  if (step === "type") {
    return (
      <div className="min-h-screen bg-background pb-24">
        
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton to="/dashboard" />
          <h1 className="text-lg font-bold text-foreground">{prepLabel}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
          <p className="text-sm text-muted-foreground mb-4">{t("exam_select_type")}</p>
          {filteredExamTypes.map((et, i) => (
            <motion.button key={et.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30, delay: i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setExamType(et.id); setStep(et.id === "maturita" ? "maturita-setup" : "setup"); }}
              className="w-full flex flex-col items-center gap-2 p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-center group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-1 group-hover:bg-primary/15 transition-colors">
                <span className="text-2xl">{et.emoji}</span>
              </div>
              <p className="font-bold text-foreground text-sm">{t(et.labelKey)}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t(et.descKey)}</p>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  /* ══════════════ STEP: Study Plan ══════════════ */
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => setStep("setup")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">{t("plan_title")}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <p className="text-sm text-muted-foreground">{t("plan_description")}</p>
          <UniversityStudyPlan exams={studyPlan} onChange={handleSaveStudyPlan} />
          <Button onClick={() => setStep("setup")} className="w-full" variant="outline">
            {t("plan_done")}
          </Button>
        </div>
      </div>
    );
  }

  /* ══════════════ STEP: Setup fields ══════════════ */
  if (step === "setup" && examType) {
    const needsSubject = examType === "verifica" || examType === "orale" || examType === "universitario";
    const canStart = examType === "terza_media" || examType === "maturita"
      ? selectedProve.length > 0
      : needsSubject ? !!subject : true;

    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => setStep("type")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl">{EXAM_TYPES.find(e => e.id === examType)?.emoji}</span>
          <h1 className="text-lg font-bold text-foreground">{t(EXAM_TYPES.find(e => e.id === examType)?.labelKey || "")}</h1>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* ── Subject for verifica, orale ── */}
          {(examType === "verifica" || examType === "orale") && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {t("exam_field_subject")}
              </label>
              <div className="flex flex-wrap gap-2">
                {[...subjects, ...customSubjects].map((s: string) => (
                  <button key={s} onClick={() => setSubject(subject === s ? "" : s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all inline-flex items-center gap-1 ${
                      subject === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
                    }`}>
                    {s}
                    {customSubjects.includes(s) && (
                      <span onClick={(e) => { e.stopPropagation(); setCustomSubjects(prev => prev.filter(c => c !== s)); if (subject === s) setSubject(""); }}
                        className="ml-1 text-muted-foreground hover:text-destructive cursor-pointer">✕</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={customSubjectInput}
                  onChange={e => setCustomSubjectInput(e.target.value)}
                  placeholder={t("add_custom_subject_placeholder")}
                  className="flex-1 h-9 text-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter" && customSubjectInput.trim()) {
                      e.preventDefault();
                      const val = customSubjectInput.trim();
                      if (!subjects.includes(val) && !customSubjects.includes(val)) {
                        setCustomSubjects(prev => [...prev, val]);
                        setSubject(val);
                      }
                      setCustomSubjectInput("");
                    }
                  }}
                />
                <Button size="sm" variant="outline" className="h-9 px-3"
                  disabled={!customSubjectInput.trim()}
                  onClick={() => {
                    const val = customSubjectInput.trim();
                    if (val && !subjects.includes(val) && !customSubjects.includes(val)) {
                      setCustomSubjects(prev => [...prev, val]);
                      setSubject(val);
                    }
                    setCustomSubjectInput("");
                  }}>+</Button>
              </div>
            </div>
          )}

          {/* ── Subject for university — with study plan integration ── */}
          {examType === "universitario" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {t("exam_field_uni_subject")}
              </label>

              {/* Quick select from study plan */}
              {availableUniExams.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {availableUniExams.map(e => (
                    <button key={e.id} onClick={() => setSubject(e.nome)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        subject === e.nome ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
                      }`}>
                      {e.stato === "in_preparazione" ? "🟡 " : ""}{e.nome}
                    </button>
                  ))}
                </div>
              )}

              {/* No study plan CTA */}
              {planLoaded && studyPlan.length === 0 && (
                <div className="bg-muted/50 border border-border rounded-xl p-4 mb-3">
                  <p className="text-sm text-muted-foreground mb-2">{t("plan_empty_cta")}</p>
                  <Button size="sm" variant="outline" onClick={() => setStep("plan")}>
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" />{t("plan_setup_cta")}
                  </Button>
                </div>
              )}

              {/* Manual input */}
              <Input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder={t("exam_field_uni_subject_placeholder")} />

              {/* Link to plan if exists */}
              {studyPlan.length > 0 && (
                <button onClick={() => setStep("plan")}
                  className="text-xs text-primary hover:underline mt-2 inline-block">
                  {t("plan_manage_link")}
                </button>
              )}
            </div>
          )}

          {/* ── Topic for verifica, orale ── */}
          {(examType === "verifica" || examType === "orale") && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {t("exam_field_topic")}
              </label>
              <Input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder={t("exam_field_topic_placeholder")} />
            </div>
          )}

          {/* ── Tone for orale ── */}
          {examType === "orale" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {t("exam_field_tone")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["normale", "esigente"] as const).map(tv => (
                  <button key={tv} onClick={() => setTone(tv)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      tone === tv ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}>
                    {tv === "normale" ? t("exam_tone_normale") : t("exam_tone_esigente")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Prove for terza media ── */}
          {examType === "terza_media" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {t("exam_field_prove")}
              </label>
              <div className="space-y-2">
                {TERZA_MEDIA_PROVE.map(p => (
                  <button key={p} onClick={() => toggleProva(p)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                      selectedProve.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* ── Maturità with auto-detection ── */}
          {examType === "maturita" && (
            <>
              {/* Auto-detected track confirmation */}
              {detectedTrack && !trackConfirmed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <p className="text-sm text-foreground mb-2">
                    {t("exam_maturita_detected").replace("{indirizzo}", detectedTrack.label)}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("exam_maturita_seconda")}: <strong>{detectedTrack.secondaProva}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("exam_maturita_colloquio")}: {detectedTrack.colloquioMaterie.join(", ")}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setTrackConfirmed(true)}>
                      {t("exam_maturita_confirm")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDetectedTrack(null); setIndirizzo(""); }}>
                      {t("exam_maturita_modify")}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Manual indirizzo if no detection or user wants to modify */}
              {(!detectedTrack || trackConfirmed) && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                    {t("exam_field_indirizzo")}
                  </label>
                  <Input value={indirizzo} onChange={e => {
                    setIndirizzo(e.target.value);
                    const track = findMaturitaTrack(e.target.value);
                    if (track) setDetectedTrack(track);
                  }} placeholder={t("exam_field_indirizzo_placeholder")} />
                  {detectedTrack && trackConfirmed && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("exam_maturita_seconda")}: {detectedTrack.secondaProva}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  {t("exam_field_prove")}
                </label>
                <div className="space-y-2">
                  {MATURITA_PROVE.map(p => (
                    <button key={p} onClick={() => toggleProva(p)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                        selectedProve.includes(p) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Uni mode ── */}
          {examType === "universitario" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {t("exam_field_uni_mode")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["orale", "scritto"] as const).map(m => (
                  <button key={m} onClick={() => setUniMode(m)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      uniMode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}>
                    {m === "orale" ? t("exam_uni_orale") : t("exam_uni_scritto")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Date ── */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              {t("exam_field_date")}
            </label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Weakness preview */}
          {weaknessContext && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
              <p className="text-xs font-medium text-destructive mb-1">📌 {t("exam_weakness_title")}</p>
              <p className="text-[11px] text-muted-foreground">{t("exam_weakness_desc")}</p>
            </div>
          )}

          <Button onClick={() => setStep("mode-select")} disabled={!canStart} className="w-full">
            {t("exam_start")} →
          </Button>
        </div>
      </div>
    );
  }

  /* ══════════════ STEP: Report ══════════════ */
  if (step === "report" && report) {
    const timeLabel = daysToExam !== null ? formatTimeRemaining(daysToExam) : null;

    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto pt-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-foreground mb-2 text-center">{t("exam_report_title")}</h1>
            {report.score && (
              <p className="text-center text-lg font-semibold text-primary mb-4">{t("exam_report_score")}: {report.score}</p>
            )}
            {timeLabel && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-primary">{timeLabel}</p>
              </div>
            )}
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-700 dark:text-green-400">{t("exam_report_strengths")}</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.strengths.map((s, i) => <li key={i} className="text-sm text-green-800 dark:text-green-300">{s}</li>)}
                </ul>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-amber-700 dark:text-amber-400">{t("exam_report_weaknesses")}</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.weaknesses.map((s, i) => <li key={i} className="text-sm text-amber-800 dark:text-amber-300">{s}</li>)}
                </ul>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-primary">{t("exam_report_priorities")}</h3>
                </div>
                <ul className="space-y-1.5">
                  {report.priorities.map((s, i) => <li key={i} className="text-sm text-foreground">{i + 1}. {s}</li>)}
                </ul>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => navigate("/memory")} variant="outline" className="flex-1">{t("exam_report_review")}</Button>
              <Button onClick={() => navigate("/dashboard")} className="flex-1">{t("exam_report_home")}</Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ══════════════ STEP: Simulation chat ══════════════ */
  const examEmoji = EXAM_TYPES.find(e => e.id === examType)?.emoji || "📝";
  const modeSubtitle = examType === "orale" ? "Orale" : examType === "verifica" ? "Scritta" : t(EXAM_TYPES.find(e => e.id === examType)?.labelKey || "");

  return (
    <div className="h-screen flex flex-col bg-card">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">{examEmoji} {prepLabel}</h1>
          <span className="text-xs text-muted-foreground">{subject ? `${subject} — ` : ""}{modeSubtitle}</span>
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
              {msg.content ? <MathText>{msg.content}</MathText> : (sending && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : null)}
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
        {sending && !streamingText && messages[messages.length - 1]?.content && (
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

      {isListening && voiceTranscript && (
        <div className="border-t border-border bg-primary/5 px-4 py-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">{t("exam_voice_transcribing")}</span>
          </div>
          <p className="text-sm text-foreground">{voiceTranscript}</p>
        </div>
      )}

      <div className="border-t border-border bg-card p-3">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
          {isOralMode && (
            <button type="button" onClick={toggleVoice}
              className={`p-2.5 rounded-xl border transition-colors ${isListening ? "bg-destructive/10 border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}>
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder={isOralMode ? t("exam_input_oral") : t("exam_input_written")}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            disabled={sending} />
          <Button type="submit" size="icon" disabled={!input.trim() || sending} className="rounded-xl h-10 w-10">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
