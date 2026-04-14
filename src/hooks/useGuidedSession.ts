import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTask as fetchTask, getDailyMissions, completeMission, saveFocusSession, getGamification } from "@/lib/database";
import type { PointsEarned } from "@/components/SessionCelebration";
import { isChildSession, childApi, getChildSession } from "@/lib/childSession";
import { ChatMsg, ChatAction, streamChat } from "@/lib/streamChat";
import { getCurrentLang } from "@/lib/langUtils";
import { playCelebrationSound } from "@/lib/celebrationSound";

interface UseGuidedSessionProps {
  homeworkId: string | null;
  userId: string | undefined;
  schoolLevel: string;
  profileName: string;
}

// Task types that use the oral/study method (vs exercise method)
const ORAL_STUDY_TYPES = new Set(["study", "memorize", "teoria", "memorizzazione", "ripasso", "interrogazione", "esame", "riassunto", "summarize", "read"]);

// Recovery tasks always default to first_time
const RECOVERY_TYPES = new Set(["recupero", "recovery", "rinforzo"]);

function isRecoveryTask(taskType: string, title: string): boolean {
  const types = taskType.split(",").map(t => t.trim().toLowerCase());
  if (types.some(t => RECOVERY_TYPES.has(t))) return true;
  return title.toLowerCase().includes("recupero") || title.toLowerCase().includes("rinforzo");
}

// Check if mic was already suggested to this student (once-ever)
async function checkMicSuggested(userId: string | undefined, isChild: boolean): Promise<boolean> {
  if (!userId) return false;
  try {
    if (isChild) {
      const session = getChildSession();
      const profileId = session?.profileId;
      if (!profileId) return false;
      const { data } = await (supabase as any).from("user_preferences").select("data").eq("profile_id", profileId).maybeSingle();
      return !!(data?.data?.mic_suggested);
    }
    const { data } = await supabase.from("user_preferences").select("data").eq("profile_id", userId).maybeSingle();
    return !!((data?.data as any)?.mic_suggested);
  } catch { return false; }
}

async function markMicSuggested(userId: string | undefined, isChild: boolean): Promise<void> {
  if (!userId) return;
  try {
    const profileId = isChild ? getChildSession()?.profileId : userId;
    if (!profileId) return;
    const { data: existing } = await (supabase as any).from("user_preferences").select("id, data").eq("profile_id", profileId).maybeSingle();
    const newData = { ...(existing?.data || {}), mic_suggested: true };
    if (existing) {
      await (supabase as any).from("user_preferences").update({ data: newData, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await (supabase as any).from("user_preferences").insert({ profile_id: profileId, data: newData });
    }
  } catch (e) { console.error("Failed to mark mic_suggested:", e); }
}

// Familiarity memory — persist per homework so we don't ask twice
function getSavedFamiliarity(homeworkId: string): Familiarity | null {
  try {
    const stored = localStorage.getItem(`inschool-familiarity-${homeworkId}`);
    return stored as Familiarity | null;
  } catch { return null; }
}

function saveFamiliarity(homeworkId: string, fam: Familiarity) {
  try { localStorage.setItem(`inschool-familiarity-${homeworkId}`, fam); } catch {}
}

function isOralStudyTask(taskType: string, title: string): boolean {
  const types = taskType.split(",").map(t => t.trim().toLowerCase());
  if (types.some(t => ORAL_STUDY_TYPES.has(t))) return true;
  const lowerTitle = title.toLowerCase();
  return ["studia", "ripeti", "memorizza", "prepara", "ripasso", "interrogazione", "esame", "riassumi"].some(k => lowerTitle.includes(k));
}

/** Build an emotion-aware greeting prefix based on the check-in response */
function emotionGreeting(emotion: string, name: string, title: string): string {
  const e = emotion.toLowerCase();
  if (["stanco", "tired"].includes(e))
    return `Ciao ${name}! 👋 Vedo che oggi sei un po' stanco — nessun problema, andiamo con calma su "${title}".\n\n`;
  if (["bloccato", "stuck", "confused"].includes(e))
    return `Ciao ${name}! 👋 Capisco che ti senti un po' bloccato — facciamo un passo alla volta su "${title}", sono qui per aiutarti!\n\n`;
  if (["agitato", "sotto pressione", "anxious"].includes(e))
    return `Ciao ${name}! 👋 Tranquillo, facciamo tutto con calma. Oggi lavoriamo su "${title}" senza fretta.\n\n`;
  if (["confuso", "distratto"].includes(e))
    return `Ciao ${name}! 👋 Nessun problema se ti senti un po' distratto — partiamo piano con "${title}".\n\n`;
  if (["concentrato", "carico", "curioso", "pronto"].includes(e))
    return `Ciao ${name}! 👋 Ottimo, sei carico! Oggi lavoriamo su "${title}".\n\n`;
  // Custom free-text emotion
  if (e.length > 0)
    return `Ciao ${name}! 👋 Grazie per avermelo detto — oggi lavoriamo su "${title}" e ci adattiamo al tuo ritmo.\n\n`;
  // Fallback — no emotion
  return `Ciao! 👋 Oggi lavoriamo su "${title}"!\n\n`;
}

function isMathSubject(subject?: string | null, title?: string): boolean {
  const mathKeywords = ["matematica", "math", "aritmetica", "geometria", "algebra", "calcolo"];
  const s = (subject || "").toLowerCase();
  const t = (title || "").toLowerCase();
  return mathKeywords.some(k => s.includes(k) || t.includes(k));
}

type MethodPhase = "none" | "propose_method" | "ready";
type Familiarity = "first_time" | "already_know" | "partial";

const EXERCISE_ITEM_REGEX = /\d+\s*[x×:÷+\-*/]\s*\d+/i;
const EXERCISE_PROOF_REGEX = /\b(con la prova|fai la prova|fare la prova|prova della divisione|prova del nove)\b/i;

function extractExactExercises(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(item => item.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean)
    .filter(item => EXERCISE_ITEM_REGEX.test(item));
}

function requiresOperationProof(taskType: string, title: string, description: string | null | undefined): boolean {
  const isExerciseTask = !isOralStudyTask(taskType, title) && !isMixedWritingTask(taskType, title);
  if (!isExerciseTask) return false;
  return EXERCISE_PROOF_REGEX.test(`${title} ${description || ""}`);
}

function getVisibleLoadedContent(taskType: string, title: string, description: string | null | undefined, stepText?: string) {
  const isExerciseTask = !isOralStudyTask(taskType, title) && !isMixedWritingTask(taskType, title);
  if (isExerciseTask) {
    const exercises = extractExactExercises(description || "");
    if (exercises.length > 0) return exercises.join("\n");
  }
  return stepText || description || title;
}

function buildExactExerciseSteps(
  taskType: string,
  title: string,
  description: string,
  familiarity: Familiarity | null,
): Array<{ number: number; text: string; bloomLevel: number }> {
  const exercises = extractExactExercises(description);
  if (exercises.length === 0) return [];

  const needsProof = requiresOperationProof(taskType, title, description);
  const intro = familiarity === "first_time"
    ? `Spiega in modo breve e semplice il metodo necessario per questi esercizi, poi presenta TU il primo esercizio esattamente come scritto.${needsProof ? " La consegna richiede anche la prova finale, quindi dopo ogni operazione devi guidare anche la prova." : ""}`
    : familiarity === "partial"
    ? `Riprendi con una mini spiegazione del metodo, poi presenta TU il primo esercizio esattamente come scritto.${needsProof ? " Ricorda: dopo ogni operazione devi guidare anche la prova finale." : ""}`
    : `Presenta TU il primo esercizio esattamente come scritto e guidane subito la risoluzione con domande mirate.${needsProof ? " Non considerare concluso l'esercizio finché non hai guidato anche la prova." : ""}`;

  const steps: Array<{ number: number; text: string; bloomLevel: number }> = [
    { number: 1, text: intro, bloomLevel: 1 },
  ];

  exercises.forEach((exercise, index) => {
    steps.push({
      number: steps.length + 1,
      text: `Lavora esclusivamente su questo esercizio, riportandolo esattamente com'è scritto: ${exercise}${needsProof ? ". Dopo il risultato, NON fermarti: guida anche la prova di questo stesso esercizio." : ""}`,
      bloomLevel: Math.min(4, index + 2),
    });

    if (needsProof) {
      steps.push({
        number: steps.length + 1,
        text: `Ora guida la prova dello stesso esercizio: ${exercise}. Se è una divisione, verifica con divisore × quoziente + resto = dividendo. Se è un'altra operazione, usa la verifica corretta. Non passare all'esercizio successivo finché la prova non è completata.`,
        bloomLevel: Math.min(5, index + 3),
      });
    }
  });

  return steps;
}

function sanitizeExerciseSteps(
  rawSteps: any[],
  taskType: string,
  title: string,
  description: string | null | undefined,
  familiarity: Familiarity | null,
) {
  const isExerciseTask = !isOralStudyTask(taskType, title) && !isMixedWritingTask(taskType, title);
  if (!isExerciseTask) return rawSteps;

  const exactSteps = buildExactExerciseSteps(taskType, title, description || "", familiarity);
  return exactSteps.length > 0 ? exactSteps : rawSteps;
}

function isMixedWritingTask(taskType: string, title: string): boolean {
  const types = taskType.split(",").map(t => t.trim().toLowerCase());
  if (types.some(t => ["riassunto", "summarize", "write", "tema", "testo"].includes(t))) return true;
  const lowerTitle = title.toLowerCase();
  return ["riassumi", "scrivi", "tema", "testo"].some(k => lowerTitle.includes(k));
}

function getMethodProposal(familiarity: Familiarity, taskType: string, title: string): string {
  const lowerTitle = title.toLowerCase();
  const isPrep = ["interrogazione", "esame", "prepara"].some(k => lowerTitle.includes(k)) || taskType === "interrogazione" || taskType === "esame";
  const isMemorize = lowerTitle.includes("memorizza") || taskType === "memorizzazione";
  const isExercise = !isOralStudyTask(taskType, title) && !isMixedWritingTask(taskType, title);
  const isMixed = isMixedWritingTask(taskType, title);

  switch (familiarity) {
    case "first_time":
      if (isMixed) return "Ok. Ti guido io nella struttura passo per passo prima di iniziare a scrivere.";
      if (isExercise) return "Ok, è la prima volta. Ti spiego prima la teoria necessaria, poi affrontiamo l'esercizio passo dopo passo insieme.";
      return "Allora partiamo leggendolo una volta per capire di cosa si tratta. Poi lo dividiamo in pezzi piccoli e lavoriamo su ognuno insieme.";
    case "already_know":
      if (isPrep) return "Bene. Partiamo da quello che ricordi già. Ti faccio qualche domanda e vediamo subito dove sei sicuro e dove serve rinforzare.";
      if (isMemorize) return "Perfetto. Allora chiudiamo il materiale e partiamo da quello che hai in testa. Quello che non ricordi lo riprendiamo insieme.";
      if (isExercise) return "Bene, allora proviamo subito l'esercizio. Se ti blocchi ti do un suggerimento.";
      if (isMixed) return "Perfetto. Partiamo direttamente — intervento solo sulla revisione.";
      return "Bene. Partiamo da quello che ricordi già. Ti faccio qualche domanda e vediamo subito dove sei sicuro e dove serve rinforzare.";
    case "partial":
      if (isExercise) return "Ok. Rivediamo velocemente la parte che non ricordi bene, poi affrontiamo l'esercizio insieme.";
      if (isMixed) return "Ok. Ti propongo uno schema di partenza, poi ti lascio procedere e intervengo dove serve.";
      return "Ok. Finiamo prima le parti che non hai ancora studiato, poi passiamo a richiamare tutto dalla memoria.";
  }
}

function getCoachBehaviorForFamiliarity(familiarity: Familiarity): string {
  switch (familiarity) {
    case "first_time":
      return `CASO: Prima volta — Lo studente non ha mai studiato questo argomento.
REGOLE:
- Leggi insieme allo studente il testo/argomento
- Spiega i concetti chiave in modo semplice, un blocco alla volta
- Fai domande di comprensione durante la lettura (non alla fine)
- Aiuta a identificare le parole chiave e i concetti da ricordare
- Costruisci insieme allo studente uno schema mentale dell'argomento
- Alla fine chiedi allo studente di riassumere con parole sue
- Non far mai rileggere passivamente — sei tu che presenti e spieghi`;

    case "already_know":
      return `CASO: Lo conosco già — Lo studente dice di conoscere l'argomento.
REGOLE:
- NON simulare l'interrogazione — quella è funzione di "Prepara la prova"
- Dì: "Ottimo! Sei già pronto. Per simulare l'interrogazione vera con valutazione e voto finale, vai su Prepara la prova."
- Aggiungi il tag [LINK_PREP] nel messaggio per mostrare il pulsante diretto
- NON procedere con domande di verifica — reindirizza a Prepara la prova`;

    case "partial":
      return `CASO: Solo in parte — Lo studente conosce parzialmente l'argomento.
REGOLE:
- Chiedi: "Dimmi quello che sai — raccontami l'argomento con parole tue"
- Ascolta senza interrompere
- Identifica buchi e punti deboli dalla risposta
- Lavora SOLO sui buchi — non ripetere quello che sa già
- Fai domande mirate sui punti deboli specifici
- Alla fine fai un mini-riepilogo dei punti su cui lavorare ancora`;
  }
}

export function useGuidedSession({ homeworkId, userId, schoolLevel, profileName }: UseGuidedSessionProps) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Points tracking
  const [celebrationPoints, setCelebrationPoints] = useState<PointsEarned | undefined>();
  const [celebrationTotalPoints, setCelebrationTotalPoints] = useState<number | undefined>();
  const [celebrationPreviousTotal, setCelebrationPreviousTotal] = useState<number | undefined>();
  const [celebrationStreak, setCelebrationStreak] = useState<number | undefined>();
  const sessionStartTime = useRef<number>(Date.now());

  // ── Smart time tracking: only count active intervals ≤ 10 min ──
  const lastInteractionTime = useRef<number>(Date.now());
  const activeStudySeconds = useRef<number>(0);
  const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
  const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes

  // ── Inactivity detection refs ──
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityWarned = useRef(false);
  const activeStudySecondsRef = useRef(activeStudySeconds);
  activeStudySecondsRef.current = activeStudySeconds;

  /** Call on every user message to accumulate active time */
  function recordInteraction() {
    const now = Date.now();
    const gap = now - lastInteractionTime.current;
    if (gap <= INACTIVITY_THRESHOLD_MS) {
      activeStudySeconds.current += Math.floor(gap / 1000);
    }
    lastInteractionTime.current = now;
    inactivityWarned.current = false;
  }

  /** Reset inactivity timer — call after every user message */
  function resetInactivityTimer() {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);

    inactivityTimerRef.current = setTimeout(() => {
      // 10 min with no user message
      if (sessionCompletedRef.current) return;
      inactivityWarned.current = true;

      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sei ancora lì? Non ho ricevuto risposte negli ultimi 10 minuti. Se ti sei allontanato, metto la sessione in pausa così non perdiamo il tuo progresso. Torna quando vuoi! 😊",
      }]);

      // Grace period: 2 more minutes
      graceTimerRef.current = setTimeout(() => {
        if (sessionCompletedRef.current) return;
        if (inactivityWarned.current) {
          // No response — auto-pause
          pauseSessionSilent();
        }
      }, GRACE_PERIOD_MS);
    }, INACTIVITY_THRESHOLD_MS);
  }

  /** Pause without navigating (used by inactivity auto-pause) */
  async function pauseSessionSilent() {
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (isChildSession()) {
      await childApi("update-session", { sessionId: sid, updates: { status: "paused", current_step: currentStepRef.current, updated_at: new Date().toISOString() } }).catch(() => {});
    } else {
      await supabase.from("guided_sessions").update({
        status: "paused",
        current_step: currentStepRef.current,
        updated_at: new Date().toISOString(),
      }).eq("id", sid).then(() => {}, () => {});
    }
    // Save messages
    const convId = conversationIdRef.current;
    const msgs = messagesRef.current;
    if (convId && msgs.length > 0 && !isChildSession()) {
      const chatToSave = msgs.filter(m => m.content?.trim()).map(m => ({ role: m.role, text: m.content }));
      await supabase.from("conversation_sessions").update({
        messaggi: chatToSave as any,
        updated_at: new Date().toISOString(),
      }).eq("id", convId).then(() => {}, () => {});
    }
    navigate("/dashboard");
  }

  function clearInactivityTimers() {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null; }
  }

  // Method block state
  const [methodPhase, setMethodPhase] = useState<MethodPhase>("none");
  const [familiarity, setFamiliarity] = useState<Familiarity | null>(null);
  const [pendingEmotion, setPendingEmotion] = useState<string>("");
  const [sessionEmotion, setSessionEmotion] = useState<string>("");
  const [showFamiliarity, setShowFamiliarity] = useState(false);

  // Incremental save: conversation_sessions id
  const [conversationId, setConversationId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressPercent = totalSteps > 0 ? ((currentStep - 1) / totalSteps) * 100 : 0;
  const progressLabel = totalSteps > 0 ? `${currentStep} / ${totalSteps}` : undefined;
  const isChild = isChildSession();

  // ── Refs for cleanup/beforeunload (must read latest state) ──
  const sessionIdRef = useRef(sessionId);
  const currentStepRef = useRef(currentStep);
  const sessionCompletedRef = useRef(sessionCompleted);
  const messagesRef = useRef(messages);
  const conversationIdRef = useRef(conversationId);
  const homeworkRef = useRef(homework);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { sessionCompletedRef.current = sessionCompleted; }, [sessionCompleted]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { homeworkRef.current = homework; }, [homework]);

  // ── Fix 1: Auto-save on navigate away / beforeunload ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const sid = sessionIdRef.current;
      const step = currentStepRef.current;
      const completed = sessionCompletedRef.current;
      if (!sid || completed || step <= 0) return;

      // Use sendBeacon for reliable save on page close
      const payload = JSON.stringify({
        sessionId: sid,
        status: "paused",
        current_step: step,
        updated_at: new Date().toISOString(),
      });
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/guided_sessions?id=eq.${sid}`,
        new Blob([JSON.stringify({ status: "paused", current_step: step, updated_at: new Date().toISOString() })], { type: "application/json" })
      );

      // Also save messages
      const convId = conversationIdRef.current;
      const msgs = messagesRef.current;
      if (convId && msgs.length > 0) {
        const chatToSave = msgs.filter(m => m.content?.trim()).map(m => ({ role: m.role, text: m.content }));
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/conversation_sessions?id=eq.${convId}`,
          new Blob([JSON.stringify({ messaggi: chatToSave, updated_at: new Date().toISOString() })], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup on unmount (route change) — auto-pause if still active
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInactivityTimers();

      const sid = sessionIdRef.current;
      const step = currentStepRef.current;
      const completed = sessionCompletedRef.current;
      if (sid && !completed && step > 0) {
        // Fire-and-forget pause save
        if (isChildSession()) {
          childApi("update-session", { sessionId: sid, updates: { status: "paused", current_step: step, updated_at: new Date().toISOString() } }).catch(() => {});
        } else {
          supabase.from("guided_sessions").update({
            status: "paused",
            current_step: step,
            updated_at: new Date().toISOString(),
          }).eq("id", sid).then(() => {});
        }

        // Save messages too
        const convId = conversationIdRef.current;
        const msgs = messagesRef.current;
        if (convId && msgs.length > 0 && !isChildSession()) {
          const chatToSave = msgs.filter(m => m.content?.trim()).map(m => ({ role: m.role, text: m.content }));
          supabase.from("conversation_sessions").update({
            messaggi: chatToSave,
            updated_at: new Date().toISOString(),
          }).eq("id", convId).then(() => {});
        }
      }
    };
  }, []);

  // ── Fix 3: Debounced incremental message save ──
  function scheduleMessageSave(msgs: ChatMsg[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const convId = conversationIdRef.current;
      if (!convId || msgs.length === 0) return;
      const chatToSave = msgs.filter(m => m.content?.trim()).map(m => ({ role: m.role, text: m.content }));
      supabase.from("conversation_sessions").update({
        messaggi: chatToSave as any,
        updated_at: new Date().toISOString(),
      }).eq("id", convId).then(() => {}, err => console.error("Incremental save error:", err));
    }, 2000);
  }

  async function loadSession() {
    if (!homeworkId) { setLoading(false); return; }
    setLoading(true);
    try {
      const hw = await fetchTask(homeworkId);
      if (!hw) { navigate("/dashboard"); return; }
      setHomework(hw);

      // Check if we already know familiarity for this homework
      if (isRecoveryTask(hw.task_type, hw.title)) {
        setFamiliarity("first_time");
        saveFamiliarity(homeworkId, "first_time");
      } else {
        const saved = getSavedFamiliarity(homeworkId);
        if (saved) setFamiliarity(saved);
      }

      if (isChild) {
        const result = await childApi("get-paused-session", { homeworkId });
        if (result.completed && result.session) {
          const conv = (result.session as any).conversation_sessions;
          const savedMessages = conv?.messaggi;
          if (Array.isArray(savedMessages) && savedMessages.length > 0) {
            const chatMsgs: ChatMsg[] = savedMessages.map((m: any) => ({
              role: m.role === "coach" || m.role === "assistant" ? "assistant" as const : "user" as const,
              content: m.text || m.content || "",
            }));
            setMessages(chatMsgs);
            setSessionCompleted(true);
            setSessionId(result.session.id);
            setCurrentStep(result.session.total_steps || 1);
            setTotalSteps(result.session.total_steps || 0);
            setSetupDone(true);
          } else {
            showInitialScreen(hw);
          }
        } else if (result.session && !result.completed) {
          const sess = result.session;
          const hasRealProgress = (sess.current_step || 1) > 1 || sess.last_difficulty;
          
          if (!hasRealProgress) {
            showInitialScreen(hw);
          } else {
            setSessionEmotion(sess.emotional_checkin || "");
            setSessionId(sess.id);
            setCurrentStep(sess.current_step || 1);
            setTotalSteps(sess.total_steps || 0);
            const sanitizedSteps = sanitizeExerciseSteps(result.steps || [], hw.task_type, hw.title, hw.description, getSavedFamiliarity(homeworkId) || familiarity);
            setSteps(sanitizedSteps);
            const stepInfo = sanitizedSteps[sess.current_step - 1];
            const visibleContent = getVisibleLoadedContent(hw.task_type, hw.title, hw.description, stepInfo?.step_text || stepInfo?.text);
            const stepContext = visibleContent ? `\n\n${visibleContent}` : "";
            const resumeMsg = sess.last_difficulty
              ? `Ciao! 👋 L'ultima volta stavamo lavorando su questo e avevi qualche difficoltà con: ${sess.last_difficulty}.${stepContext}\n\nVuoi riprovare insieme? 😊\n\n👉 Sì, riproviamo!\n👉 Spiegamelo di nuovo\n👉 Passo al prossimo esercizio`
              : `Ciao! 👋 Bentornato! Riprendiamo da dove eravamo.${stepContext}\n\nSei pronto? 🚀\n\n👉 Sì, avanti!\n👉 Prima fammi un ripasso veloce`;
            setMessages([{ role: "assistant", content: resumeMsg }]);
            setSetupDone(true);
            lastInteractionTime.current = Date.now();
            activeStudySeconds.current = 0;
            resetInactivityTimer();
          }
        } else if (hw.completed) {
          setSessionCompleted(true);
          setMessages([{ role: "assistant", content: `Questo compito è già stato completato! ✅\n\n**${hw.title}**\n\nPuoi ripassare i concetti nella sezione "Ripassa e rafforza".` }]);
          setSetupDone(true);
        } else {
          showInitialScreen(hw);
        }
      } else {
        const { data: existing } = await supabase
          .from("guided_sessions")
          .select("*")
          .eq("homework_id", homeworkId)
          .eq("status", "paused")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          const sess = existing[0];
          const hasRealProgress = (sess.current_step || 1) > 1 || sess.last_difficulty;
          
          if (!hasRealProgress) {
            showInitialScreen(hw);
          } else {
            setSessionEmotion(sess.emotional_checkin || "");
            setSessionId(sess.id);
            setConversationId(sess.conversation_id || null);
            setCurrentStep(sess.current_step || 1);
            setTotalSteps(sess.total_steps || 0);

            const { data: savedSteps } = await supabase
              .from("study_steps")
              .select("*")
              .eq("session_id", sess.id)
              .order("step_number", { ascending: true });
            const sanitizedSteps = sanitizeExerciseSteps(savedSteps || [], hw.task_type, hw.title, hw.description, getSavedFamiliarity(homeworkId) || familiarity);
            setSteps(sanitizedSteps);

            // Try to restore conversation messages from incremental save
            let restoredMessages = false;
            if (sess.conversation_id) {
              const { data: convData } = await supabase
                .from("conversation_sessions")
                .select("messaggi")
                .eq("id", sess.conversation_id)
                .single();
              const savedMsgs = convData?.messaggi;
              if (Array.isArray(savedMsgs) && savedMsgs.length > 0) {
                const chatMsgs: ChatMsg[] = (savedMsgs as any[]).map((m: any) => ({
                  role: m.role === "coach" || m.role === "assistant" ? "assistant" as const : "user" as const,
                  content: m.text || m.content || "",
                }));
                setMessages(chatMsgs);
                restoredMessages = true;
              }
            }

            if (!restoredMessages) {
              const stepInfo = sanitizedSteps[sess.current_step! - 1];
              const visibleContent = getVisibleLoadedContent(hw.task_type, hw.title, hw.description, stepInfo?.step_text || stepInfo?.text);
              const stepContext = visibleContent ? `\n\n${visibleContent}` : "";
              const resumeMsg = sess.last_difficulty
                ? `Ciao! 👋 L'ultima volta stavamo lavorando su questo e avevi qualche difficoltà con: ${sess.last_difficulty}.${stepContext}\n\nVuoi riprovare insieme? 😊\n\n👉 Sì, riproviamo!\n👉 Spiegamelo di nuovo\n👉 Passo al prossimo esercizio`
                : `Ciao! 👋 Bentornato! Riprendiamo da dove eravamo.${stepContext}\n\nSei pronto? 🚀\n\n👉 Sì, avanti!\n👉 Prima fammi un ripasso veloce`;
              setMessages([{ role: "assistant", content: resumeMsg }]);
            }
            setSetupDone(true);
            lastInteractionTime.current = Date.now();
            activeStudySeconds.current = 0;
            resetInactivityTimer();
          }
        } else if (hw.completed) {
          const { data: completedSession } = await supabase
            .from("guided_sessions")
            .select("*, conversation_sessions(messaggi)")
            .eq("homework_id", homeworkId)
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1);

          if (completedSession && completedSession.length > 0) {
            const sess = completedSession[0];
            const conv = (sess as any).conversation_sessions;
            const savedMessages = conv?.messaggi;

            if (Array.isArray(savedMessages) && savedMessages.length > 0) {
              const chatMsgs: ChatMsg[] = savedMessages.map((m: any) => ({
                role: m.role === "coach" || m.role === "assistant" ? "assistant" as const : "user" as const,
                content: m.text || m.content || "",
              }));
              setMessages(chatMsgs);
              setSessionCompleted(true);
              setSessionId(sess.id);
              setCurrentStep(sess.total_steps || 1);
              setTotalSteps(sess.total_steps || 0);
              setSetupDone(true);
            } else {
              showInitialScreen(hw);
            }
          } else {
            showInitialScreen(hw);
          }
        } else {
          showInitialScreen(hw);
        }
      }
    } catch (err) {
      console.error("loadSession error:", err);
    }
    setLoading(false);
  }

  // Decides whether to show familiarity or skip to checkin
  function showInitialScreen(hw: any) {
    // Recovery tasks skip familiarity (always first_time)
    if (isRecoveryTask(hw.task_type, hw.title)) {
      setFamiliarity("first_time");
      saveFamiliarity(homeworkId!, "first_time");
      setShowCheckin(true);
      return;
    }
    // If we already know familiarity from a previous session, skip to checkin
    const saved = getSavedFamiliarity(homeworkId!);
    if (saved) {
      setFamiliarity(saved);
      setShowCheckin(true);
      return;
    }
    // Skip familiarity screen — will show quick-reply buttons in chat instead
    // Go directly to checkin; familiarity will be asked via chat buttons after session starts
    setShowCheckin(true);
  }

  // Called from familiarity UI (legacy) — stores choice then shows checkin
  function selectFamiliarity(fam: Familiarity) {
    setFamiliarity(fam);
    saveFamiliarity(homeworkId!, fam);
    setShowFamiliarity(false);
    setShowCheckin(true);
  }

  // Called after emotional checkin — now familiarity is already set
  async function startNewSession(emotion: string) {
    setShowCheckin(false);
    setSessionEmotion(emotion);

    // Use saved familiarity if available, otherwise null → will show quick-reply buttons
    const fam = familiarity; // DO NOT default to "first_time" — null means "not yet chosen"
    setPendingEmotion(emotion);
    setMethodPhase("propose_method");
    setSetupDone(true);
    setLoading(false);

    // Skip the intermediate "Cominciamo" screen — start directly
    setMessages([]);
    createAndStartSession(emotion, fam);
  }

  async function handleMethodAction(value: string) {
    // Handle "continue with more exercises" after completion
    if (value === "continue_exercises") {
      setMessages(prev => [
        ...prev.map(m => ({ ...m, actions: undefined })),
        { role: "user" as const, content: "Voglio altri esercizi" },
      ]);
      setSessionCompleted(false);
      setSending(true);
      setStreamingText("");
      try {
        const lang = getCurrentLang();
        await streamChat({
          messages: [
            ...messages.map(m => ({ ...m, actions: undefined })),
            { role: "user" as const, content: "Voglio altri esercizi simili per allenarmi" },
          ],
          onDelta: () => {},
          onDone: (full: string) => {
            setMessages(prev => [...prev, { role: "assistant" as const, content: full }]);
            setStreamingText("");
            setSending(false);
          },
          extraBody: {
            profileId: isChild ? getChildSession()?.profileId : homework?.child_profile_id || userId,
            subject: homework?.subject || undefined,
            sessionFormat: "guided",
            systemPrompt: `Lo studente ha completato tutti gli esercizi del compito e vuole continuare ad allenarsi. Proponi esercizi SIMILI (stesso tipo, stessa difficoltà) ma con numeri diversi. Quando lo studente dice di voler terminare, scrivi [TERMINA_SESSIONE].`,
            lang,
          },
        });
      } catch {
        setSending(false);
      }
      return;
    }

    // Handle finish session action
    if (value === "finish_session") {
      setMessages(prev => prev.map(m => ({ ...m, actions: undefined })));
      playCelebrationSound();
      clearInactivityTimers();

      // Calculate and save points — use ACTIVE study time, not elapsed
      try {
        // Record final interval (from last interaction to now, if ≤ threshold)
        recordInteraction();
        const durationSec = activeStudySeconds.current;
        const durationMin = Math.floor(durationSec / 60);

        // focus_points: base 10 + 1 per minute, max 20
        const focusPoints = Math.min(10 + durationMin, 20);

        // autonomy_points: based on total hint count across all steps
        const totalHints = Object.values(hintCountPerStep).reduce((sum, c) => sum + c, 0);
        const autonomyPoints = totalHints <= 1 ? 10 : totalHints <= 3 ? 5 : 0;

        // consistency_points: check streak
        const profileId = isChild ? getChildSession()?.profileId : homework?.child_profile_id;
        let consistencyPoints = 5;
        if (profileId) {
          const gam = await getGamification(profileId);
          if (gam && (gam.streak || 0) >= 2) consistencyPoints = 10;
          const prevTotal = (gam?.focus_points || 0) + (gam?.autonomy_points || 0) + (gam?.consistency_points || 0);
          setCelebrationPreviousTotal(prevTotal);
        }

        const earned: PointsEarned = { focus: focusPoints, autonomy: autonomyPoints, consistency: consistencyPoints };
        setCelebrationPoints(earned);

        // Save focus session
        await saveFocusSession({
          task_id: homeworkId || undefined,
          emotion: sessionEmotion || undefined,
          duration_seconds: durationSec,
          focus_points: focusPoints,
          autonomy_points: autonomyPoints,
          consistency_points: consistencyPoints,
        });

        // Fetch updated totals and streak
        if (profileId) {
          const updatedGam = await getGamification(profileId);
          if (updatedGam) {
            setCelebrationTotalPoints(
              (updatedGam.focus_points || 0) + (updatedGam.autonomy_points || 0) + (updatedGam.consistency_points || 0)
            );
            setCelebrationStreak(updatedGam.streak || 0);
          }
        }
      } catch (err) {
        console.error("Points calculation error:", err);
      }

      // ── Mark homework task as completed ──
      try {
        if (homeworkId) {
          if (isChild) {
            await childApi("complete-session", {
              sessionId,
              homeworkId,
              chatMessages: messages
                .filter((m: ChatMsg) => m.content?.trim())
                .map((m: ChatMsg) => ({ role: m.role, text: m.content })),
            });
          } else {
            // Mark guided_session as completed
            if (sessionId) {
              await supabase.from("guided_sessions").update({
                status: "completed",
                completed_at: new Date().toISOString(),
                duration_seconds: activeStudySeconds.current,
              } as any).eq("id", sessionId);
            }
            // Mark homework_tasks as completed (unless it's a teacher_assignment)
            if (!homework?._is_teacher_assignment) {
              await supabase.from("homework_tasks").update({
                completed: true,
                updated_at: new Date().toISOString(),
              }).eq("id", homeworkId);
            }
          }
        }
      } catch (err) {
        console.error("Error marking task completed:", err);
      }

      setShowCelebration(true);
      return;
    }

    // Handle familiarity quick-reply buttons from chat
    if (value.startsWith("familiarity:")) {
      const famKey = value.replace("familiarity:", "") as Familiarity;
      setFamiliarity(famKey);
      saveFamiliarity(homeworkId!, famKey);

      // Map to user-facing label
      const labelMap: Record<string, string> = {
        already_know: homework && !isOralStudyTask(homework.task_type, homework.title) && !isMixedWritingTask(homework.task_type, homework.title)
          ? "So il metodo, voglio esercitarmi"
          : isMixedWritingTask(homework.task_type, homework.title)
            ? "Ho letto, iniziamo le domande"
            : "Lo conosco, voglio ripassarlo",
        partial: homework && !isOralStudyTask(homework.task_type, homework.title) && !isMixedWritingTask(homework.task_type, homework.title)
          ? "So farlo ma faccio errori"
          : isMixedWritingTask(homework.task_type, homework.title)
            ? "Ho capito in parte"
            : "Lo so in parte",
        first_time: homework && !isOralStudyTask(homework.task_type, homework.title) && !isMixedWritingTask(homework.task_type, homework.title)
          ? "Non ho capito come si fa"
          : isMixedWritingTask(homework.task_type, homework.title)
            ? "Non ho ancora letto il testo"
            : "Non lo conosco, partiamo da zero",
      };
      const userLabel = labelMap[famKey] || value;

      // Remove actions from the message and add user response
      setMessages(prev => [
        ...prev.map(m => ({ ...m, actions: undefined })),
        { role: "user" as const, content: userLabel },
      ]);

      // Now send to AI with familiarity context — use exercise-specific prompt for math
      setSending(true);
      setStreamingText("");
      const firstStep = steps[0] || {};
      const firstStepText = getVisibleLoadedContent(homework?.task_type || "", homework?.title || "", homework?.description, firstStep?.step_text || firstStep?.text);
      const isExerciseFam = homework && !isOralStudyTask(homework.task_type, homework.title) && !isMixedWritingTask(homework.task_type, homework.title);

      let systemCtx: string;
      if (isExerciseFam) {
        const familiarityContext = famKey === "first_time"
          ? "\nLo studente ha risposto che NON ha ancora letto l'esercizio. Fai spiegazione teorica completa del metodo con esempio concreto della vita reale adatto all'età, mostra un esempio semplice risolto completamente, poi parti con l'esercizio reale."
          : famKey === "partial"
          ? "\nLo studente ha risposto che ha GIÀ LETTO l'esercizio ma ha difficoltà. Fai una spiegazione mirata SOLO sui punti deboli specifici. Non ripetere quello che lo studente sa già. Poi parti con l'esercizio."
          : "\nLo studente ha risposto che ha GIÀ LETTO l'esercizio. Ripetizione brevissima del metodo (2-3 righe max). Vai direttamente all'esercizio.";
        const proofContext = requiresOperationProof(homework.task_type, homework.title, homework.description)
          ? "\nVINCOLO EXTRA DELLA CONSEGNA: nel compito compare 'con la prova'. Dopo il risultato guida anche la prova finale."
          : "";

        if (isMathSubject(homework.subject, homework.title)) {
          systemCtx = `Sei un tutor che guida lo studente a RISOLVERE esercizi.

REGOLE ASSOLUTE:
⚠️ Per qualsiasi operazione in colonna usa ESCLUSIVAMENTE il tag [COLONNA:] — MAI pipe, trattini, o spazi.
FORMATO TAG PARZIALE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=0]
FORMATO CON EVIDENZIAZIONE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=1, evidenzia=qp0:verde]
COLORI: verde=trovato dallo studente, arancione=hint, blu=dato dal coach

⚠️⚠️⚠️ REGOLA FERRO — SOVRASCRIVE TUTTO ⚠️⚠️⚠️
LA COLONNA SI AGGIORNA **SOLO DOPO** CHE LO STUDENTE HA RISPOSTO.
MAI mostrare un numero nella colonna PRIMA che lo studente lo abbia trovato.
MAI scrivere il risultato di un calcolo PRIMA che lo studente risponda.
MAI aggiornare la colonna con più di UN numero alla volta.

STRUTTURA OBBLIGATORIA: [1] CHIEDI → [2] ASPETTA → [3] AGGIORNA
Se corretto → verde. Se sbagliato 1ª → arancione + indizio. Se sbagliato 2ª → blu.

FLUSSO: Fase 1 (teoria+esempio vita reale) → Fase 2 (esempio semplice completo) → Fase 3 (esercizio con studente, colonna parziale)
NON chiedere MAI "Quali sono i dati?" — TU HAI GIÀ TUTTI I DATI.

⚠️ REGOLA COLONNA SEMPRE VISIBILE: OGNI messaggio durante un esercizio DEVE contenere il tag [COLONNA:] aggiornato.
⚠️ REGOLA MINIMALISMO (Fase 3): FA SOLO la domanda + [COLONNA:]. NON spiegare cosa stai per fare. Massimo 1 frase di conferma + domanda.
${familiarityContext}${proofContext}

CONTESTO INTERNO DI LAVORO:
${firstStepText}

Tono caldo e incoraggiante.`;
        } else {
          // Non-math exercise (storia, scienze, grammatica, etc.)
          systemCtx = `Sei un tutor che guida lo studente a svolgere un esercizio.

REGOLE:
- Guida lo studente passo-passo: proponi una domanda o un frammento, chiedi la risposta, poi conferma o correggi.
- NON dare le risposte in anticipo. Chiedi SEMPRE allo studente prima.
- Se lo studente sbaglia, dai un indizio. Se sbaglia di nuovo, spiega e dai la risposta corretta.
- NON usare tag [COLONNA:] — non è un esercizio di matematica.
${familiarityContext}${proofContext}

CONTESTO INTERNO DI LAVORO:
${firstStepText}

Tono caldo e incoraggiante.`;
        }
      } else {
        const familiarityContext = getCoachBehaviorForFamiliarity(famKey);
        systemCtx = `\n\nCONTESTO INTERNO DI LAVORO:\n${firstStepText}\n\n${familiarityContext}`;
      }

      const allMsgs = [
        ...messages.map(m => ({ ...m, actions: undefined })),
        { role: "user" as const, content: userLabel },
      ];

      try {
        const lang = getCurrentLang();
        await streamChat({
          messages: allMsgs,
          onDelta: () => {},
          onDone: (full: string) => {
            setMessages(prev => [...prev, { role: "assistant" as const, content: full }]);
            setStreamingText("");
            setSending(false);
          },
          extraBody: {
            profileId: isChild ? getChildSession()?.profileId : homework?.child_profile_id || userId,
            subject: homework?.subject || undefined,
            sessionFormat: "guided",
            systemPrompt: systemCtx,
            lang,
          },
        });
      } catch {
        setMessages(prev => [...prev, { role: "assistant" as const, content: "Errore. Riprova." }]);
        setSending(false);
      }
      return;
    }

    if (methodPhase === "propose_method" && value === "start_session") {
      setMethodPhase("ready");
      setMessages(prev => [
        ...prev.map(m => ({ ...m, actions: undefined })),
        { role: "user", content: "Cominciamo" },
      ]);
      createAndStartSession(pendingEmotion, familiarity);
    }
  }

  function getEmotionResponse(emotion: string): string {
    switch (emotion) {
      case "concentrato": return "Perfetto, sei concentrato! 🎯";
      case "curioso": return "Mi piace la curiosità! 🤔";
      case "carico": return "Grande energia! ⚡";
      case "tranquillo": return "Bene, andiamo con calma 🙂";
      case "stanco": return "Capisco che sei un po' stanco. Andiamo con calma, un passo alla volta.";
      case "confuso": return "Nessun problema se ti senti confuso. Ci pensiamo insieme.";
      case "agitato": return "Tranquillo, facciamo un passo alla volta. Ce la facciamo.";
      case "bloccato": return "Nessun problema se ti senti bloccato. Iniziamo da qualcosa di semplice.";
      default: return `Grazie per aver condiviso come ti senti. Iniziamo!`;
    }
  }

  async function createAndStartSession(emotion: string, fam: Familiarity | null) {
    setLoading(true);

    // FIX 3: Check that assignment content exists before starting
    if (!homework?.description && !homework?.title) {
      console.error("[useGuidedSession] Cannot start session: homework content is missing");
      setMessages(prev => [...prev, { role: "assistant" as const, content: "Ops! Non riesco a leggere il contenuto del compito. Riprova o contatta il tuo docente." }]);
      setSetupDone(true);
      setLoading(false);
      return;
    }

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-steps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            homeworkTitle: homework.title,
            homeworkType: homework.task_type,
            subject: homework.subject,
            schoolLevel,
            description: homework.description,
            familiarity: fam || undefined,
            lang: getCurrentLang(),
          }),
        }
      );

      let generatedSteps: any[] = [];
      if (res.ok) {
        const result = await res.json();
        generatedSteps = sanitizeExerciseSteps(result.steps || [], homework.task_type, homework.title, homework.description, fam || null);
      }

      if (generatedSteps.length === 0) {
        const exactExerciseSteps = sanitizeExerciseSteps([], homework.task_type, homework.title, homework.description, fam || null);
        if (exactExerciseSteps.length > 0) {
          generatedSteps = exactExerciseSteps;
        } else {
          const isExercise = !isOralStudyTask(homework.task_type, homework.title);
          if (isExercise) {
            if (fam === "first_time") {
              generatedSteps = [
                { number: 1, text: "Prima di tutto, ti spiego la teoria necessaria per affrontare questo esercizio.", bloomLevel: 1 },
                { number: 2, text: "Ora leggiamo insieme l'esercizio e vediamo cosa ci viene chiesto.", bloomLevel: 2 },
                { number: 3, text: "Prova ad impostare il primo passaggio. Ti guido se ti blocchi.", bloomLevel: 3 },
                { number: 4, text: "Controlla il risultato: ha senso? Come puoi verificarlo?", bloomLevel: 4 },
              ];
            } else if (fam === "partial") {
              generatedSteps = [
                { number: 1, text: "Rivediamo velocemente la parte di teoria che non ricordi bene.", bloomLevel: 1 },
                { number: 2, text: "Ora leggiamo l'esercizio e applichiamo quello che sappiamo.", bloomLevel: 2 },
                { number: 3, text: "Prova a risolvere — se ti blocchi chiedimi un suggerimento.", bloomLevel: 3 },
                { number: 4, text: "Controlla il risultato e prova a spiegare il ragionamento.", bloomLevel: 4 },
              ];
            } else {
              generatedSteps = [
                { number: 1, text: "Leggiamo insieme l'esercizio. Ti presento il problema e vediamo cosa ci viene chiesto.", bloomLevel: 1 },
                { number: 2, text: "Quale formula, regola o procedimento pensi si possa applicare qui?", bloomLevel: 2 },
                { number: 3, text: "Prova ad impostare il primo passaggio della risoluzione. Cosa ottieni?", bloomLevel: 3 },
                { number: 4, text: "Controlla il risultato: ha senso? Come puoi verificarlo?", bloomLevel: 4 },
              ];
            }
          } else {
            if (fam === "already_know") {
              generatedSteps = [
                { number: 1, text: "Chiudi il materiale. Cosa ricordi di questo argomento? Spiegamelo a voce.", bloomLevel: 2 },
                { number: 2, text: "Approfondiamo i punti deboli. Ti faccio qualche domanda mirata.", bloomLevel: 3 },
                { number: 3, text: "Mini simulazione orale: immagina di essere davanti al professore.", bloomLevel: 5 },
              ];
            } else if (fam === "partial") {
              generatedSteps = [
                { number: 1, text: "Dimmi cosa hai già studiato e dove ti sei fermato.", bloomLevel: 1 },
                { number: 2, text: "Completiamo le parti mancanti e poi richiamiamo tutto.", bloomLevel: 2 },
                { number: 3, text: "Adesso proviamo a ripetere tutto l'argomento dalla memoria.", bloomLevel: 4 },
              ];
            } else {
              generatedSteps = [
                { number: 1, text: "Iniziamo a leggere insieme l'argomento. Ti presento il contenuto un pezzo alla volta e ti spiego i punti importanti.", bloomLevel: 1 },
                { number: 2, text: "Ora che abbiamo letto, proviamo a richiamare i concetti principali. Cosa ti ricordi?", bloomLevel: 2 },
                { number: 3, text: "Colleghiamo le idee tra loro. Sapresti spiegarmi il filo logico dell'argomento?", bloomLevel: 3 },
                { number: 4, text: "Mini simulazione: prova a ripetere l'argomento come se fossi davanti al professore.", bloomLevel: 5 },
              ];
            }
          }
        }
      }

      setTotalSteps(generatedSteps.length);

      let newSessionId: string;

      if (isChild) {
        const newSession = await childApi("create-session", {
          homeworkId,
          totalSteps: generatedSteps.length,
          emotion,
        });
        if (!newSession?.id) throw new Error("Failed to create session");
        newSessionId = newSession.id;
        setSessionId(newSessionId);

        const stepRows = generatedSteps.map((s: any) => ({
          user_id: userId,
          homework_id: homeworkId,
          session_id: newSessionId,
          step_number: s.number,
          step_text: s.text,
          status: s.number === 1 ? "active" : "pending",
        }));
        await childApi("insert-steps", { steps: stepRows });
      } else {
        // Create conversation_sessions record for incremental saving
        const { data: convSession } = await supabase
          .from("conversation_sessions")
          .insert({
            profile_id: homework?.child_profile_id || userId,
            titolo: homework?.title || "Sessione guidata",
            materia: homework?.subject,
            messaggi: [],
          })
          .select("id")
          .single();
        const convId = convSession?.id || null;
        setConversationId(convId);

        const { data: newSession } = await supabase
          .from("guided_sessions")
          .insert({
            user_id: userId,
            homework_id: homeworkId,
            status: "active",
            current_step: 1,
            total_steps: generatedSteps.length,
            emotional_checkin: emotion,
            conversation_id: convId,
          })
          .select()
          .single();

        if (!newSession) throw new Error("Failed to create session");
        newSessionId = newSession.id;
        setSessionId(newSessionId);

        const stepRows = generatedSteps.map((s: any) => ({
          user_id: userId,
          homework_id: homeworkId,
          session_id: newSessionId,
          step_number: s.number,
          step_text: s.text,
          status: s.number === 1 ? "active" : "pending",
        }));
        await supabase.from("study_steps").insert(stepRows);
      }

      setSteps(generatedSteps);
      setCurrentStep(1);

      // Extract student_instruction early — needed for button logic
      let earlyStudentInstruction = "";
      try {
        const sf = homework?.source_files;
        console.log("[useGuidedSession] source_files raw:", JSON.stringify(sf));
        if (Array.isArray(sf) && sf.length > 0) {
          const f = typeof sf[0] === "string" ? JSON.parse(sf[0]) : sf[0];
          console.log("[useGuidedSession] parsed first file:", JSON.stringify(f));
          if (f?.student_instruction) earlyStudentInstruction = f.student_instruction;
        }
      } catch (e) { console.error("[useGuidedSession] source_files parse error:", e); }
      console.log("[useGuidedSession] earlyStudentInstruction:", earlyStudentInstruction);

      // If student_instruction exists, treat as exercise (not oral)
      const hasStudentInstructionEarly = !!earlyStudentInstruction;
      const isExercise = hasStudentInstructionEarly || (!isOralStudyTask(homework.task_type, homework.title) && !isMixedWritingTask(homework.task_type, homework.title));
      console.log("[useGuidedSession] isExercise:", isExercise, "| hasStudentInstruction:", hasStudentInstructionEarly, "| task_type:", homework.task_type, "| isOral:", isOralStudyTask(homework.task_type, homework.title));

      // Mic suggestion: show only once EVER per student profile — but NOT for exercise tasks with student_instruction
      const isOral = isOralStudyTask(homework.task_type, homework.title) && !hasStudentInstructionEarly;
      let voicePrompt = "";
      if (isOral) {
        const micAlreadySuggested = await checkMicSuggested(userId, isChild);
        if (!micAlreadySuggested) {
          voicePrompt = "\n\nConsiglio: per le interrogazioni è più utile rispondere a voce. Puoi usare il microfono qui sotto — ti aiuta ad allenarti come nella realtà.";
          await markMicSuggested(userId, isChild);
        }
      }

      // For EXERCISES: skip familiarity buttons entirely — use adaptive flow
      // For ORAL tasks: show familiarity buttons only if fam is not already known
      if (isExercise) {
        // Always start exercises directly with adaptive AI prompt
        const introMsg = `Ciao! 👋 Oggi lavoriamo su "${homework.title}"!${voicePrompt}\n\nPartiamo! 🚀`;
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: introMsg },
        ]);
        setSetupDone(true);
        lastInteractionTime.current = Date.now();
        activeStudySeconds.current = 0;
        resetInactivityTimer();

        // Check previous completed sessions for same subject to determine adaptive level
        let hasPreviousSessions = false;
        try {
          if (isChild) {
            // For child sessions, check via homework_tasks completed count for same subject
            const profileId = getChildSession()?.profileId;
            if (profileId) {
              const { count } = await supabase
                .from("guided_sessions")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("status", "completed");
              hasPreviousSessions = (count || 0) > 0;
            }
          } else {
            const { count } = await supabase
              .from("guided_sessions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("status", "completed");
            hasPreviousSessions = (count || 0) > 0;
          }
        } catch { /* ignore — default to first time behavior */ }

        // Send first AI message with adaptive context
        setSending(true);
        setStreamingText("");
        const firstStep = generatedSteps[0];
        const firstStepText = getVisibleLoadedContent(homework.task_type, homework.title, homework.description, firstStep?.step_text || firstStep?.text);
        const proofContext = requiresOperationProof(homework.task_type, homework.title, homework.description)
          ? "\nVINCOLO EXTRA DELLA CONSEGNA: nel compito compare 'con la prova'. Dopo il risultato guida anche la prova finale."
          : "";

        const adaptiveContext = hasPreviousSessions
          ? `\nFLUSSO ADATTIVO: Lo studente ha già fatto esercizi simili in passato. NON fare teoria completa.
Fai un brevissimo ripasso (2-3 righe max). Es: "Ricordi come si fanno? Partiamo subito!"
Poi parti DIRETTAMENTE con l'esercizio usando [COLONNA: ..., parziale=true, celle_compilate=0].
SE lo studente risponde correttamente ai primi 2 passi → vai spedito senza spiegazioni.
SE lo studente dice "non ricordo" o "spiegami" → spiega il metodo, poi riprendi.`
          : `\nFLUSSO ADATTIVO: Lo studente affronta questo tipo di esercizio per la prima volta.
NON scrivere MAI "è la prima volta" o "prima volta" — inizia direttamente con il contenuto.
FASE 1: Spiega brevemente il metodo con un esempio concreto dalla vita reale adatto all'età.
FASE 2: Mostra UN SOLO esempio semplice COMPLETAMENTE RISOLTO con [COLONNA:] (SENZA parziale=true).
  ⚠️ NUMERI DELL'ESEMPIO: devono essere DIVERSI e PIÙ PICCOLI dell'esercizio reale.
  ⚠️ Se l'esercizio è 765:2, l'esempio deve essere 6:2 o 8:4. MAI usare i numeri dell'esercizio.
  ⚠️ Questo è l'UNICO caso in cui mostri [COLONNA:] con la soluzione completa visibile.
FASE 3: Parti con l'esercizio reale usando [COLONNA: ..., parziale=true, celle_compilate=0].
  ⚠️ In Fase 3 la colonna è SEMPRE parziale — la soluzione NON è MAI visibile.
  ⚠️ Ogni cifra/risultato si svela SOLO DOPO che lo studente ha risposto correttamente.
SE lo studente risponde correttamente ai primi passi → riduci spiegazioni, vai spedito.`;

        // Build system context: use student_instruction-aware prompt for non-math exercises
        let systemCtx: string;
        if (earlyStudentInstruction) {
          // Generic exercise prompt driven by student_instruction (grammar, comprehension, etc.)
          systemCtx = `Sei un tutor che guida lo studente a svolgere un esercizio specifico.

CONSEGNA DELLO STUDENTE: "${earlyStudentInstruction}"
MATERIALE: il testo su cui lavorare è fornito nel contesto.
NON trattare questo come una lezione di ${homework?.subject}. Esegui SOLO l'istruzione indicata usando il testo come materiale.

REGOLE:
- Lavora sul testo fornito, frase per frase o paragrafo per paragrafo.
- Guida lo studente passo-passo: proponi un frammento, chiedi la risposta, poi conferma o correggi.
- NON dare le risposte in anticipo. Chiedi SEMPRE allo studente prima.
- Se lo studente sbaglia, dai un indizio. Se sbaglia di nuovo, spiega e dai la risposta corretta.
- Usa un tono caldo e incoraggiante.
${adaptiveContext}

CONTESTO INTERNO DI LAVORO:
${firstStepText}

Tono caldo e incoraggiante.`;
        } else if (isMathSubject(homework?.subject, homework?.title)) {
          // Math-specific exercise prompt with COLONNA tags
          systemCtx = `Sei un tutor che guida lo studente a RISOLVERE esercizi.

REGOLE ASSOLUTE:
⚠️ Per qualsiasi operazione in colonna usa ESCLUSIVAMENTE il tag [COLONNA:] — MAI pipe, trattini, o spazi.
FORMATO TAG PARZIALE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=0]
FORMATO CON EVIDENZIAZIONE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=1, evidenzia=qp0:verde]
COLORI: verde=trovato dallo studente, arancione=hint, blu=dato dal coach

⚠️⚠️⚠️ REGOLA SVG FONDAMENTALE ⚠️⚠️⚠️
Il tag [COLONNA:] mostra un'operazione SVG animata. Quando usi parziale=true, i risultati sono NASCOSTI.
Quando NON usi parziale=true, il risultato è VISIBILE E COMPLETO.
QUINDI:
- Per l'ESERCIZIO REALE: usa SEMPRE parziale=true → la soluzione resta nascosta finché lo studente non risponde
- SENZA parziale=true: usalo SOLO per l'esempio risolto (Fase 2) o quando lo studente CHIEDE un esempio/dimostrazione
- Se lo studente chiede "fammi un esempio" o "mostrami come si fa" → mostra [COLONNA:] COMPLETO (senza parziale)
- MAI mostrare [COLONNA:] senza parziale=true durante l'esercizio attivo — è come dare la soluzione

⚠️⚠️⚠️ REGOLA FERRO — SOVRASCRIVE TUTTO ⚠️⚠️⚠️
LA COLONNA SI AGGIORNA **SOLO DOPO** CHE LO STUDENTE HA RISPOSTO.
MAI mostrare un numero nella colonna PRIMA che lo studente lo abbia trovato.
MAI scrivere il risultato di un calcolo PRIMA che lo studente risponda.
MAI aggiornare la colonna con più di UN numero alla volta.
MAI dire "moltiplichiamo X per Y" o "X × Y fa Z" — CHIEDI SEMPRE allo studente.
MAI anticipare quale operazione fare — chiedi "Qual è il prossimo passo?"

STRUTTURA OBBLIGATORIA: [1] CHIEDI → [2] ASPETTA → [3] AGGIORNA
Se corretto → verde. Se sbagliato 1ª → arancione + indizio. Se sbagliato 2ª → blu.

NON chiedere MAI "Quali sono i dati?" — TU HAI GIÀ TUTTI I DATI.

⚠️ REGOLA COLONNA SEMPRE VISIBILE: OGNI messaggio durante un esercizio DEVE contenere il tag [COLONNA:] aggiornato.

⚠️ REGOLA MINIMALISMO (durante esercizio attivo — Fase 3):
- FA SOLO la domanda + [COLONNA:]. Nient'altro.
- NON spiegare cosa stai per fare ("Ora moltiplichiamo...", "Adesso calcoliamo...")
- NON nominare l'operazione da fare — lo studente deve capirla da solo
- NON dare numeri nel testo — i numeri sono SOLO nella colonna
- Massimo 1 frase di conferma + 1 domanda + [COLONNA:]
- ESEMPIO CORRETTO: "Esatto! 🎉\\n\\n[COLONNA: ...]\\n\\nQual è il prossimo passo?"
- ESEMPIO VIETATO: "Perfetto! Ora moltiplichiamo 3 per 2. Quanto fa 3 × 2?"
- ESEMPIO VIETATO: "Adesso moltiplichiamo 3 (il quoziente parziale) per 2 (il divisore). Quanto fa 3 × 2?"
${adaptiveContext}${proofContext}

TEORIA SU RICHIESTA: Se lo studente dice "non ricordo come si fa" o "puoi spiegarmi" → spiega il metodo al momento, poi riprendi l'esercizio. La teoria su richiesta è SEMPRE disponibile.

CONTESTO INTERNO DI LAVORO:
${firstStepText}

Tono caldo e incoraggiante.`;
        } else {
          // Non-math exercise (storia, scienze, grammatica, etc.) — NO COLONNA tags
          systemCtx = `Sei un tutor che guida lo studente a svolgere un esercizio.

REGOLE:
- Guida lo studente passo-passo: proponi una domanda o un frammento, chiedi la risposta, poi conferma o correggi.
- NON dare le risposte in anticipo. Chiedi SEMPRE allo studente prima.
- Se lo studente sbaglia, dai un indizio. Se sbaglia di nuovo, spiega e dai la risposta corretta.
- NON usare tag [COLONNA:] — non è un esercizio di matematica.
${adaptiveContext}${proofContext}

CONTESTO INTERNO DI LAVORO:
${firstStepText}

Tono caldo e incoraggiante.`;
        }

        try {
          const lang = getCurrentLang();
          await streamChat({
            messages: [
              ...messages,
              { role: "assistant", content: introMsg },
            ],
            onDelta: () => {},
            onDone: (full: string) => {
              setMessages(prev => [...prev, { role: "assistant" as const, content: full }]);
              setStreamingText("");
              setSending(false);
            },
            extraBody: {
              profileId: isChild ? getChildSession()?.profileId : homework?.child_profile_id || userId,
              subject: homework.subject || undefined,
              sessionFormat: "guided",
              systemPrompt: systemCtx,
              lang,
            },
          });
        } catch {
          setSending(false);
        }
      } else if (fam) {
        // ORAL tasks with known familiarity — skip buttons
        const isWriting = isMixedWritingTask(homework.task_type, homework.title);
        const familiarityLabel = fam === "first_time"
          ? (isWriting ? "Non ho ancora letto il testo" : "Non lo conosco, partiamo da zero")
          : fam === "partial"
            ? (isWriting ? "Ho capito in parte" : "Lo so in parte")
            : (isWriting ? "Ho letto, iniziamo le domande" : "Lo conosco, voglio ripassarlo");
        const introMsg = `Ciao! 👋 Oggi lavoriamo su "${homework.title}"!${voicePrompt}\n\nPartiamo! 🚀`;
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: introMsg },
          { role: "user", content: familiarityLabel },
        ]);
        setSetupDone(true);
        lastInteractionTime.current = Date.now();
        activeStudySeconds.current = 0;
        resetInactivityTimer();

        // Immediately send first AI interaction with familiarity context
        setSending(true);
        setStreamingText("");
        const firstStep = generatedSteps[0];
        const firstStepText = getVisibleLoadedContent(homework.task_type, homework.title, homework.description, firstStep?.step_text || firstStep?.text);
        const familiarityContext = getCoachBehaviorForFamiliarity(fam);
        const systemCtx = `\n\nCONTESTO INTERNO DI LAVORO:\n${firstStepText}\n\n${familiarityContext}`;
        
        try {
          const lang = getCurrentLang();
          await streamChat({
            messages: [
              ...messages,
              { role: "assistant", content: introMsg },
              { role: "user", content: familiarityLabel },
            ],
            onDelta: () => {},
            onDone: (full) => {
              setMessages(prev => [...prev, { role: "assistant", content: full }]);
              setStreamingText("");
              setSending(false);
            },
            extraBody: {
              profileId: isChild ? getChildSession()?.profileId : homework?.child_profile_id || userId,
              subject: homework.subject || undefined,
              sessionFormat: "guided",
              systemPrompt: systemCtx,
              lang,
            },
          });
        } catch {
          setSending(false);
        }
      } else {
        // ORAL tasks — no familiarity known — show quick-reply buttons in chat
        const isWritingTask = isMixedWritingTask(homework.task_type, homework.title);
        const openingMsg = `Ciao! 👋 Oggi lavoriamo su "${homework.title}"!${voicePrompt}\n\nCome posso aiutarti?`;

        const familiarityActions: ChatAction[] = [
          ...(isWritingTask ? [
            { label: "Non ho ancora letto il testo", value: "familiarity:first_time", icon: "👉" },
            { label: "Ho letto, iniziamo le domande", value: "familiarity:already_know", icon: "👉" },
            { label: "Ho capito in parte", value: "familiarity:partial", icon: "👉" },
          ] : [
            { label: "Non lo conosco, partiamo da zero", value: "familiarity:first_time", icon: "👉" },
            { label: "Lo conosco, voglio ripassarlo", value: "familiarity:already_know", icon: "👉" },
            { label: "Lo so in parte", value: "familiarity:partial", icon: "👉" },
          ]),
        ];

        setMessages(prev => [...prev, {
          role: "assistant",
          content: openingMsg,
          actions: familiarityActions,
        }]);
        setSetupDone(true);
        lastInteractionTime.current = Date.now();
        activeStudySeconds.current = 0;
        resetInactivityTimer();
      }
    } catch (err) {
      console.error("startNewSession error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Si è verificato un errore nell'avvio della sessione. Riprova." }]);
      setSetupDone(true);
    }
    setLoading(false);
  }

  // Track hint count per step for escalation
  const [hintCountPerStep, setHintCountPerStep] = useState<Record<number, number>>({});

  const handleSend = useCallback(async (text: string) => {
    if (sending || !text.trim()) return;

    // ── Smart time tracking: record active interval ──
    recordInteraction();
    resetInactivityTimer();

    // If session is already completed and student wants to finish — show button immediately
    if (sessionCompleted) {
      const lowerText = text.trim().toLowerCase();
      const wantsToFinish = ["termina", "basta", "finisco", "no grazie", "ho finito", "no", "fine", "esci", "stop"].some(k => lowerText.includes(k));
      if (wantsToFinish) {
        setMessages(prev => [
          ...prev.map(m => ({ ...m, actions: undefined })),
          { role: "user" as const, content: text },
          { role: "assistant" as const, content: "Ok, ottimo lavoro! 🎉", actions: [{ label: "🎉  Fine — Vedi il risultato", value: "finish_session", primary: true }] },
        ]);
        return;
      }
    }

    // Check if this is a hint request
    const isHintRequest = text.includes("Dammi un indizio") || text.includes("indizio") || text.includes("Sono bloccato");
    let currentHintCount = hintCountPerStep[currentStep] || 0;
    if (isHintRequest) {
      currentHintCount += 1;
      setHintCountPerStep(prev => ({ ...prev, [currentStep]: currentHintCount }));
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSending(true);
    setStreamingText("");

    try {
      const currentStepData = steps[currentStep - 1];
      const systemAddition = currentStepData
        ? `\n\nCONTESTO INTERNO DI LAVORO (NON menzionare nella chat, NON dire "step", "focus attuale" o numerare — usalo SOLO come contesto silenzioso per sapere su cosa lavorare ora):\n${currentStepData.text || currentStepData.step_text}`
        : "";

      const isExercise = homework?.task_type !== "study" && !isOralStudyTask(homework?.task_type || "", homework?.title || "");
      const isOral = isOralStudyTask(homework?.task_type || "", homework?.title || "");

      // ⚠️ FIX 1: Absolute priority rule — coach MUST read and confirm content first
      const assignmentFidelityRule = homework?.description
        ? `⚠️ REGOLA ASSOLUTA N.1 — LEGGI IL CONTENUTO PRIMA DI TUTTO (PRIORITÀ MASSIMA):
Il compito assegnato contiene il testo e gli esercizi ESATTI da svolgere.
PRIMA di dire qualsiasi cosa, leggi attentamente il contenuto del compito qui sotto.
Il tuo primo messaggio DEVE confermare cosa hai letto:
"Ho visto il tuo compito. Devi [descrizione esatta degli esercizi]. Iniziamo?"

NON partire mai con spiegazioni teoriche prima di aver confermato il contenuto.
NON inventare esercizi diversi da quelli nel compito.
NON aggiungere argomenti non presenti nel compito.
NON cambiare i numeri, le operazioni o il testo degli esercizi.

Se il compito contiene "esercizi sui decimali" → lavora SUI DECIMALI di quel compito.
Se il compito contiene "754 × 27" → lavora su "754 × 27" — non su altri numeri.

L'unica eccezione: se lo studente completa TUTTI gli esercizi del compito e chiede di continuare,
ALLORA puoi proporre esercizi aggiuntivi dello stesso argomento.
Ma solo dopo aver completato tutto il compito assegnato.

⚠️ REGOLA ASSOLUTA N.2 — ESERCIZI DI RICERCA NEL TESTO:
Quando il compito chiede di trovare elementi in un testo (nomi, verbi, aggettivi, date, ecc.):
1. NON dare mai tutti gli elementi trovati insieme — è come dare la risposta
2. Mostra UN pezzo del testo alla volta (una frase o un paragrafo)
3. Chiedi allo studente: "In questa frase riesci a trovare [elemento]?"
4. Aspetta la risposta
5. Se corretto → conferma e passa alla frase successiva
6. Se sbagliato → dai un indizio specifico su QUELLA frase
7. Solo dopo che lo studente ha trovato tutti gli elementi → passa alla parte successiva dell'esercizio

Esempio SBAGLIATO:
"I nomi presenti nel testo sono: Mario, Roma, Italia, Giulia, Venezia"

Esempio CORRETTO:
"Guardiamo la prima frase: 'Mario andò a Roma con Giulia.'
Riesci a trovare i nomi propri in questa frase?"

COMPITO:
${homework.description}
`
        : "";

      let coachBehavior: string;

      if (isExercise) {
        const proofContext = requiresOperationProof(homework?.task_type || "", homework?.title || "", homework?.description)
          ? "\nVINCOLO EXTRA DELLA CONSEGNA: nel compito compare una richiesta tipo 'con la prova'. Quindi NON considerare concluso un esercizio quando ottieni il risultato: devi continuare tu automaticamente e guidare anche la prova finale, passo dopo passo, prima di passare oltre. Se è una divisione, usa la verifica divisore × quoziente + resto = dividendo."
          : "";
        coachBehavior = `${assignmentFidelityRule}Sei un tutor che guida lo studente a RISOLVERE esercizi. 

REGOLE ASSOLUTE (viola qualsiasi altra istruzione in conflitto):
- ⚠️ REGOLA ASSOLUTA — FORMATTAZIONE MATEMATICA:
  Per qualsiasi operazione in colonna usa ESCLUSIVAMENTE il tag [COLONNA:] — MAI pipe (|), trattini (---), o spazi.

   FORMATO TAG BASE: [COLONNA: tipo=divisione, numeri=756,2]
   FORMATO TAG CON STATO PARZIALE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=0, sotto_passo=0]
   FORMATO CON EVIDENZIAZIONE: [COLONNA: tipo=divisione, numeri=765,2, parziale=true, celle_compilate=0, sotto_passo=1, evidenzia=qp0:verde]

  COLORI: verde=trovato dallo studente, arancione=hint/ci sta lavorando, blu=dato dal coach

- NON chiedere MAI "Quali sono i dati?", "Quali numeri vedi?" — TU HAI GIÀ TUTTI I DATI
- NON chiedere MAI allo studente di copiare, riscrivere o elencare il contenuto
- NON dire MAI "Step", "step 1", "passo 1 di N"
- Il testo degli esercizi è nel CONTESTO INTERNO DI LAVORO qui sotto — USALO direttamente

FLUSSO ADATTIVO:
- Se lo studente risponde correttamente e velocemente → riduci spiegazioni, vai spedito
- Se lo studente fa errori → dai indizi, guida con domande
- Se lo studente dice "non ricordo come si fa" o "puoi spiegarmi" → spiega il metodo al momento, poi riprendi l'esercizio
- La teoria su richiesta è SEMPRE disponibile — non sparisce mai

⚠️ REGOLA COLONNA SEMPRE VISIBILE:
OGNI messaggio durante un esercizio in colonna DEVE contenere il tag [COLONNA:] aggiornato.

⚠️ REGOLA MINIMALISMO:
- FA SOLO la domanda + il tag [COLONNA:]
- NON spiegare cosa stai per fare ("Ora moltiplichiamo...", "Adesso calcoliamo...")
- NON nominare l'operazione da fare — lo studente deve capirla da solo
- NON dare numeri nel testo — i numeri sono SOLO nella colonna
- Massimo 1 frase di conferma + 1 domanda + [COLONNA:]
- ESEMPIO CORRETTO: "Esatto! 🎉\\n\\n[COLONNA: ...]\\n\\nQual è il prossimo passo?"
- ESEMPIO VIETATO: "Perfetto! Ora moltiplichiamo 3 per 2. Quanto fa 3 × 2?"
- ESEMPIO VIETATO: "Adesso moltiplichiamo 3 (il quoziente parziale) per 2 (il divisore)."

⚠️⚠️⚠️ REGOLA FERRO — SOVRASCRIVE TUTTO ⚠️⚠️⚠️
LA COLONNA SI AGGIORNA **SOLO DOPO** CHE LO STUDENTE HA RISPOSTO.
MAI mostrare un numero nella colonna PRIMA che lo studente lo abbia trovato.
MAI scrivere il risultato di un calcolo PRIMA che lo studente risponda.
MAI aggiornare la colonna con più di UN numero alla volta.
MAI dire "moltiplichiamo X per Y" o "X × Y fa Z" — CHIEDI SEMPRE allo studente.
MAI anticipare quale operazione fare — chiedi "Qual è il prossimo passo?"

STRUTTURA OBBLIGATORIA: [1] CHIEDI → [2] ASPETTA → [3] AGGIORNA
Se corretto → verde. Se sbagliato 1ª → arancione + indizio. Se sbagliato 2ª → blu.
${proofContext}
IMPORTANTE: Attieniti esclusivamente al materiale già presente nel contesto. Non inventare esercizi extra.`;
      } else if (isOral && familiarity) {
        coachBehavior = `${assignmentFidelityRule}Sei un tutor che aiuta lo studente a STUDIARE, CAPIRE e RIPETERE un argomento per l'orale.

${getCoachBehaviorForFamiliarity(familiarity)}

REGOLE GENERALI PER LO STUDIO ORALE:
- "Spiegare con parole tue" NON deve significare scrivere testi lunghi
- Se scrive, accetta risposte BREVI (una frase basta)
- NON menzionare MAI il microfono o la voce — il suggerimento è gestito dall'interfaccia
- Se è bloccato, abbassa il carico cognitivo con frasi guidate:
  "Inizia così: questo argomento parla di…"
  "Dimmi solo l'idea principale"
  "Completa questa frase: la parte più importante è…"
- Segui la Tassonomia di Bloom: L1→L2→L3→L4→L5→L6

REGOLE DI FEEDBACK:
- Risposta corretta e completa → conferma breve e vai avanti
- Risposta parziale → "Quasi, aggiungi questo"
- Risposta errata → NON dire "sbagliato"; guida con una domanda più semplice
- Nessuna risposta → abbassa la difficoltà e proponi un aiuto
- Blocco evidente → passa da richiesta aperta a richiesta guidata

TONO: semplice, diretto, rassicurante, naturale, non tecnico.
NON usare mai termini come "retrieval practice", "rielaborazione elaborativa", "metacognizione".
Usa: "Partiamo da quello che ricordi", "Spiegamelo con la tua voce", "Dimmi solo la cosa più importante"

Sii breve: 2-3 frasi + una domanda`;
      } else {
        coachBehavior = `${assignmentFidelityRule}Sei un tutor che verifica la comprensione di un argomento di studio. Il tuo metodo:
1. Fai domande specifiche e concrete sull'argomento (NON "raccontami tutto")
2. Se lo studente non sa rispondere, dai una mini-spiegazione e riprova
3. Segui la Tassonomia di Bloom: parti da domande fattuali (L1-L2) e sali verso analisi e sintesi (L3-L6)
4. Sii breve: 2-3 frasi + una domanda`;
      }

      // Build emotion-aware context for AI
      let emotionContext = "";
      if (sessionEmotion) {
        const lowEnergyEmotions = ["stanco", "confuso", "agitato", "bloccato"];
        const highEnergyEmotions = ["concentrato", "carico", "curioso"];
        if (lowEnergyEmotions.includes(sessionEmotion)) {
          emotionContext = `\n\nSTATO EMOTIVO SESSIONE: Lo studente ha dichiarato di sentirsi "${sessionEmotion}" all'inizio di questa sessione.
ADATTAMENTO TONO (applica in silenzio):
- Usa frasi più brevi e rassicuranti
- Riduci la complessità delle domande
- Offri più supporto e indizi preventivi
- Se è "stanco": non forzare, proponi micro-passi leggeri
- Se è "confuso": riformula con parole diverse prima di avanzare
- Se è "agitato": rallenta, normalizza ("è normale, facciamo con calma")
- Se è "bloccato": parti da qualcosa che sa già fare`;
        } else if (highEnergyEmotions.includes(sessionEmotion)) {
          emotionContext = `\n\nSTATO EMOTIVO SESSIONE: Lo studente ha dichiarato di sentirsi "${sessionEmotion}".
ADATTAMENTO TONO: Energia positiva! Puoi alzare leggermente il ritmo e proporre sfide più stimolanti.`;
        } else {
          emotionContext = `\n\nSTATO EMOTIVO SESSIONE: Lo studente ha dichiarato di sentirsi "${sessionEmotion}". Adatta il tono di conseguenza.`;
        }
      }

      // Build task_types goal context
      const taskTypesArr = (homework?.task_type || "exercise").split(",").map((t: string) => t.trim().toLowerCase());
      const goalLabels: Record<string, string> = { study: "studiare e capire", memorize: "memorizzare", read: "leggere e comprendere", summarize: "riassumere", exercise: "fare esercizi", questions: "rispondere a domande", write: "scrivere un testo", problem: "risolvere problemi" };
      const goalStr = taskTypesArr.map(t => goalLabels[t] || t).join(" + ");

      // FIX 2: Ensure contentInstruction includes homework content with warning
      // Also inject parent context from source_files if this is a sub-task from an image upload
      let parentContextBlock = "";
      let extractedStudentInstruction = "";
      try {
        const sourceFiles = homework?.source_files;
        if (Array.isArray(sourceFiles) && sourceFiles.length > 0) {
          const firstFile = typeof sourceFiles[0] === "string" ? JSON.parse(sourceFiles[0]) : sourceFiles[0];
          if (firstFile?.full_ocr_text) {
            parentContextBlock = `\n\n═══ CONTESTO COMPLETO DELL'IMMAGINE ORIGINALE ═══
Questo compito è stato estratto da un'immagine caricata che conteneva più elementi (testo + esercizi).
Ecco il TESTO COMPLETO estratto dall'immagine originale — USALO come riferimento per rispondere a domande di comprensione, Vero/Falso, ecc.:
---
${firstFile.full_ocr_text}
---
Se il compito fa riferimento a un testo (es. "Vero o Falso", "Rispondi alle domande", "Trova i nomi nel testo"), 
il testo si trova QUI SOPRA. NON dire che non hai il testo. NON inventare risposte.
═══════════════════════════════════════════════`;
          }
          if (firstFile?.student_instruction) {
            extractedStudentInstruction = firstFile.student_instruction;
          }
        }
      } catch (e) {
        console.warn("[useGuidedSession] Failed to parse source_files for parent context:", e);
      }

      // When studentInstruction exists, provide text as raw material only — 
      // the studentInstruction (promoted to top-level in the edge function) dictates what to do with it.
      const hasStudentInstruction = !!extractedStudentInstruction;
      const contentInstruction = homework?.description
        ? (hasStudentInstruction
          ? `\n\nMATERIALE DI RIFERIMENTO (testo su cui lavorare — segui SOLO l'istruzione dello studente per decidere cosa fare con questo testo):\n---\n${homework.description}\n---${parentContextBlock}`
          : (familiarity === "first_time"
            ? `\n\nTESTO DA STUDIARE (lo studente NON lo ha mai letto — sei TU che devi presentarglielo e spiegarglielo blocco per blocco):\n---\n${homework.description}\n---\n\nATTENZIONE: Usa QUESTO testo per presentare l'argomento. Estrai le informazioni da qui e spiegale allo studente con parole semplici. NON chiedere allo studente di leggere da solo.${parentContextBlock}`
            : `\nTesto/descrizione del compito già disponibile qui sotto. NON chiedere allo studente di copiarlo o riscriverlo. Usa direttamente questo testo per guidarlo:\n${homework.description}${parentContextBlock}`))
        : (parentContextBlock || "");

      if (!homework?.description && !parentContextBlock) {
        console.warn("[useGuidedSession] ⚠️ homework.description is missing or empty — the coach will not have assignment content to work on. homeworkId:", homeworkId, "title:", homework?.title);
      }

      // Build hint escalation context
      let hintEscalation = "";
      if (isHintRequest && currentHintCount >= 3) {
        hintEscalation = `\n\nATTENZIONE ESCALATION INDIZI: Lo studente ha chiesto ${currentHintCount} indizi su questo step. Questo punto è più difficile del solito. CAMBIA APPROCCIO:
- Dì: "Questo punto è più difficile del solito — facciamo un passo ancora più piccolo insieme."
- Scomponi ulteriormente lo step in un micro-passo molto più semplice
- Accompagna lo studente passo per passo con domande molto guidate
- NON dare la risposta finale, ma il supporto deve essere molto più diretto e ravvicinato
- Segna mentalmente questo passaggio come "difficile"`;
      } else if (isHintRequest && currentHintCount === 2) {
        hintEscalation = `\n\nINDIZIO 2: Lo studente ha chiesto 2 indizi su questo step. Dai un suggerimento PIÙ SPECIFICO sul passaggio. Usa un esempio concreto legato ai suoi interessi se possibile.`;
      } else if (isHintRequest && currentHintCount === 1) {
        hintEscalation = `\n\nINDIZIO 1: Dai un suggerimento leggero e generico. Restringi il campo senza rivelare troppo.`;
      }

      // Build difficulty signal for 3+ hints
      const markDifficult = currentHintCount >= 3 ? `\nQuesto punto va segnalato come difficile: scrivi [SEGNALA_DIFFICOLTÀ: esercizio ${currentStep} - richiesti ${currentHintCount} indizi, necessita ripasso futuro]` : "";

      const fullText = await streamChat({
        messages: newMessages,
        onDelta: () => {},
        onDone: () => {},
        extraBody: {
          systemPrompt: `${coachBehavior}\n\n${extractedStudentInstruction
            ? `CONSEGNA DELLO STUDENTE: "${extractedStudentInstruction}"\nMATERIALE: il testo su cui lavorare è fornito nel contesto.\nNON trattare questo come una lezione di ${homework?.subject}.\nEsegui SOLO l'istruzione indicata usando il testo come materiale.`
            : `CONSEGNA DELLO STUDENTE (scritta da lui nel campo "Cosa devi fare?"): "${homework?.title}"\nQuesta consegna è VINCOLANTE: ogni parola conta. Se lo studente ha scritto "con la prova", "fai la verifica", "spiega il metodo", ecc., DEVI seguire TUTTE le indicazioni fino alla fine. Non considerare il compito concluso finché non hai coperto tutto ciò che la consegna richiede.`}\n\nMateria: ${homework?.subject}. Livello: ${schoolLevel}.\nOBIETTIVO: ${goalStr}.${contentInstruction}${systemAddition}${emotionContext}${hintEscalation}${markDifficult}\n\nSe lo studente completa lo step correttamente, scrivi [STEP_COMPLETATO: ${currentStep}]. Se TUTTI gli esercizi del compito sono stati completati, scrivi [SESSIONE_COMPLETATA]. Se lo studente mostra una difficoltà specifica, scrivi [SEGNALA_DIFFICOLTÀ: descrizione].\n\nQUANDO TUTTI GLI ESERCIZI SONO FINITI:\n- Scrivi [SESSIONE_COMPLETATA] nel messaggio\n- Poi chiedi brevemente: "Vuoi fare qualche altro esercizio simile per allenarti, o preferisci terminare?"\n- NON fare altre domande, NON aggiungere commenti lunghi.\n- Se lo studente dice "termina", "basta", "finisco", "no grazie", "ho finito" → rispondi SOLO "Ok, ottimo lavoro! 🎉" e scrivi [TERMINA_SESSIONE].\n- NON insistere, NON fare domande di follow-up dopo che lo studente ha detto di voler terminare.`,
          sessionFormat: "guided",
          subject: homework?.subject || undefined,
          studentInstruction: extractedStudentInstruction || undefined,
        },
      });

      // Process signals
      let displayText = fullText;
      const stepComplete = fullText.match(/\[STEP_COMPLETATO:\s*(\d+)\]/);
      const sessionComplete = fullText.includes("[SESSIONE_COMPLETATA]");
      const terminateSession = fullText.includes("[TERMINA_SESSIONE]");
      const difficultySignal = fullText.match(/\[SEGNALA_DIFFICOLTÀ:\s*(.+?)\]/);

      displayText = displayText
        .replace(/\[STEP_COMPLETATO:\s*\d+\]/g, "")
        .replace(/\[SESSIONE_COMPLETATA\]/g, "")
        .replace(/\[TERMINA_SESSIONE\]/g, "")
        .replace(/\[SEGNALA_DIFFICOLTÀ:\s*.+?\]/g, "")
        .trim();

      // Mic reminder removed — handled once-ever by the UI on session start

      setStreamingText("");
      const updatedMsgs = [...newMessages, { role: "assistant" as const, content: displayText }];
      setMessages(updatedMsgs);

      // Fix 3: Incremental save after each AI response (debounced, fire-and-forget)
      if (!isChild) {
        scheduleMessageSave(updatedMsgs);
      }

      if (stepComplete && sessionId) {
        const stepNum = parseInt(stepComplete[1]);
        if (isChild) {
          await childApi("update-step", { sessionId, stepNumber: stepNum, updates: { status: "completed", completed_at: new Date().toISOString() } });
        } else {
          await supabase.from("study_steps").update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("session_id", sessionId).eq("step_number", stepNum);
        }
        if (stepNum < totalSteps) {
          const next = stepNum + 1;
          setCurrentStep(next);
          if (isChild) {
            await childApi("update-session", { sessionId, updates: { current_step: next, updated_at: new Date().toISOString() } });
          } else {
            await supabase.from("guided_sessions").update({ current_step: next, updated_at: new Date().toISOString() })
              .eq("id", sessionId);
          }
        }
      }

      if (difficultySignal) {
        if (isChild) {
          await childApi("insert-learning-error", { subject: homework?.subject, topic: difficultySignal[1], sessionId });
        } else {
          await supabase.from("learning_errors").insert({
            user_id: userId,
            subject: homework?.subject,
            topic: difficultySignal[1],
            error_type: "incomprensione",
            session_id: sessionId,
          });
        }
      }

      if ((sessionComplete || terminateSession) && sessionId) {
        // Save conversation history
        const chatToSave = newMessages
          .filter((m: ChatMsg) => m.content?.trim())
          .map((m: ChatMsg) => ({ role: m.role, text: m.content }));

        if (isChild) {
          await childApi("complete-session", { sessionId, homeworkId, chatMessages: chatToSave });
        } else {
          if (conversationId) {
            await supabase.from("conversation_sessions").update({
              messaggi: chatToSave as any,
              updated_at: new Date().toISOString(),
            }).eq("id", conversationId);
          } else {
            const { data: convSession } = await supabase
              .from("conversation_sessions")
              .insert({
                profile_id: homework?.child_profile_id,
                titolo: homework?.title || "Sessione guidata",
                materia: homework?.subject,
                messaggi: chatToSave,
              })
              .select("id")
              .single();
            setConversationId(convSession?.id || null);
          }

          await supabase.from("guided_sessions").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            conversation_id: conversationId,
            duration_seconds: activeStudySeconds.current,
          } as any).eq("id", sessionId);
          
          // Update homework_tasks only if it's a real homework (not a teacher_assignment mapped object)
          if (!homework?._is_teacher_assignment) {
            await supabase.from("homework_tasks").update({ completed: true, updated_at: new Date().toISOString() }).eq("id", homeworkId);
          }

          // ── Write to assignment_results ──
          try {
            const assignmentId = homework?._assignment_id || null;
            let resolvedAssignmentId = assignmentId;

            // If homeworkId is not already a known teacher_assignment, check if one exists
            if (!resolvedAssignmentId && homeworkId) {
              const { data: matchedAssignment } = await supabase
                .from("teacher_assignments")
                .select("id")
                .eq("id", homeworkId)
                .maybeSingle();
              if (matchedAssignment) resolvedAssignmentId = matchedAssignment.id;
            }

            if (resolvedAssignmentId) {
              // Calculate score from steps
              const { data: sessionSteps } = await supabase
                .from("study_steps")
                .select("*")
                .eq("session_id", sessionId)
                .order("step_number", { ascending: true });

              const completedSteps = (sessionSteps || []).filter(s => s.status === "completed");
              const totalSessionSteps = (sessionSteps || []).length || 1;
              const score = Math.round((completedSteps.length / totalSessionSteps) * 100);

              // Calculate errors from hint counts and difficulty signals
              const totalHintsUsed = Object.values(hintCountPerStep).reduce((sum, c) => sum + c, 0);
              const difficultyTopics = newMessages
                .filter(m => m.role === "assistant" && m.content?.includes("[SEGNALA_DIFFICOLTÀ:"))
                .map(m => {
                  const match = m.content?.match(/\[SEGNALA_DIFFICOLTÀ:\s*(.+?)\]/);
                  return match ? match[1] : null;
                })
                .filter(Boolean);

              const errorsSummary = {
                totalErrors: totalHintsUsed,
                hintUsed: totalHintsUsed,
                givenByCoach: (sessionSteps || []).filter(s => s.hint_count && s.hint_count >= 3).length,
                argomenti: difficultyTopics,
              };

              const answers = (sessionSteps || []).map(s => ({
                step: s.step_number,
                correct: s.status === "completed" && (!s.hint_count || s.hint_count === 0),
                attempts: 1 + (s.hint_count || 0),
              }));

              // Upsert into assignment_results
              const { error: upsertErr } = await supabase
                .from("assignment_results")
                .upsert({
                  assignment_id: resolvedAssignmentId,
                  student_id: userId,
                  session_id: sessionId,
                  status: "completed",
                  score,
                  completed_at: new Date().toISOString(),
                  errors_summary: errorsSummary as any,
                  answers: answers as any,
                }, { onConflict: "assignment_id,student_id" } as any);

              if (upsertErr) {
                console.error("[useGuidedSession] assignment_results upsert error:", upsertErr);
                // Fallback: try insert if upsert fails (no unique constraint yet)
                await supabase.from("assignment_results").insert({
                  assignment_id: resolvedAssignmentId,
                  student_id: userId,
                  session_id: sessionId,
                  status: "completed",
                  score,
                  completed_at: new Date().toISOString(),
                  errors_summary: errorsSummary as any,
                  answers: answers as any,
                });
              }

              console.log("[useGuidedSession] ✅ assignment_results written for assignment:", resolvedAssignmentId, "score:", score);
            }
          } catch (arErr) {
            console.error("[useGuidedSession] Failed to write assignment_results:", arErr);
          }
        }

        // Generate flashcards + extract concepts in background
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          };

          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              subject: homework?.subject,
              conversationHistory: newMessages,
              schoolLevel,
              lang: getCurrentLang(),
            }),
          }).then(async (r) => {
            if (r.ok) {
              const result = await r.json();
              if (result.cards?.length) {
                const rows = result.cards.map((c: any) => ({
                  user_id: userId,
                  subject: homework?.subject,
                  question: c.question,
                  answer: c.answer,
                  difficulty: c.difficulty || 1,
                  source_session_id: sessionId,
                }));
                await supabase.from("flashcards").insert(rows);
              }
            }
          }).catch(() => {});

          const chatForExtract = newMessages
            .filter((m: ChatMsg) => m.content?.trim())
            .map((m: ChatMsg) => ({ role: m.role === "assistant" ? "coach" : "student", text: m.content }));

          const childSession = isChild ? getChildSession() : null;
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-concepts`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              chatMessages: chatForExtract,
              taskSubject: homework?.subject,
              taskTitle: homework?.title,
              childProfileId: isChild ? childSession?.profileId : (homework?.child_profile_id || undefined),
              accessCode: isChild ? childSession?.accessCode : undefined,
              lang: getCurrentLang(),
            }),
          }).catch(() => {});
        } catch {}

        setSessionCompleted(true);

        // Complete relevant daily missions
        try {
          const missions = await getDailyMissions();
          for (const mission of missions) {
            if (mission.completed) continue;
            const t = mission.mission_type;
            if (t === "study_session" || t === "complete_task" || t === "review_weak_concept" || t === "review_concept") {
              await completeMission(mission.id, mission.points_reward);
            }
          }
        } catch (err) {
          console.error("Mission completion error:", err);
        }

        if (terminateSession) {
          // Student already said they want to finish — show finish button immediately
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                actions: [{ label: "🎉  Fine — Vedi il risultato", value: "finish_session", primary: true }],
              };
            }
            return updated;
          });
        } else {
          // Exercises done — ask if they want more or to finish
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                actions: [
                  { label: "🔄  Voglio altri esercizi", value: "continue_exercises", icon: "🔄" },
                  { label: "🎉  Termina sessione", value: "finish_session", primary: true, icon: "🎉" },
                ],
              };
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }, [messages, sending, steps, currentStep, totalSteps, sessionId, homework, userId, schoolLevel, homeworkId, isChild, familiarity, hintCountPerStep]);

  async function pauseSession() {
    clearInactivityTimers();
    if (sessionId) {
      if (isChild) {
        await childApi("update-session", { sessionId, updates: { status: "paused", current_step: currentStep, updated_at: new Date().toISOString() } });
      } else {
        await supabase.from("guided_sessions").update({
          status: "paused",
          current_step: currentStep,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
    }
    navigate("/dashboard");
  }

  async function abandonSession() {
    clearInactivityTimers();
    if (sessionId) {
      if (isChild) {
        await childApi("update-session", { sessionId, updates: { status: "abandoned", updated_at: new Date().toISOString() } });
      } else {
        await supabase.from("guided_sessions").update({
          status: "abandoned",
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
    }
    navigate("/dashboard");
  }

  return {
    loading,
    homework,
    sessionId,
    currentStep,
    totalSteps,
    messages,
    streamingText,
    sending,
    showCelebration,
    setShowCelebration,
    showCheckin,
    showFamiliarity,
    selectFamiliarity,
    setupDone,
    sessionCompleted,
    progressPercent,
    progressLabel,
    loadSession,
    startNewSession,
    handleSend,
    handleMethodAction,
    methodPhase,
    pauseSession,
    abandonSession,
    celebrationPoints,
    celebrationTotalPoints,
    celebrationPreviousTotal,
    celebrationStreak,
  };
}
