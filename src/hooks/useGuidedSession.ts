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

type MethodPhase = "none" | "propose_method" | "ready";
type Familiarity = "first_time" | "already_know" | "partial";

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
- Lo studente NON conosce ancora l'argomento, quindi PRIMA spiega, POI fai domande
- Presenta il contenuto un blocco alla volta, con parole semplici e chiare
- Alla fine di OGNI blocco che presenti, fai UNA DOMANDA CONCRETA e SPECIFICA su quello che hai appena spiegato (es. "Dove è nato Copernico?" o "Cosa significa sistema eliocentrico?")
- Lo studente deve sapere ESATTAMENTE cosa rispondere — mai lasciarlo senza sapere cosa fare
- Se non capisce, riformula con parole più semplici e NON andare avanti
- Dopo aver presentato tutti i blocchi, passa al richiamo attivo
- Chiedi allo studente di spiegare i concetti A VOCE o in UNA FRASE
- Alla fine fai una mini simulazione orale
- Non far mai rileggere passivamente — sei tu che presenti e spieghi`;


    case "already_know":
      return `CASO: Lo conosco già — Lo studente dice di conoscere l'argomento.
REGOLE:
- NON far rileggere subito
- Parti dal RICHIAMO ATTIVO: chiedi cosa ricorda senza guardare il materiale
- Fai domande inizialmente ampie, poi più mirate
- Chiedi sempre di rispondere preferibilmente A VOCE
- Identifica le lacune e concentrati SOLO sui punti deboli
- Chiudi con una simulazione orale`;

    case "partial":
      return `CASO: Solo in parte — Lo studente conosce parzialmente l'argomento.
REGOLE:
- Capisci rapidamente dove si è fermato
- Completa le parti mancanti con spiegazioni brevi
- Passa al richiamo attivo sulle parti già studiate
- Chiedi spiegazioni brevi A VOCE o in UNA FRASE
- Termina con ripetizione guidata`;
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
  const progressLabel = totalSteps > 0 ? `Step ${currentStep} di ${totalSteps}` : undefined;
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
        messaggi: chatToSave,
        updated_at: new Date().toISOString(),
      }).eq("id", convId).then(() => {}).catch(err => console.error("Incremental save error:", err));
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
            setSteps(result.steps || []);
            const stepInfo = result.steps?.[sess.current_step - 1];
            const stepContext = stepInfo ? `\n\n${hw.title} — Step ${sess.current_step} di ${sess.total_steps}:\n${stepInfo.step_text || stepInfo.text}` : "";
            const resumeMsg = sess.last_difficulty
              ? `Ripartiamo da dove eravamo. L'ultima volta avevi difficoltà con: ${sess.last_difficulty}.${stepContext}`
              : `Bentornato! Riprendiamo da dove eravamo.${stepContext}`;
            setMessages([{ role: "assistant", content: resumeMsg }]);
            setSetupDone(true);
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
            setCurrentStep(sess.current_step || 1);
            setTotalSteps(sess.total_steps || 0);

            const { data: savedSteps } = await supabase
              .from("study_steps")
              .select("*")
              .eq("session_id", sess.id)
              .order("step_number", { ascending: true });
            setSteps(savedSteps || []);

            const stepInfo = savedSteps?.[sess.current_step! - 1];
            const stepContext = stepInfo ? `\n\n${hw.title} — Step ${sess.current_step} di ${sess.total_steps}:\n${stepInfo.step_text}` : "";
            const resumeMsg = sess.last_difficulty
              ? `Ripartiamo da dove eravamo. L'ultima volta avevi difficoltà con: ${sess.last_difficulty}.${stepContext}`
              : `Bentornato! Riprendiamo da dove eravamo.${stepContext}`;
            setMessages([{ role: "assistant", content: resumeMsg }]);
            setSetupDone(true);
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
    // Show familiarity selection first
    setShowFamiliarity(true);
  }

  // Called from familiarity UI — stores choice then shows checkin
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

    // Show method proposal in chat then start
    const fam = familiarity || "first_time";
    setPendingEmotion(emotion);
    setMethodPhase("propose_method");
    setSetupDone(true);
    setLoading(false);

    const emotionResponse = getEmotionResponse(emotion);
    const proposal = getMethodProposal(fam, homework?.task_type || "study", homework?.title || "");

    setMessages([{
      role: "assistant",
      content: `${emotionResponse}\n\n${proposal}`,
      actions: [
        { label: "🚀  Cominciamo", value: "start_session", primary: true },
      ],
    }]);
  }

  async function handleMethodAction(value: string) {
    // Handle finish session action
    if (value === "finish_session") {
      setMessages(prev => prev.map(m => ({ ...m, actions: undefined })));
      playCelebrationSound();

      // Calculate and save points
      try {
        const durationSec = Math.floor((Date.now() - sessionStartTime.current) / 1000);
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

      setShowCelebration(true);
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
        generatedSteps = result.steps || [];
      }

      if (generatedSteps.length === 0) {
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
          // Oral study fallback steps based on familiarity
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
            // first_time: guide reading, don't ask questions yet
            generatedSteps = [
              { number: 1, text: "Iniziamo a leggere insieme l'argomento. Ti presento il contenuto un pezzo alla volta e ti spiego i punti importanti.", bloomLevel: 1 },
              { number: 2, text: "Ora che abbiamo letto, proviamo a richiamare i concetti principali. Cosa ti ricordi?", bloomLevel: 2 },
              { number: 3, text: "Colleghiamo le idee tra loro. Sapresti spiegarmi il filo logico dell'argomento?", bloomLevel: 3 },
              { number: 4, text: "Mini simulazione: prova a ripetere l'argomento come se fossi davanti al professore.", bloomLevel: 5 },
            ];
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
        const { data: newSession } = await supabase
          .from("guided_sessions")
          .insert({
            user_id: userId,
            homework_id: homeworkId,
            status: "active",
            current_step: 1,
            total_steps: generatedSteps.length,
            emotional_checkin: emotion,
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

      const firstStep = generatedSteps[0];
      const stepIntro = `${homework.title} — Step 1 di ${generatedSteps.length}:\n\n${firstStep.text}`;

      // Mic suggestion: show only once EVER per student profile
      const isOral = isOralStudyTask(homework.task_type, homework.title);
      let voicePrompt = "";
      if (isOral) {
        const micAlreadySuggested = await checkMicSuggested(userId, isChild);
        if (!micAlreadySuggested) {
          voicePrompt = "\n\nConsiglio: per le interrogazioni è più utile rispondere a voce. Puoi usare il microfono qui sotto — ti aiuta ad allenarti come nella realtà.";
          await markMicSuggested(userId, isChild);
        }
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: `${stepIntro}${voicePrompt}`,
      }]);
      setSetupDone(true);
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
        ? `\n\nStep attuale (${currentStep}/${totalSteps}): ${currentStepData.text || currentStepData.step_text}`
        : "";

      const isExercise = homework?.task_type !== "study" && !isOralStudyTask(homework?.task_type || "", homework?.title || "");
      const isOral = isOralStudyTask(homework?.task_type || "", homework?.title || "");

      let coachBehavior: string;

      if (isExercise) {
        const familiarityContext = familiarity === "first_time"
          ? "\nLo studente NON conosce la teoria dietro questo esercizio. PRIMA spiega brevemente la regola/formula necessaria con un esempio, POI presenta l'esercizio."
          : familiarity === "partial"
          ? "\nLo studente conosce PARZIALMENTE la teoria. Chiedi cosa ricorda della regola/formula, integra quello che manca, poi passa all'esercizio."
          : "\nLo studente dice di conoscere l'argomento. Passa direttamente all'esercizio, offri aiuto solo se si blocca.";
        coachBehavior = `Sei un tutor che guida lo studente a RISOLVERE un esercizio. Il tuo metodo:
1. All'inizio PRESENTA tu il problema allo studente: riporta il testo dell'esercizio e spiega cosa viene chiesto
2. Guida il ragionamento passo-passo: fai domande mirate per portare lo studente alla soluzione
3. NON dare mai la soluzione diretta — usa indizi progressivi
4. Se lo studente non sa come procedere, offri una MINI-RIPETIZIONE della regola/formula necessaria (breve, 2-3 frasi + esempio)
5. Se lo studente sbaglia, spiega PERCHÉ è sbagliato e rilancia con un indizio (Bloom L1→L2→L3)
6. Se lo studente è bloccato dopo 2 tentativi, dai un indizio più esplicito
7. Quando risponde correttamente, conferma e passa allo step successivo
8. Sii breve e diretto: 2-3 frasi + una domanda
${familiarityContext}
IMPORTANTE: Sei TU a dover guidare. Non chiedere allo studente di elencare i dati — presentaglieli tu e poi chiedi di ragionare.`;
      } else if (isOral && familiarity) {
        coachBehavior = `Sei un tutor che aiuta lo studente a STUDIARE, CAPIRE e RIPETERE un argomento per l'orale.

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
        coachBehavior = `Sei un tutor che verifica la comprensione di un argomento di studio. Il tuo metodo:
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

      const contentInstruction = homework?.description
        ? (familiarity === "first_time"
          ? `\n\nTESTO DA STUDIARE (lo studente NON lo ha mai letto — sei TU che devi presentarglielo e spiegarglielo blocco per blocco):\n---\n${homework.description}\n---\n\nATTENZIONE: Usa QUESTO testo per presentare l'argomento. Estrai le informazioni da qui e spiegale allo studente con parole semplici. NON chiedere allo studente di leggere da solo.`
          : `\nTesto/descrizione del compito già disponibile qui sotto. NON chiedere allo studente di copiarlo o riscriverlo. Usa direttamente questo testo per guidarlo:\n${homework.description}`)
        : "";

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
      const markDifficult = currentHintCount >= 3 ? `\nQuesto step va segnalato come difficile: scrivi [SEGNALA_DIFFICOLTÀ: Step ${currentStep} - richiesti ${currentHintCount} indizi, necessita ripasso futuro]` : "";

      const fullText = await streamChat({
        messages: newMessages,
        onDelta: (full) => setStreamingText(full),
        onDone: () => {},
        extraBody: {
          systemPrompt: `${coachBehavior}\n\nCompito: ${homework?.title}. Materia: ${homework?.subject}. Livello: ${schoolLevel}.\nOBIETTIVO: ${goalStr}.${contentInstruction}${systemAddition}${emotionContext}${hintEscalation}${markDifficult}\n\nSe lo studente completa lo step correttamente, scrivi [STEP_COMPLETATO: ${currentStep}]. Se tutti gli step sono completati, scrivi [SESSIONE_COMPLETATA]. Se lo studente mostra una difficoltà specifica, scrivi [SEGNALA_DIFFICOLTÀ: descrizione].`,
          sessionFormat: "guided",
          subject: homework?.subject || undefined,
        },
      });

      // Process signals
      let displayText = fullText;
      const stepComplete = fullText.match(/\[STEP_COMPLETATO:\s*(\d+)\]/);
      const sessionComplete = fullText.includes("[SESSIONE_COMPLETATA]");
      const difficultySignal = fullText.match(/\[SEGNALA_DIFFICOLTÀ:\s*(.+?)\]/);

      displayText = displayText
        .replace(/\[STEP_COMPLETATO:\s*\d+\]/, "")
        .replace("[SESSIONE_COMPLETATA]", "")
        .replace(/\[SEGNALA_DIFFICOLTÀ:\s*.+?\]/, "")
        .trim();

      // Mic reminder removed — handled once-ever by the UI on session start

      setStreamingText("");
      setMessages([...newMessages, { role: "assistant", content: displayText }]);

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

      if (sessionComplete && sessionId) {
        // Save conversation history
        const chatToSave = newMessages
          .filter((m: ChatMsg) => m.content?.trim())
          .map((m: ChatMsg) => ({ role: m.role, text: m.content }));

        if (isChild) {
          await childApi("complete-session", { sessionId, homeworkId, chatMessages: chatToSave });
        } else {
          // Save conversation to conversation_sessions
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

          await supabase.from("guided_sessions").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            conversation_id: convSession?.id || null,
          }).eq("id", sessionId);
          await supabase.from("homework_tasks").update({ completed: true, updated_at: new Date().toISOString() }).eq("id", homeworkId);
        }

        // Generate flashcards + extract concepts in background
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          };

          // Flashcards
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

          // Extract concepts → memory_items (for "Ripasso di oggi")
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

        // Mark session as completed — add "Fine" button instead of auto-celebration
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
        // Append the finish action to the last message
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + "\n\n✅ **Ottimo lavoro! Hai completato tutti gli step.**\nQuando hai finito di leggere, premi il pulsante qui sotto.",
              actions: [{ label: "🎉  Fine — Vedi il risultato", value: "finish_session", primary: true }],
            };
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }, [messages, sending, steps, currentStep, totalSteps, sessionId, homework, userId, schoolLevel, homeworkId, isChild, familiarity, hintCountPerStep]);

  async function pauseSession() {
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
