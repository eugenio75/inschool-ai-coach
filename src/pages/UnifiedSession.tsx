import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDailyMissions, completeMission, saveFocusSession, getGamification } from "@/lib/database";
import {
  BookOpen,
  FileText,
  Map,
  List,
  Key,
  Layers,
  Loader2,
  Brain,
  MessageCircle,
  CalendarDays,
  Sparkles,
  GraduationCap,
  Gamepad2,
  Plus,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { ChatShell } from "@/components/ChatShell";
import { ChatMsg, streamChat } from "@/lib/streamChat";
import { SessionCelebration } from "@/components/SessionCelebration";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/contexts/LangContext";
import { getPrepLabelKey } from "@/lib/schoolTerms";
import { useGuidedSession } from "@/hooks/useGuidedSession";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageBackButton } from "@/components/shared/PageBackButton";
import { ChallengeSession } from "@/components/study/ChallengeSession";
import { GameSession } from "@/components/study/GameSession";
import { MathGame } from "@/components/student-coach/MathGame";
import { AnimatePresence } from "framer-motion";
import { calcolaDivisione, verificaRisposta, type DivisionResult, type DivisionStep } from "@/lib/mathEngine";

import { getSubjectsByLevel } from "@/lib/subjectsByLevel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// getPrepLabel now handled via i18n — see getTitle()

const OUTPUT_TYPES = [
  { id: "schema", label: "Schema", icon: List },
  { id: "mappa", label: "Mappa concettuale", icon: Map },
  { id: "sintesi_breve", label: "Sintesi breve", icon: FileText },
  { id: "sintesi_estesa", label: "Sintesi estesa", icon: BookOpen },
  { id: "glossario", label: "Glossario", icon: Key },
  { id: "punti_chiave", label: "Punti chiave", icon: Layers },
];

type SessionType = "study" | "review" | "prep" | "guided";

export default function UnifiedSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLang();
  const type = (searchParams.get("type") || "study") as SessionType;
  const homeworkId = searchParams.get("hw");
  const urlSubject = searchParams.get("subject");
  const urlMsg = searchParams.get("msg");
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";
  const { user } = useAuth();
  const studentName = profile?.name || "Studente";
  const profileId = profile?.id || getChildSession()?.profileId;
  const userId = user?.id || profileId;
  const isJunior = schoolLevel === "alunno" || schoolLevel === "medie";

  // Build student greeting for header
  const schoolLevelLabel = (() => {
    const lvl = (schoolLevel || "").toLowerCase();
    if (lvl.includes("primaria-1-2")) return "1ª-2ª Elementare";
    if (lvl.includes("primaria-3-5") || lvl === "alunno") return "3ª-5ª Elementare";
    if (lvl.includes("media")) return "Medie";
    if (lvl === "medie") return "Medie";
    if (lvl === "superiori") return "Superiori";
    if (lvl === "universitario") return "Università";
    return "";
  })();
  const classSection = profile?.class_section;
  const studentGreeting = studentName !== "Studente"
    ? `Ciao, ${studentName}!${classSection ? ` • ${classSection}` : schoolLevelLabel ? ` • ${schoolLevelLabel}` : ""}`
    : undefined;

  const guided = useGuidedSession({
    homeworkId,
    userId,
    schoolLevel,
    profileName: studentName,
  });

  useEffect(() => {
    if (type === "guided" && homeworkId) {
      guided.loadSession();
    }
  }, [type, homeworkId]);

  const [setupDone, setSetupDone] = useState(false);
  const [studyMode, setStudyMode] = useState<null | "coach" | "flashcard" | "games">(null);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [topic, setTopic] = useState(urlSubject ? `Ripasso ${urlSubject}` : "");
  const [subject, setSubject] = useState(urlSubject || "");
  const [mode, setMode] = useState<"scritta" | "orale">("scritta");
   const [customSubjects, setCustomSubjects] = useState<string[]>([]);
   const [customSubjectInput, setCustomSubjectInput] = useState("");
   const [showCustomSubjectInput, setShowCustomSubjectInput] = useState(false);
  const [learningGaps, setLearningGaps] = useState<string[]>([]);
  const missionsCompletedRef = useRef(false);
  const [reviewMode, setReviewMode] = useState<"chat" | "flashcard">("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [guidedCustomEmotion, setGuidedCustomEmotion] = useState("");
  const [coachName, setCoachName] = useState<string | undefined>(undefined);
  const [showStudyCelebration, setShowStudyCelebration] = useState(false);
  const [studyPoints, setStudyPoints] = useState<import("@/components/SessionCelebration").PointsEarned | undefined>();
  const [studyTotalPoints, setStudyTotalPoints] = useState<number | undefined>();
  const [studyPrevTotal, setStudyPrevTotal] = useState<number | undefined>();
  const [studyStreak, setStudyStreak] = useState<number | undefined>();
  const [studyFamiliarityDone, setStudyFamiliarityDone] = useState(false);
  const sessionStartRef = useRef<number>(Date.now());

  // MathGame state for elementary students
  const [mathGame, setMathGame] = useState<{ operation: "divisione" | "moltiplicazione" | "addizione" | "sottrazione"; a: number; b: number } | null>(null);
  const [manualGameInput, setManualGameInput] = useState(false);
  const [manualA, setManualA] = useState("");
  const [manualB, setManualB] = useState("");
  const isElementary = true; // mostra il gioco per tutti gli studenti

  // ── Deterministic Math Engine state ──
  const [divExercise, setDivExercise] = useState<DivisionResult | null>(null);
  const [divStepIndex, setDivStepIndex] = useState(0);
  const [divSubStep, setDivSubStep] = useState<"domanda" | "verifica" | "sottrazione" | "abbassa">("domanda");
  const [divAttemptCount, setDivAttemptCount] = useState(0);
  const [divCelleCompilate, setDivCelleCompilate] = useState(0);
  const maxDivAttempts = 4;

  // Helper: build coach message with [COLONNA:] tag for SVG rendering
  const buildCoachMsg = useCallback((feedback: string, question: string, dividendo: number, divisore: number, celleCompilate: number): string => {
    const colonna = `[COLONNA: tipo=divisione, numeri=${dividendo},${divisore}, parziale=true, celle_compilate=${celleCompilate}]`;
    return `${feedback}\n\n${colonna}\n\n${question}`;
  }, []);
  
  console.log('MathGame debug:', { isElementary, profileAge: profile?.age, schoolLevel, topic, mathGame, messagesCount: messages.length, divExercise: !!divExercise });

  // SVG reveal state from coach markers (connected to ColumnOperation via exerciseSteps in ChatShell)
  const [svgElements, setSvgElements] = useState<Array<{element: string; value: string; color: string}>>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSvgElements(prev => [...prev, detail]);
    };
    window.addEventListener('svgReveal', handler);
    return () => window.removeEventListener('svgReveal', handler);
  }, []);

  // Reset svgElements when session starts or new exercise detected
  useEffect(() => {
    if (!setupDone) {
      setSvgElements([]);
      setMathGame(null);
    }
  }, [setupDone]);

  // Detect math operations from topic, systemPrompt and all messages
  useEffect(() => {
    if (mathGame) return;
    
    // Cerca in topic, systemPrompt e tutti i messaggi
    const allText = [
      topic || "",
      ...(messages.map(m => m.content || ""))
    ].join(" ").toLowerCase();

    // Divisione
    const divMatch = allText.match(/(\d+)\s*(?:÷|diviso|:)\s*(\d+)/) ||
                     allText.match(/divid\w+\s+(\d+)\s+(?:per|in|tra)\s+(\d+)/) ||
                     allText.match(/numeri=(\d+),(\d+)/);
    if (divMatch) {
      let a = parseInt(divMatch[1]);
      let b = parseInt(divMatch[2]);
      if (a < b) [a, b] = [b, a];
      if (a > 0 && b > 0 && a <= 50 && b <= 10) {
        setMathGame({ operation: "divisione", a, b });
        return;
      }
    }

    // Moltiplicazione
    const mulMatch = allText.match(/(\d+)\s*(?:×|x|per)\s*(\d+)/);
    if (mulMatch) {
      const a = parseInt(mulMatch[1]);
      const b = parseInt(mulMatch[2]);
      if (a > 0 && b > 0 && a <= 10 && b <= 10) {
        setMathGame({ operation: "moltiplicazione", a, b });
        return;
      }
    }

    // Addizione
    const addMatch = allText.match(/(\d+)\s*\+\s*(\d+)/) ||
                     allText.match(/(\d+)\s+più\s+(\d+)/);
    if (addMatch) {
      const a = parseInt(addMatch[1]);
      const b = parseInt(addMatch[2]);
      if (a > 0 && b > 0 && a <= 20 && b <= 20) {
        setMathGame({ operation: "addizione", a, b });
        return;
      }
    }

    // Sottrazione
    const subMatch = allText.match(/(\d+)\s*(?:-|meno)\s*(\d+)/);
    if (subMatch) {
      const a = parseInt(subMatch[1]);
      const b = parseInt(subMatch[2]);
      if (a > b && a > 0 && b > 0 && a <= 20) {
        setMathGame({ operation: "sottrazione", a, b });
        return;
      }
    }
  }, [topic, messages, mathGame]);

  // ── Activate deterministic math engine when user says "pronto" or AI asks to start exercise ──
  useEffect(() => {
    if (divExercise) return; // already active
    if (messages.length < 3) return; // need at least: welcome, familiarity answer, AI explanation
    
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    const userText = lastUser.content.toLowerCase();
    
    // Check if user said "pronto" or similar
    const isReady = /pronto|sono pronto|iniziamo|proviamo|ok|sì|si|vai/i.test(userText);
    if (!isReady) return;
    
    // Detect division numbers from topic
    const topicLower = (topic || "").toLowerCase();
    const divMatch = topicLower.match(/(\d+)\s*(?:÷|diviso|:)\s*(\d+)/) ||
                     topicLower.match(/numeri=(\d+),(\d+)/);
    if (divMatch) {
      let a = parseInt(divMatch[1]);
      let b = parseInt(divMatch[2]);
      if (a < b) [a, b] = [b, a];
      if (a > 0 && b > 0) {
        const result = calcolaDivisione(a, b);
        setDivExercise(result);
        setDivStepIndex(0);
        setDivSubStep("domanda");
        setDivAttemptCount(0);
        setDivCelleCompilate(0);
        
        // Add the first question with [COLONNA:] tag
        const firstStep = result.passi[0];
        const colonna = `[COLONNA: tipo=divisione, numeri=${a},${b}, parziale=true, celle_compilate=0]`;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Perfetto! 🎯 Ora facciamo **${a} ÷ ${b}** passo per passo.\n\n${colonna}\n\n**Passo 1:** ${firstStep.domanda}`,
        }]);
        return;
      }
    }
  }, [messages, divExercise, topic]);

  // Reset svgElements when coach starts a new exercise
  useEffect(() => {
    if (messages.length === 0) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) return;
    const text = lastAssistant.content.toLowerCase();
    if (/altro esercizio|prossimo esercizio|nuovo problema|adesso prova|proviamo un altro|ora prova questo/i.test(text)) {
      setSvgElements([]);
      setMathGame(null);
      setDivExercise(null);
      setDivStepIndex(0);
      setDivSubStep("domanda");
      setDivAttemptCount(0);
    }
  }, [messages]);

  // Load coach name from preferences
  useEffect(() => {
    const loadCoachName = async () => {
      const pid = getChildSession()?.profileId || profile?.id;
      if (!pid) return;
      const { data } = await supabase.from("user_preferences").select("data").eq("profile_id", pid).maybeSingle();
      const prefs = (data?.data as any) || {};
      if (prefs.coach_name) setCoachName(prefs.coach_name);
    };
    loadCoachName();
  }, []);

  // Fetch learning gaps for prep mode
  useEffect(() => {
    if (type !== "prep" || !userId) return;
    const fetchGaps = async () => {
      const query = supabase
        .from("learning_errors")
        .select("subject, topic, description, error_type")
        .eq("user_id", userId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (subject) query.eq("subject", subject);
      const { data } = await query;
      if (data && data.length > 0) {
        setLearningGaps(data.map(e => `[${e.subject}] ${e.topic || ""}: ${e.description || e.error_type || ""}`).filter(Boolean));
      } else {
        setLearningGaps([]);
      }
    };
    fetchGaps();
  }, [type, subject, userId]);

  useEffect(() => {
    if (urlSubject && type === "review" && !setupDone && !sending) {
      const t = setTimeout(() => startSession(), 100);
      return () => clearTimeout(t);
    }
  }, [urlSubject, type]);

  useEffect(() => {
    if (urlMsg && !setupDone && !sending) {
      setTopic(urlMsg);
      const t = setTimeout(() => {
        const sessionSystemPrompt = getSystemPrompt();
        setSetupDone(true);
        setMessages([]);
        setSending(true);
        setStreamingText("");

        streamChat({
          messages: [
            { role: "user", content: urlMsg },
          ],
          onDelta: () => {},
          onDone: (full) => {
            setMessages([
              { role: "user", content: urlMsg },
              { role: "assistant", content: full },
            ]);
            setStreamingText("");
            setSending(false);
          },
          extraBody: { profileId, subject: subject || undefined, sessionFormat: type, systemPrompt: sessionSystemPrompt },
        });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [urlMsg]);

  // Use profile subjects first, then fall back to school-level subjects
  const favSubjects = profile?.favorite_subjects || profile?.favoriteSubjects || [];
  const diffSubjects = profile?.difficult_subjects || profile?.difficultSubjects || [];
  const profileSubjects = [
    ...favSubjects,
    ...diffSubjects.filter((s: string) => !favSubjects.includes(s)),
  ];
  const subjects = profileSubjects.length > 0 ? profileSubjects : getSubjectsByLevel(schoolLevel);

  function containsExercises(text: string): boolean {
    return /[\d]+\s*[x×:÷+\-*/]\s*[\d]+/.test(text) ||
           /^\s*[\d]/.test(text);
  }

  function getSystemPrompt(): string {
    const cName = coachName || "il Coach";
    switch (type) {
      case "study":
        if (containsExercises(topic)) {
          return `Sei ${cName}, il coach personale di ${studentName} (livello: ${schoolLevel}).

Lo studente ha scritto questi esercizi da svolgere: "${topic}"

REGOLE ASSOLUTE — ESERCIZI SCRITTI MANUALMENTE:
⚠️ REGOLA ASSOLUTA — FORMATTAZIONE MATEMATICA:
Per qualsiasi operazione in colonna usa ESCLUSIVAMENTE il tag [COLONNA:] — MAI pipe (|), trattini (---), o spazi.

FORMATO TAG BASE: [COLONNA: tipo=divisione, numeri=756,2]
FORMATO TAG PARZIALE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=0]
FORMATO CON EVIDENZIAZIONE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=1, evidenzia=qp0:verde]

COLORI: verde=trovato dallo studente, arancione=hint, blu=dato dal coach

FLUSSO COMPLETO PER OPERAZIONI IN COLONNA — 3 FASI:

FASE 1 — INTRODUZIONE TEORICA:
- Spiega brevemente cos'è l'operazione con esempio dalla vita reale adatto all'età
- Definisci TUTTI i termini tecnici con parole semplici

FASE 2 — ESEMPIO SEMPLICE (coach mostra soluzione completa):
- Esempio MOLTO semplice (es. 6 ÷ 2) con tag COLONNA COMPLETO
- Spiega ogni passaggio. UNICO momento dove mostri la soluzione completa.
- Chiedi: "Hai capito? Ora proviamo insieme! 🎯"

FASE 3 — ESERCIZIO REALE (studente lavora, coach guida):
- Mostra colonna vuota: [COLONNA: tipo=..., numeri=..., parziale=true, celle_compilate=0]
- Chiedi: "Ora tocca a te! Come inizieresti?"
- Se CORRETTO: conferma + celle_compilate++ + evidenzia verde + "E ora?"
- Se SBAGLIATO (1°): evidenzia arancione + UN suggerimento + aspetta
- Se SBAGLIATO (2°): spiega + mostra + evidenzia blu + avanti
- RISULTATO FINALE: MAI scriverlo. Chiedi: "Qual è il risultato secondo te?"

1. Lavora ESCLUSIVAMENTE sugli esercizi scritti sopra — non inventarne altri
2. Tratta questo testo esattamente come se fosse un compito caricato
3. Inizia con Fase 1 (introduzione teorica con esempio vita reale)
4. Guida ogni singolo passaggio con spiegazione
5. Non dare MAI la risposta finale — chiedi sempre allo studente di concludere
6. Completa TUTTI gli esercizi in ordine, uno alla volta
7. Non chiedere mai "quali sono i numeri?" — lo studente lo sa già
8. Segui TUTTE le indicazioni scritte (es. "con la prova" = devi fare anche la prova)

TONO: caldo, paziente, incoraggiante. Celebra ogni piccolo progresso.

REGOLA OBBLIGATORIA — INTERAZIONE CONTINUA:
Ogni tuo messaggio DEVE terminare con UNA domanda diretta o invito a rispondere.
Non terminare MAI con una spiegazione secca. MAI più di 4 righe senza una domanda. Frasi corte. Un concetto alla volta. Celebra ogni risposta giusta 🎉
NON usare frasi da sistema informatico. Sei un professore vivo ed entusiasta.`;
        }
        return `Sei ${cName}, il coach personale di ${studentName} (livello: ${schoolLevel}).
L'argomento da studiare è: "${topic}"${subject ? ` (${subject})` : ""}.

═══════════════════════════════════════
FLUSSO APERTURA — MATERIE ORALI
═══════════════════════════════════════
Ogni argomento è sempre nuovo anche se la materia è già stata studiata.
NON usare la storia delle sessioni per saltare la domanda iniziale.

Fai UNA sola domanda iniziale, verbatim:
"Ciao! 👋 Oggi lavoriamo su ${topic}!
Hai già studiato questo argomento o lo vedi per la prima volta?
👉 Prima volta
👉 Lo so in parte
👉 Lo so"

SE risponde PRIMA VOLTA:
→ Leggi insieme allo studente il testo/argomento
→ Spiega i concetti chiave in modo semplice
→ Fai domande di comprensione durante la lettura (non alla fine)
→ Aiuta a identificare parole chiave e concetti da ricordare
→ Costruisci insieme uno schema mentale dell'argomento
→ Alla fine chiedi allo studente di riassumere con parole sue

SE risponde LO SO IN PARTE:
→ Chiedi: "Dimmi quello che sai — raccontami l'argomento con parole tue"
→ Ascolta senza interrompere
→ Identifica buchi e punti deboli dalla risposta
→ Lavora SOLO sui buchi — non ripetere quello che sa già
→ Fai domande mirate sui punti deboli specifici
→ Alla fine fai un mini-riepilogo dei punti su cui lavorare ancora

SE risponde LO SO:
→ NON simulare l'interrogazione — quella è funzione di "Prepara la prova"
→ Dì: "Ottimo! Sei già pronto. Per simulare l'interrogazione vera con valutazione e voto finale, vai su Prepara la prova."
→ Aggiungi il tag [LINK_PREP] nel messaggio

DURANTE LA SESSIONE:
- Lavora SOLO su "${topic}" — niente di più
- Spiega in modo semplice e diretto
- Adatta il linguaggio al livello ${schoolLevel}
- Non dare mai la risposta finale — chiedi allo studente di concludere
- Mai inventare contenuti non presenti nel materiale caricato

TONO: caldo, paziente, incoraggiante. Celebra ogni piccolo progresso.

REGOLA OBBLIGATORIA — INTERAZIONE CONTINUA:
Ogni tuo messaggio DEVE terminare con UNA domanda diretta o invito a rispondere.
Non terminare MAI con una spiegazione secca. MAI più di 4 righe senza una domanda.
Frasi corte. Un concetto alla volta. Celebra ogni risposta giusta 🎉
NON usare frasi da sistema informatico. Sei un professore vivo ed entusiasta.`;
      case "review":
        return `Sei il Coach AI di ${studentName}. Stai facendo un RIPASSO PROFONDO.
MATERIA: ${subject || "generale"}
ARGOMENTO: ${topic}
LIVELLO: ${schoolLevel}

REGOLE:
- Fai domande aperte e profonde — mai rilettura passiva
- Richiamo attivo: lo studente deve ricordare, non rileggere
- Una domanda alla volta
- Dopo la risposta: conferma cosa è giusto, correggi cosa no
- Dopo 3-4 scambi: riassumi i punti forti e deboli emersi
- Sii socratico e incoraggiante
Inizia con la prima domanda sull'argomento.`;
      case "prep": {
        const gapsBlock = learningGaps.length > 0
          ? `\nLACUNE RILEVATE dallo storico dello studente:\n${learningGaps.map(g => `- ${g}`).join("\n")}\nUsa queste lacune per calibrare le domande: insisti sui punti deboli per verificarne il recupero.`
          : "";
        const topicBlock = topic.trim()
          ? `ARGOMENTO SPECIFICO: ${topic.trim()}\nLe domande DEVONO essere focalizzate su questo argomento, tenendo conto delle lacune da colmare.`
          : `Nessun argomento specifico indicato. Fai domande sugli argomenti della materia dove lo studente ha più lacune.${!gapsBlock ? " Copri i concetti fondamentali della materia." : ""}`;
        return `Sei il Coach AI di ${studentName}. Stai conducendo una SIMULAZIONE DI ${mode === "orale" ? "INTERROGAZIONE ORALE" : "VERIFICA SCRITTA"}.
MATERIA: ${subject}
${topicBlock}
LIVELLO: ${schoolLevel}
${gapsBlock}

REGOLE:
- Fai domande calibrate e specifiche — NON domande generiche
- ${mode === "orale" ? "Simula un'interrogazione: una domanda alla volta, attendi risposta, fai follow-up" : "Fai domande di diverso tipo: definizioni, problemi, ragionamento"}
- Adatta la difficoltà: se risponde bene alza, se sbaglia abbassa
- Dopo 5-6 domande, fornisci un REPORT finale strutturato con:
  [REPORT]
  Punti forti: ...
  Punti deboli: ...
  Priorità di ripasso: ...
  [/REPORT]
- Non dare mai la risposta — guida con indizi se bloccato
Inizia con la prima domanda.`;
      }
      default:
        return "";
    }
  }

  function getTitle(): string {
    if (type === "guided") return guided.homework?.title || "Sessione guidata";
    switch (type) {
      case "study":
        return "Studio libero";
      case "review":
        return t("session_review");
      case "prep":
        return t(getPrepLabelKey(schoolLevel));
      default:
        return t("session_default");
    }
  }


  function startSession() {
    if (!topic.trim() && type !== "prep" && type !== "review") return;
    if (!topic.trim() && type === "review" && subject) {
      setTopic(`Ripasso ${subject}`);
    }
    if (!subject && type === "prep") return;

    sessionStartRef.current = Date.now();
    setSetupDone(true);
    setStreamingText("");

    // For prep and review sessions, start normally (no familiarity question)
    if (type === "prep" || type === "review") {
      setMessages([]);
      setSending(true);
      const sessionSystemPrompt = getSystemPrompt();
      streamChat({
        messages: [],
        onDelta: () => {},
        onDone: (full) => {
          setMessages([{ role: "assistant", content: full }]);
          setStreamingText("");
          setSending(false);
        },
        extraBody: { profileId, subject: subject || undefined, sessionFormat: type, systemPrompt: sessionSystemPrompt },
      }).catch(() => {
        setMessages([{ role: "assistant", content: "Mi dispiace, c'è stato un problema. Riprova." }]);
        setStreamingText("");
        setSending(false);
      });
      return;
    }

    // Study session: show welcome message with quick-reply familiarity buttons
    const isMathSession = containsExercises(topic);
    const cName = coachName || "il Coach";
    const welcomeMsg = isMathSession
      ? `Ciao! 👋 Oggi lavoriamo su questi esercizi!\n\nHai già letto l'esercizio?`
      : `Ciao! 👋 Oggi lavoriamo su "${topic}"!\n\nHai già studiato questo argomento o lo vedi per la prima volta?`;

    const familiarityActions: import("@/lib/streamChat").ChatAction[] = isMathSession
      ? [
          { label: t("session_fam_math_yes"), value: "study_fam:already_know", icon: "✅" },
          { label: t("session_fam_math_no"), value: "study_fam:first_time", icon: "📖" },
        ]
      : [
          { label: t("session_fam_oral_yes"), value: "study_fam:already_know", icon: "✅" },
          { label: t("session_fam_oral_partial"), value: "study_fam:partial", icon: "🔶" },
          { label: t("session_fam_oral_no"), value: "study_fam:first_time", icon: "📖" },
        ];

    setMessages([{ role: "assistant", content: welcomeMsg, actions: familiarityActions }]);
    setSending(false);
  }

  // ── Helper: get AI feedback phrase only (no numbers) ──
  const getAiFeedback = useCallback(async (feedbackType: "correct" | "wrong" | "reveal", stepDesc: string): Promise<string> => {
    const feedbackPrompts: Record<string, string> = {
      correct: `Lo studente ha risposto correttamente a: "${stepDesc}". Rispondi con UNA frase breve di incoraggiamento (max 10 parole). NON menzionare numeri. Solo entusiasmo.`,
      wrong: `Lo studente ha sbagliato la risposta a: "${stepDesc}". Rispondi con UNA frase breve di incoraggiamento a riprovare (max 10 parole). NON menzionare numeri, NON dare la risposta. Solo "Quasi! Riprova" o simile.`,
      reveal: `Lo studente ha sbagliato più volte. Rispondi con UNA frase comprensiva tipo "Non preoccuparti, andiamo avanti!" (max 10 parole). NON menzionare numeri.`,
    };
    try {
      const res = await streamChat({
        messages: [{ role: "user", content: feedbackPrompts[feedbackType] }],
        onDelta: () => {},
        onDone: () => {},
        extraBody: { profileId, maxTokens: 50, stream: false },
      });
      // Strip any numbers from AI feedback as safety net
      return res.replace(/\d+/g, "").trim() || (feedbackType === "correct" ? "Esatto! ✅" : feedbackType === "wrong" ? "Quasi! Riprova 💪" : "Non preoccuparti, andiamo avanti! 💪");
    } catch {
      return feedbackType === "correct" ? "Esatto! ✅" : feedbackType === "wrong" ? "Quasi! Riprova 💪" : "Non preoccuparti, andiamo avanti! 💪";
    }
  }, [profileId]);

  // ── Deterministic division step handler ──
  const handleDivisionAnswer = useCallback(async (text: string) => {
    if (!divExercise) return;
    const step = divExercise.passi[divStepIndex];
    if (!step) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    // Determine expected answer based on sub-step
    let expected: number;
    let stepDesc: string;
    switch (divSubStep) {
      case "domanda":
        expected = step.risposta;
        stepDesc = step.domanda;
        break;
      case "verifica":
        expected = step.rispostaVerifica;
        stepDesc = step.verifica;
        break;
      case "sottrazione":
        expected = step.rispostaSottrazione;
        stepDesc = step.sottrazione;
        break;
      case "abbassa":
        expected = parseInt(String(divExercise.dividendo).split("")[divStepIndex + 1]);
        stepDesc = step.abbassa || "";
        break;
      default:
        expected = step.risposta;
        stepDesc = step.domanda;
    }

    const isCorrect = verificaRisposta(text, expected);

    if (isCorrect) {
      const feedback = await getAiFeedback("correct", stepDesc);
      setDivAttemptCount(0);
      const newCelle = divCelleCompilate + 1;
      setDivCelleCompilate(newCelle);

      // Advance to next sub-step or next step
      if (divSubStep === "domanda") {
        setDivSubStep("verifica");
        setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(feedback, `Ora: ${step.verifica}`, divExercise.dividendo, divExercise.divisore, newCelle) }]);
      } else if (divSubStep === "verifica") {
        setDivSubStep("sottrazione");
        setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(feedback, `Ora: ${step.sottrazione}`, divExercise.dividendo, divExercise.divisore, newCelle) }]);
      } else if (divSubStep === "sottrazione") {
        if (step.abbassa) {
          setDivSubStep("abbassa");
          setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(feedback, step.abbassa, divExercise.dividendo, divExercise.divisore, newCelle) }]);
        } else {
          const isLastStep = divStepIndex >= divExercise.passi.length - 1;
          if (isLastStep) {
            const colonna = `[COLONNA: tipo=divisione, numeri=${divExercise.dividendo},${divExercise.divisore}, parziale=true, celle_compilate=${newCelle}]`;
            const finalMsg = `${feedback}\n\n${colonna}\n\n🎉 **Abbiamo finito!**\n\n${divExercise.dividendo} ÷ ${divExercise.divisore} = **${divExercise.quoziente}**${divExercise.resto > 0 ? ` con resto **${divExercise.resto}**` : ""}\n\nBravissimo! 🌟`;
            setMessages(prev => [...prev, { role: "assistant", content: finalMsg }]);
            setDivExercise(null);
          } else {
            setDivStepIndex(prev => prev + 1);
            setDivSubStep("domanda");
            const nextStep = divExercise.passi[divStepIndex + 1];
            setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(feedback, `Passo ${divStepIndex + 2}: ${nextStep.domanda}`, divExercise.dividendo, divExercise.divisore, newCelle) }]);
          }
        }
      } else if (divSubStep === "abbassa") {
        const isLastStep = divStepIndex >= divExercise.passi.length - 1;
        if (isLastStep) {
          const colonna = `[COLONNA: tipo=divisione, numeri=${divExercise.dividendo},${divExercise.divisore}, parziale=true, celle_compilate=${newCelle}]`;
          const finalMsg = `${feedback}\n\n${colonna}\n\n🎉 **Abbiamo finito!**\n\n${divExercise.dividendo} ÷ ${divExercise.divisore} = **${divExercise.quoziente}**${divExercise.resto > 0 ? ` con resto **${divExercise.resto}**` : ""}\n\nBravissimo! 🌟`;
          setMessages(prev => [...prev, { role: "assistant", content: finalMsg }]);
          setDivExercise(null);
        } else {
          setDivStepIndex(prev => prev + 1);
          setDivSubStep("domanda");
          const nextStep = divExercise.passi[divStepIndex + 1];
          setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(feedback, `Passo ${divStepIndex + 2}: ${nextStep.domanda}`, divExercise.dividendo, divExercise.divisore, newCelle) }]);
        }
      }
    } else {
      const newAttempts = divAttemptCount + 1;
      setDivAttemptCount(newAttempts);

      if (newAttempts >= maxDivAttempts) {
        const feedback = await getAiFeedback("reveal", stepDesc);
        setDivAttemptCount(0);
        const newCelle = divCelleCompilate + 1;
        setDivCelleCompilate(newCelle);
        setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(`${feedback}\n\nLa risposta era **${expected}**.`, "", divExercise.dividendo, divExercise.divisore, newCelle) }]);
        
        // Auto-advance to next sub-step
        if (divSubStep === "domanda") {
          setDivSubStep("verifica");
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg("", `Ora: ${step.verifica}`, divExercise.dividendo, divExercise.divisore, newCelle) }]);
          }, 1000);
        } else if (divSubStep === "verifica") {
          setDivSubStep("sottrazione");
          setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg("", `Ora: ${step.sottrazione}`, divExercise.dividendo, divExercise.divisore, newCelle) }]);
          }, 1000);
        } else if (divSubStep === "sottrazione") {
          if (step.abbassa) {
            setDivSubStep("abbassa");
            setTimeout(() => {
              setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg("", step.abbassa || "", divExercise.dividendo, divExercise.divisore, newCelle) }]);
            }, 1000);
          } else {
            advanceDivStep();
          }
        } else {
          advanceDivStep();
        }
      } else {
        const feedback = await getAiFeedback("wrong", stepDesc);
        const hintMsg = newAttempts >= 2 ? `\n\n💡 Suggerimento: pensa a quale numero moltiplicato per ${divExercise.divisore} si avvicina di più a ${step.cifraConsiderata}...` : "";
        setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg(`${feedback}${hintMsg}`, "", divExercise.dividendo, divExercise.divisore, divCelleCompilate) }]);
      }
    }

    setSending(false);
  }, [divExercise, divStepIndex, divSubStep, divAttemptCount, divCelleCompilate, getAiFeedback, profileId, buildCoachMsg]);

  // Helper to advance to next division step
  const advanceDivStep = useCallback(() => {
    if (!divExercise) return;
    const isLastStep = divStepIndex >= divExercise.passi.length - 1;
    if (isLastStep) {
      const colonna = `[COLONNA: tipo=divisione, numeri=${divExercise.dividendo},${divExercise.divisore}, parziale=true, celle_compilate=${divCelleCompilate}]`;
      const finalMsg = `${colonna}\n\n🎉 **Abbiamo finito!**\n\n${divExercise.dividendo} ÷ ${divExercise.divisore} = **${divExercise.quoziente}**${divExercise.resto > 0 ? ` con resto **${divExercise.resto}**` : ""}\n\nBravissimo! 🌟`;
      setMessages(prev => [...prev, { role: "assistant", content: finalMsg }]);
      setDivExercise(null);
    } else {
      setDivStepIndex(prev => prev + 1);
      setDivSubStep("domanda");
      const nextStep = divExercise.passi[divStepIndex + 1];
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: buildCoachMsg("", `Passo ${divStepIndex + 2}: ${nextStep.domanda}`, divExercise.dividendo, divExercise.divisore, divCelleCompilate) }]);
      }, 1000);
    }
  }, [divExercise, divStepIndex, divCelleCompilate, buildCoachMsg]);

  const handleSend = useCallback((text: string) => {
    if (sending) return;

    // If deterministic division is active, handle it locally
    if (divExercise) {
      handleDivisionAnswer(text);
      return;
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSending(true);
    setStreamingText("");

    streamChat({
      messages: newMessages,
      onDelta: () => {},
      onDone: (full) => {
        setMessages(prev => {
          const updated = [...prev, { role: "assistant" as const, content: full }];
          if (!missionsCompletedRef.current && updated.length >= 4) {
            missionsCompletedRef.current = true;
            getDailyMissions().then(missions => {
              for (const mission of missions) {
                if (mission.completed) continue;
                const t = mission.mission_type;
                if (t === "study_session" || (t === "review_concept" && type === "review") || (t === "review_weak_concept" && type === "review")) {
                  completeMission(mission.id, mission.points_reward).catch(() => {});
                }
              }
            }).catch(() => {});
          }
          return updated;
        });
        setStreamingText("");
        setSending(false);
      },
      extraBody: { profileId, subject: subject || undefined, sessionFormat: type, systemPrompt: getSystemPrompt() },
    }).catch(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "Errore. Riprova." }]);
      setStreamingText("");
      setSending(false);
    });
  }, [messages, sending, profileId, subject, divExercise, handleDivisionAnswer]);

  async function handleEndStudySession() {
    setShowEndConfirm(false);
    const pid = profileId || getChildSession()?.profileId;

    // Save conversation to conversation_sessions
    if (pid && messages.length > 0) {
      try {
        await supabase.from("conversation_sessions").insert({
          profile_id: pid,
          titolo: topic || subject || "Studio libero",
          materia: subject || null,
          messaggi: messages.map(m => ({ role: m.role, content: m.content })),
          ruolo_utente: "studente",
        });
      } catch (e) {
        console.error("Save conversation error:", e);
      }

      // Save coach_progress summary
      try {
        const assistantMsgs = messages.filter(m => m.role === "assistant").map(m => m.content || "");
        const userMsgs = messages.filter(m => m.role === "user");
        const correctCount = assistantMsgs.filter(t => /esatto|corrett[oai]|bravo|perfetto|giusto|ottimo|eccellente|✅|🎉/i.test(t) && !/non è corrett|sbagliato/i.test(t)).length;
        const totalAttempts = userMsgs.length || 1;
        const score = Math.round((correctCount / totalAttempts) * 100);

        await supabase.from("coach_progress").insert({
          user_id: pid,
          subject: subject || "generale",
          topic: topic || null,
          score,
          learned: [] as string[],
          struggled: [] as string[],
        });
      } catch (e) {
        console.error("Save coach_progress error:", e);
      }
    }

    // Calculate points
    try {
      const durationSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const durationMin = Math.floor(durationSec / 60);
      const focusPoints = Math.min(10 + durationMin, 20);
      const userMsgCount = messages.filter(m => m.role === "user").length;
      const autonomyPoints = userMsgCount >= 6 ? 10 : userMsgCount >= 3 ? 5 : 0;
      let consistencyPoints = 5;

      if (pid) {
        const gam = await getGamification(pid);
        if (gam && (gam.streak || 0) >= 2) consistencyPoints = 10;
        const prevTotal = (gam?.focus_points || 0) + (gam?.autonomy_points || 0) + (gam?.consistency_points || 0);
        setStudyPrevTotal(prevTotal);
      }

      setStudyPoints({ focus: focusPoints, autonomy: autonomyPoints, consistency: consistencyPoints });

      await saveFocusSession({
        emotion: undefined,
        duration_seconds: durationSec,
        focus_points: focusPoints,
        autonomy_points: autonomyPoints,
        consistency_points: consistencyPoints,
      });

      if (pid) {
        const updatedGam = await getGamification(pid);
        if (updatedGam) {
          setStudyTotalPoints(
            (updatedGam.focus_points || 0) + (updatedGam.autonomy_points || 0) + (updatedGam.consistency_points || 0)
          );
          setStudyStreak(updatedGam.streak || 0);
        }
      }
    } catch (err) {
      console.error("Points calc error:", err);
    }

    setShowStudyCelebration(true);
  }

  async function generateOutput(outputType: string) {
    const outputPrompts: Record<string, string> = {
      schema: `Genera uno schema strutturato dell'argomento "${topic}" basandoti sulla conversazione. Usa punti e sottopunti.`,
      mappa: `Genera una mappa concettuale testuale dell'argomento "${topic}". Mostra le connessioni tra i concetti principali.`,
      sintesi_breve: `Genera una sintesi breve (max 200 parole) dell'argomento "${topic}" basandoti sulla conversazione.`,
      sintesi_estesa: `Genera una sintesi estesa e dettagliata dell'argomento "${topic}" basandoti sulla conversazione.`,
      glossario: `Genera un glossario con i termini chiave dell'argomento "${topic}" emersi dalla conversazione, con definizioni concise.`,
      punti_chiave: `Elenca i 5-10 punti chiave dell'argomento "${topic}" emersi dalla conversazione. Ogni punto in una frase.`,
    };
    handleSend(outputPrompts[outputType] || outputPrompts.schema);
  }

  if (type === "guided") {
    if (guided.loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }

    // Familiarity is now handled via quick-reply buttons in chat — no separate screen needed

    if (guided.showCheckin) {
      // Age-differentiated emotional check-in
      const isElementari = schoolLevel === "alunno" || schoolLevel === "elementari";
      const isMediaLevel = schoolLevel === "medie" || schoolLevel?.startsWith("media-");
      const isUni = schoolLevel === "universitario";

      let checkinQuestion = "Come ti senti per iniziare?";
      let guidedEmotionOptions: { key: string; label: string; icon: string }[];

      if (isElementari) {
        checkinQuestion = "Come ti senti adesso?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Pronto", icon: "😊" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "bloccato", label: "Un po' bloccato", icon: "😕" },
        ];
      } else if (isMediaLevel) {
        checkinQuestion = "Come ti senti per iniziare?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Concentrato", icon: "🎯" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "bloccato", label: "Un po' bloccato", icon: "😕" },
        ];
      } else if (isUni) {
        checkinQuestion = "Come ti senti?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Pronto", icon: "🎯" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "confuso", label: "Distratto", icon: "😵" },
        ];
      } else {
        // superiori
        checkinQuestion = "Come stai adesso?";
        guidedEmotionOptions = [
          { key: "concentrato", label: "Concentrato", icon: "🎯" },
          { key: "stanco", label: "Stanco", icon: "😴" },
          { key: "agitato", label: "Sotto pressione", icon: "😬" },
        ];
      }

      const submitCustomEmotion = () => {
        const value = guidedCustomEmotion.trim();
        if (!value) return;
        guided.startNewSession(value);
      };

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center"
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              {checkinQuestion}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {guided.homework?.title}
            </p>
            <div className={`grid gap-3 mb-4 ${isElementari ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
              {guidedEmotionOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => guided.startNewSession(opt.key)}
                  className={`flex items-center gap-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left ${
                    isElementari ? "p-5" : "p-4"
                  }`}
                >
                  <span className={isElementari ? "text-4xl" : "text-2xl"}>{opt.icon}</span>
                  <span className={`font-medium text-foreground ${isElementari ? "text-lg" : ""}`}>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={guidedCustomEmotion}
                onChange={(e) => setGuidedCustomEmotion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCustomEmotion();
                }}
                placeholder="Se non trovi l'opzione giusta, scrivila qui"
                className="flex-1"
              />
              <Button onClick={submitCustomEmotion} disabled={!guidedCustomEmotion.trim()}>
                Continua
              </Button>
            </div>
          </motion.div>
        </div>
      );
    }

    const handleGuidedBack = () => {
      if (guided.messages.length > 1 && guided.sessionId) {
        setShowPauseDialog(true);
      } else {
        navigate("/dashboard");
      }
    };

    const isReadOnly = guided.sessionCompleted;

    return (
      <>
        <ChatShell
          coachName={coachName}
          title={guided.homework?.title || "Sessione guidata"}
          subtitle={isReadOnly ? `${guided.homework?.subject} · ✅ Completato` : guided.homework?.subject}
          progress={!isReadOnly && (guided.methodPhase === "none" || guided.methodPhase === "ready") ? guided.progressPercent : undefined}
          progressLabel={!isReadOnly && (guided.methodPhase === "none" || guided.methodPhase === "ready") ? guided.progressLabel : undefined}
          messages={guided.messages}
          streamingText={guided.streamingText}
          sending={guided.sending}
          onSend={isReadOnly ? undefined : guided.handleSend}
          onAction={guided.handleMethodAction}
          onEndSession={!isReadOnly ? () => guided.handleMethodAction("finish_session") : undefined}
          onBack={handleGuidedBack}
          showHint={!isReadOnly}
          showStuck={!isReadOnly}
          showExplain={!isReadOnly}
          showVoice={!isReadOnly}
          showAttach={!isReadOnly}
          showPomodoro={!isReadOnly}
          pomodoroMinutes={profile?.focus_time || 25}
          inputPlaceholder={isReadOnly ? "Sessione completata — chat in sola lettura" : "Scrivi la tua risposta..."}
          disabled={isReadOnly}
        />

        <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vuoi mettere in pausa?</AlertDialogTitle>
              <AlertDialogDescription>
                Riprenderemo da dove ti sei fermato la prossima volta.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowPauseDialog(false)}>Continua</AlertDialogCancel>
              <AlertDialogAction onClick={guided.pauseSession} className="bg-primary">Metti in pausa</AlertDialogAction>
              <AlertDialogAction onClick={guided.abandonSession} className="bg-destructive">Abbandona</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SessionCelebration
          isVisible={guided.showCelebration}
          onClose={() => {
            guided.setShowCelebration(false);
            navigate("/dashboard");
          }}
          onGoToReview={() => {
            guided.setShowCelebration(false);
            navigate("/memory?section=ripasso&content=today");
          }}
          studentName={studentName}
          bloomLevel={guided.currentStep}
          subject={guided.homework?.subject || ""}
          isJunior={isJunior}
          pointsEarned={guided.celebrationPoints}
          totalPoints={guided.celebrationTotalPoints}
          previousTotalPoints={guided.celebrationPreviousTotal}
          streak={guided.celebrationStreak}
        />
      </>
    );
  }

  // Study mode: show Challenge session
  if (type === "study" && studyMode === "games") {
    const syntheticConcepts = [{ concept: topic, summary: subject ? `Materia: ${subject}` : "" }];
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton />
          <h1 className="font-display text-lg font-bold text-foreground">{t("study_mode_games_title")}</h1>
        </div>
        <GameSession
          subject={subject || topic}
          topic={topic}
          section="ripasso"
          concepts={syntheticConcepts}
          onClose={() => { setStudyMode(null); setShowModeSelect(true); }}
        />
      </div>
    );
  }

  // Study mode selection step (between setup and session)
  if (type === "study" && showModeSelect && !setupDone) {
    const displayCoachName = coachName || "il Coach";
    const modeCards = [
      { id: "coach" as const, icon: MessageCircle, titleKey: "study_mode_coach_title", descKey: "study_mode_coach_desc" },
      { id: "flashcard" as const, icon: Brain, titleKey: "study_mode_flashcard_title", descKey: "study_mode_flashcard_desc" },
      { id: "games" as const, icon: Gamepad2, titleKey: "study_mode_games_title", descKey: "study_mode_games_desc" },
    ];

    const handleModeSelect = (modeId: "coach" | "flashcard" | "games") => {
      setStudyMode(modeId);
      if (modeId === "coach") {
        startSession();
      } else if (modeId === "flashcard") {
        const params = new URLSearchParams();
        params.set("mode", "topic");
        if (topic) params.set("topic", topic);
        if (subject) params.set("subject", subject);
        navigate(`/flashcards?${params.toString()}`);
      }
      // games mode handled by studyMode === "games" block above
    };

    return (
      <div className="min-h-screen bg-muted/40 pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton />
          <h1 className="font-display text-lg font-bold text-foreground">{getTitle()}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-card rounded-2xl shadow-sm p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-foreground">{t("study_mode_heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("study_mode_subtitle")}</p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{topic}</span>
              {subject && <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{subject}</span>}
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
                <p className="text-xs text-muted-foreground leading-relaxed">{t(card.descKey).replace("{{coachName}}", displayCoachName)}</p>
              </motion.button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={() => { setShowModeSelect(false); setStudyMode(null); }}
            className="w-full"
          >
            ← {t("study_free_heading")}
          </Button>
        </div>
        </div>
      </div>
    );
  }

  if (!setupDone) {
    const studyChipColors: Record<string, { base: string; selected: string }> = {
      'Matematica': { base: 'bg-blue-50 text-blue-700 border-blue-200', selected: 'bg-blue-500 text-white border-blue-500' },
      'Italiano': { base: 'bg-green-50 text-green-700 border-green-200', selected: 'bg-green-500 text-white border-green-500' },
      'Storia': { base: 'bg-orange-50 text-orange-700 border-orange-200', selected: 'bg-orange-500 text-white border-orange-500' },
      'Inglese': { base: 'bg-purple-50 text-purple-700 border-purple-200', selected: 'bg-purple-500 text-white border-purple-500' },
      'Scienze': { base: 'bg-teal-50 text-teal-700 border-teal-200', selected: 'bg-teal-500 text-white border-teal-500' },
      'Arte': { base: 'bg-pink-50 text-pink-700 border-pink-200', selected: 'bg-pink-500 text-white border-pink-500' },
      'Musica': { base: 'bg-yellow-50 text-yellow-700 border-yellow-200', selected: 'bg-yellow-500 text-white border-yellow-500' },
      'Geografia': { base: 'bg-indigo-50 text-indigo-700 border-indigo-200', selected: 'bg-indigo-500 text-white border-indigo-500' },
      'Tecnologia': { base: 'bg-gray-100 text-gray-700 border-gray-200', selected: 'bg-gray-500 text-white border-gray-500' },
      'Fisica': { base: 'bg-cyan-50 text-cyan-700 border-cyan-200', selected: 'bg-cyan-500 text-white border-cyan-500' },
      'Filosofia': { base: 'bg-amber-50 text-amber-700 border-amber-200', selected: 'bg-amber-500 text-white border-amber-500' },
      'Latino': { base: 'bg-rose-50 text-rose-700 border-rose-200', selected: 'bg-rose-500 text-white border-rose-500' },
      'Greco': { base: 'bg-stone-100 text-stone-700 border-stone-200', selected: 'bg-stone-500 text-white border-stone-500' },
    };
    const defaultChipColor = { base: 'bg-gray-50 text-gray-600 border-gray-200', selected: 'bg-gray-500 text-white border-gray-500' };

    const getChipColor = (s: string, isSelected: boolean) => {
      const colors = studyChipColors[s] || defaultChipColor;
      return isSelected ? colors.selected : colors.base;
    };

    const addCustomSubject = (val: string) => {
      if (val && !subjects.includes(val) && !customSubjects.includes(val)) {
        setCustomSubjects(prev => [...prev, val]);
        setSubject(val);
      }
      setCustomSubjectInput("");
      setShowCustomSubjectInput(false);
    };

    const isStudyType = type === "study";

    return (
      <div className={`min-h-screen pb-24 ${isStudyType ? "bg-muted/40" : "bg-background"}`}>
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <PageBackButton to="/dashboard" />
          <h1 className="font-display text-lg font-bold text-foreground">{getTitle()}</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className={isStudyType ? "bg-card rounded-2xl shadow-sm p-8 space-y-6" : "space-y-6"}>
          {type === "review" ? (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-foreground text-center">{t("review_choose_heading")}</h2>
              <div className="space-y-3 pt-1">
                {[
                  { id: "today", label: t("review_today"), desc: t("review_today_desc"), icon: CalendarDays },
                  { id: "cumulative", label: t("review_cumulative"), desc: t("review_cumulative_desc"), icon: Brain },
                  { id: "prep", label: t(getPrepLabelKey(schoolLevel)), desc: t("review_prep_desc"), icon: GraduationCap },
                ].map((opt, i) => (
                  <motion.button
                    key={opt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 30, delay: i * 0.05 }}
                    onClick={() => setTopic(opt.label)}
                    className={`w-full flex flex-col items-center gap-2 p-6 rounded-2xl border text-center transition-all group ${
                      topic === opt.label
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border bg-card hover:border-primary/40 hover:shadow-md"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-1 transition-colors ${
                      topic === opt.label ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary group-hover:bg-primary/15"
                    }`}>
                      <opt.icon className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                  </motion.button>
                ))}
              </div>

              <div className="relative pt-1">
                <div className="absolute left-3 top-1/2 -translate-y-[40%]">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                </div>
                <Input
                  value={topic.startsWith("Ripassa") || topic.startsWith("Ripasso") || topic.startsWith("Review") || topic.startsWith("Prepare") || topic === t(getPrepLabelKey(schoolLevel)) ? "" : topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder={t("review_topic_placeholder")}
                  className="text-sm pl-9"
                />
              </div>
            </div>
          ) : type !== "prep" && (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-foreground">{t("study_free_heading")}</h2>
              <p className="text-sm text-muted-foreground">{t("study_free_subtitle")}</p>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={t("study_free_placeholder")}
                className="text-base h-12"
                onKeyDown={e => {
                  if (e.key === "Enter" && topic.trim() && type === "study") {
                    setShowModeSelect(true);
                  }
                }}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block text-center">
              {type === "prep" ? t("label_subject") : t("label_subject_optional")}
            </label>
            <div className="flex flex-wrap gap-2.5 justify-center">
              {[...subjects, ...customSubjects].map((s: string) => {
                const isSelected = subject === s;
                const isCustom = customSubjects.includes(s);
                return (
                  <button key={s} onClick={() => setSubject(isSelected ? "" : s)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-all inline-flex items-center gap-1 cursor-pointer ${
                      isStudyType ? getChipColor(s, isSelected) : (
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
                      )
                    }`}>
                    {s}
                    {isCustom && (
                      <span onClick={(e) => { e.stopPropagation(); setCustomSubjects(prev => prev.filter(c => c !== s)); if (subject === s) setSubject(""); }}
                        className="ml-1 hover:text-destructive cursor-pointer"><X className="w-3 h-3" /></span>
                    )}
                  </button>
                );
              })}
              {isStudyType ? (
                showCustomSubjectInput ? (
                  <div className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-muted-foreground/30 px-2 py-0.5">
                    <input
                      autoFocus
                      value={customSubjectInput}
                      onChange={e => setCustomSubjectInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && customSubjectInput.trim()) {
                          e.preventDefault();
                          addCustomSubject(customSubjectInput.trim());
                        }
                        if (e.key === "Escape") setShowCustomSubjectInput(false);
                      }}
                      onBlur={() => { if (!customSubjectInput.trim()) setShowCustomSubjectInput(false); }}
                      placeholder={t("add_custom_subject_placeholder")}
                      className="bg-transparent border-none outline-none text-sm w-28 text-foreground placeholder:text-muted-foreground"
                    />
                    <button onClick={() => { if (customSubjectInput.trim()) addCustomSubject(customSubjectInput.trim()); else setShowCustomSubjectInput(false); }}
                      className="text-muted-foreground hover:text-foreground">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomSubjectInput(true)}
                    className="rounded-full px-4 py-1.5 text-sm border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("add_subject_chip")}
                  </button>
                )
              ) : null}
            </div>
            {!isStudyType && (
              <div className="flex gap-2 mt-3 max-w-sm mx-auto">
                <Input
                  value={customSubjectInput}
                  onChange={e => setCustomSubjectInput(e.target.value)}
                  placeholder={t("add_custom_subject_placeholder")}
                  className="flex-1 h-9 text-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter" && customSubjectInput.trim()) {
                      e.preventDefault();
                      addCustomSubject(customSubjectInput.trim());
                    }
                  }}
                />
                <Button size="sm" variant="outline" className="h-9 px-3"
                  disabled={!customSubjectInput.trim()}
                  onClick={() => addCustomSubject(customSubjectInput.trim())}>+</Button>
              </div>
            )}
          </div>

          {type === "review" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block text-center">{t("review_mode_label")}</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewMode("chat")}
                  className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-2xl border text-sm font-medium transition-all ${
                    reviewMode === "chat"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reviewMode === "chat" ? "bg-primary/15" : "bg-muted"}`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  {t("review_mode_deep")}
                </button>
                <button
                  onClick={() => setReviewMode("flashcard")}
                  className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-2xl border text-sm font-medium transition-all ${
                    reviewMode === "flashcard"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reviewMode === "flashcard" ? "bg-primary/15" : "bg-muted"}`}>
                    <Brain className="w-5 h-5" />
                  </div>
                  Flashcard
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {reviewMode === "chat"
                  ? t("review_mode_deep_desc")
                  : t("review_mode_flashcard_desc")}
              </p>
            </div>
          )}

          {type === "prep" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block text-center">{t("prep_sim_type_label")}</label>
              <div className="flex gap-3">
                {([ ["scritta", t("prep_sim_written")], ["orale", t("prep_sim_oral")] ] as const).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m as "scritta" | "orale")}
                    className={`flex-1 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
                      mode === m
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "prep" && (
            <div className="text-center">
              <label className="text-sm font-medium text-foreground mb-1 block">{t("prep_topic_label")}</label>
              <p className="text-xs text-muted-foreground mb-2">
                {topic.trim()
                  ? t("prep_topic_hint_filled")
                  : t("prep_topic_hint_empty")}
              </p>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={t("prep_topic_placeholder")}
                className="text-sm"
              />
            </div>
          )}

          <Button
            onClick={() => {
              if (type === "study") {
                setShowModeSelect(true);
                return;
              }
              if (type === "review" && reviewMode === "flashcard") {
                navigate(`/flashcards${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`);
                return;
              }
              startSession();
            }}
            disabled={type === "prep" ? !subject : type === "review" && reviewMode === "flashcard" ? false : !topic.trim()}
            className="w-full h-12 text-base font-semibold"
          >
            {type === "prep" ? t("prep_start_btn") : type === "review" ? (reviewMode === "flashcard" ? t("review_start_flashcard") : t("review_start_deep")) : t("study_next_btn")}
          </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleMathGameAnswer = (answer: number) => {
    setMathGame(null);
    handleSend(String(answer));
  };

  const studyOutputFooter = (
    <>
      <AnimatePresence>
        {mathGame && (
          <div className="px-4 py-2">
            <MathGame
              operation={mathGame.operation}
              a={mathGame.a}
              b={mathGame.b}
              onAnswer={handleMathGameAnswer}
              onClose={() => setMathGame(null)}
            />
          </div>
        )}
      </AnimatePresence>
      {/* Manual MathGame trigger button - always visible when no game active */}
      {!mathGame && messages.length >= 1 && (
        <div className="px-4 py-1 flex gap-2">
          <button
            onClick={() => {
              const allText = messages.map(m => m.content || "").join(" ") + " " + (topic || "");
              const colonnaM = allText.match(/\[COLONNA:\s*tipo=(\w+),\s*numeri=(\d+),(\d+)/i);
              if (colonnaM) {
                const tipoMap: Record<string, "divisione"|"moltiplicazione"|"addizione"|"sottrazione"> = {
                  divisione: "divisione", moltiplicazione: "moltiplicazione",
                  addizione: "addizione", sottrazione: "sottrazione",
                };
                const op = tipoMap[colonnaM[1].toLowerCase()];
                if (op) { setMathGame({ operation: op, a: parseInt(colonnaM[2]), b: parseInt(colonnaM[3]) }); return; }
              }
              const divM = allText.match(/(\d+)\s*(?:÷|diviso|:|\/)\s*(\d+)/i);
              const mulM = !divM && allText.match(/(\d+)\s*(?:×|x|per)\s*(\d+)/i);
              const addM = !divM && !mulM && allText.match(/(\d+)\s*\+\s*(\d+)/);
              const subM = !divM && !mulM && !addM && allText.match(/(\d+)\s*(?:-|meno)\s*(\d+)/i);
              if (divM) {
                let a = parseInt(divM[1]), b = parseInt(divM[2]);
                if (a < b) [a, b] = [b, a];
                setMathGame({ operation: "divisione", a, b });
              } else if (mulM) {
                setMathGame({ operation: "moltiplicazione", a: parseInt(mulM[1]), b: parseInt(mulM[2]) });
              } else if (addM) {
                setMathGame({ operation: "addizione", a: parseInt(addM[1]), b: parseInt(addM[2]) });
              } else if (subM) {
                setMathGame({ operation: "sottrazione", a: parseInt(subM[1]), b: parseInt(subM[2]) });
              } else {
                setManualGameInput(true);
              }
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:border-foreground/40 whitespace-nowrap transition-colors"
          >
            <Gamepad2 className="w-3 h-3" />
            🎮 Gioco
          </button>
        </div>
      )}
      {/* Manual number input fallback */}
      {manualGameInput && !mathGame && (
        <div className="px-4 py-2 flex items-center gap-2 border-t border-border bg-muted/50">
          <span className="text-xs text-muted-foreground">Inserisci:</span>
          <Input
            type="number"
            placeholder="A"
            className="w-16 h-8 text-sm"
            value={manualA}
            onChange={e => setManualA(e.target.value)}
          />
          <span className="text-xs">÷</span>
          <Input
            type="number"
            placeholder="B"
            className="w-16 h-8 text-sm"
            value={manualB}
            onChange={e => setManualB(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              const a = parseInt(manualA), b = parseInt(manualB);
              if (a > 0 && b > 0) {
                setMathGame({ operation: "divisione", a, b });
                setManualGameInput(false);
                setManualA(""); setManualB("");
              }
            }}
          >Inizia</Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setManualGameInput(false); setManualA(""); setManualB(""); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      {type === "study" && messages.length >= 4 && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground mb-2">Genera un output dalla sessione:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {OUTPUT_TYPES.map(ot => (
              <button
                key={ot.id}
                onClick={() => generateOutput(ot.id)}
                disabled={sending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:border-foreground/40 whitespace-nowrap transition-colors"
              >
                <ot.icon className="w-3 h-3" />
                {ot.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // Handle study session familiarity action clicks — defined as regular function to avoid hook ordering issues
  function handleStudyAction(value: string) {
    if (value.startsWith("study_fam:")) {
      const famKey = value.replace("study_fam:", "");
      setStudyFamiliarityDone(true);

      const isMathSession = containsExercises(topic);
      const labelMap: Record<string, string> = {
        already_know: isMathSession ? t("session_fam_math_yes") : t("session_fam_oral_yes"),
        partial: t("session_fam_oral_partial"),
        first_time: isMathSession ? t("session_fam_math_no") : t("session_fam_oral_no"),
      };
      const userLabel = (labelMap[famKey] || value).replace(/^[✅📖🔶]\s*/, "");

      setMessages(prev => [
        ...prev.map(m => ({ ...m, actions: undefined })),
        { role: "user" as const, content: userLabel },
      ]);
      setSending(true);
      setStreamingText("");

      let familiarityInstruction = "";
      if (famKey === "first_time") {
        familiarityInstruction = isMathSession
          ? "\nLo studente NON ha ancora letto l'esercizio. Fai spiegazione teorica completa del metodo, poi un esempio semplice risolto, poi parti con l'esercizio."
          : "\nLo studente vede questo argomento per la prima volta. Leggi insieme, spiega i concetti chiave, fai domande durante la lettura.";
      } else if (famKey === "partial") {
        familiarityInstruction = "\nLo studente conosce parzialmente l'argomento. Chiedi cosa sa, identifica le lacune, lavora solo sui punti deboli.";
      } else {
        familiarityInstruction = isMathSession
          ? "\nLo studente ha GIÀ LETTO l'esercizio. Ripetizione brevissima del metodo (2-3 righe max), poi vai direttamente all'esercizio."
          : "\nLo studente dice di conoscere l'argomento. Non simulare l'interrogazione. Dì: 'Ottimo! Sei già pronto. Per simulare l'interrogazione vera vai su Prepara la prova.' e aggiungi [LINK_PREP].";
      }

      const sessionSystemPrompt = getSystemPrompt() + familiarityInstruction;
      const allMsgs = [
        ...messages.map(m => ({ ...m, actions: undefined })),
        { role: "user" as const, content: userLabel },
      ];

      streamChat({
        messages: allMsgs,
        onDelta: () => {},
        onDone: (full) => {
          setMessages(prev => [...prev, { role: "assistant" as const, content: full }]);
          setStreamingText("");
          setSending(false);
        },
        extraBody: { profileId, subject: subject || undefined, sessionFormat: type, systemPrompt: sessionSystemPrompt },
      }).catch(() => {
        setMessages(prev => [...prev, { role: "assistant" as const, content: "Errore. Riprova." }]);
        setStreamingText("");
        setSending(false);
      });
    }
  }

  return (
    <>
      <ChatShell
        coachName={coachName}
        studentGreeting={studentGreeting}
        title={topic || subject || getTitle()}
        subtitle={subject && topic ? subject : undefined}
        badgeText={type === "prep" ? (mode === "orale" ? "Orale" : "Scritta") : undefined}
        messages={messages}
        streamingText={streamingText}
        sending={sending}
        onSend={handleSend}
        onAction={handleStudyAction}
        onEndSession={() => setShowEndConfirm(true)}
        onBack={() => {
          if (type === "study" && studyMode === "coach") {
            setSetupDone(false);
            setStudyMode(null);
            setShowModeSelect(true);
            setMessages([]);
            setStreamingText("");
            setSending(false);
            return;
          }
          navigate(-1);
        }}
        showHint={type !== "prep"}
        showStuck={type !== "prep"}
        showExplain={true}
        showVoice={type === "prep" ? mode === "orale" || schoolLevel === "superiori" || schoolLevel === "universitario" : true}
        showAttach={type === "study"}
        extraFooter={studyOutputFooter}
        inputPlaceholder={type === "prep" ? "Scrivi la tua risposta..." : "Scrivi..."}
      />

      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminare la sessione?</AlertDialogTitle>
            <AlertDialogDescription>
              I tuoi progressi verranno salvati e riceverai i punti guadagnati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continua a studiare</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndStudySession} className="bg-primary">
              Termina e salva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionCelebration
        isVisible={showStudyCelebration}
        onClose={() => {
          setShowStudyCelebration(false);
          navigate("/dashboard");
        }}
        onGoToReview={() => {
          setShowStudyCelebration(false);
          navigate("/memory?section=ripasso&content=today");
        }}
        studentName={studentName}
        bloomLevel={0}
        subject={subject || topic || ""}
        isJunior={isJunior}
        pointsEarned={studyPoints}
        totalPoints={studyTotalPoints}
        previousTotalPoints={studyPrevTotal}
        streak={studyStreak}
      />
    </>
  );
}
