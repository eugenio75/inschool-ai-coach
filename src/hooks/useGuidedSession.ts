import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTask as fetchTask } from "@/lib/database";
import { isChildSession, childApi, getChildSession } from "@/lib/childSession";
import { ChatMsg, ChatAction, streamChat } from "@/lib/streamChat";
import { playCelebrationSound } from "@/lib/celebrationSound";

interface UseGuidedSessionProps {
  homeworkId: string | null;
  userId: string | undefined;
  schoolLevel: string;
  profileName: string;
}

// Task types that require the oral study method block
const ORAL_STUDY_TYPES = new Set(["study", "memorize", "teoria", "memorizzazione", "ripasso", "interrogazione", "esame", "riassunto", "summarize", "read"]);

function isOralStudyTask(taskType: string, title: string): boolean {
  // Handle comma-separated task_types (e.g. "study, memorize")
  const types = taskType.split(",").map(t => t.trim().toLowerCase());
  if (types.some(t => ORAL_STUDY_TYPES.has(t))) return true;
  const lowerTitle = title.toLowerCase();
  return ["studia", "ripeti", "memorizza", "prepara", "ripasso", "interrogazione", "esame", "riassumi"].some(k => lowerTitle.includes(k));
}

type MethodPhase = "none" | "ask_familiarity" | "propose_method" | "ready";
type Familiarity = "first_time" | "already_know" | "partial";

function getMethodProposal(familiarity: Familiarity, taskType: string, title: string): string {
  const lowerTitle = title.toLowerCase();
  const isPrep = ["interrogazione", "esame", "prepara"].some(k => lowerTitle.includes(k)) || taskType === "interrogazione" || taskType === "esame";
  const isSummary = lowerTitle.includes("riassumi") || lowerTitle.includes("riassunto") || taskType === "riassunto";
  const isMemorize = lowerTitle.includes("memorizza") || taskType === "memorizzazione";

  switch (familiarity) {
    case "first_time":
      if (isSummary) return "Ok. Mentre leggi cerca l'idea principale di ogni parte: non sottolineare tutto, solo la cosa più importante per blocco. Poi costruiamo il riassunto insieme.";
      return "Allora partiamo leggendolo una volta per capire di cosa si tratta. Poi lo dividiamo in pezzi piccoli e lavoriamo su ognuno insieme.";
    case "already_know":
      if (isPrep) return "Bene. Partiamo da quello che ricordi già. Ti faccio qualche domanda e vediamo subito dove sei sicuro e dove serve rinforzare.";
      if (isMemorize) return "Perfetto. Allora chiudiamo il materiale e partiamo da quello che hai in testa. Quello che non ricordi lo riprendiamo insieme.";
      return "Bene. Partiamo da quello che ricordi già. Ti faccio qualche domanda e vediamo subito dove sei sicuro e dove serve rinforzare.";
    case "partial":
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

  // Method block state
  const [methodPhase, setMethodPhase] = useState<MethodPhase>("none");
  const [familiarity, setFamiliarity] = useState<Familiarity | null>(null);
  const [pendingEmotion, setPendingEmotion] = useState<string>("");
  const [sessionEmotion, setSessionEmotion] = useState<string>("");

  const progressPercent = totalSteps > 0 ? ((currentStep - 1) / totalSteps) * 100 : 0;
  const progressLabel = totalSteps > 0 ? `Step ${currentStep} di ${totalSteps}` : undefined;
  const isChild = isChildSession();

  async function loadSession() {
    if (!homeworkId) { setLoading(false); return; }
    setLoading(true);
    try {
      const hw = await fetchTask(homeworkId);
      if (!hw) { navigate("/dashboard"); return; }
      setHomework(hw);

      if (isChild) {
        const result = await childApi("get-paused-session", { homeworkId });
        if (result.completed && result.session) {
          // Completed session — show conversation history read-only
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
            setShowCheckin(true);
          }
        } else if (result.session && !result.completed) {
          const sess = result.session;
          const hasRealProgress = (sess.current_step || 1) > 1 || sess.last_difficulty;
          
          if (!hasRealProgress) {
            setShowCheckin(true);
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
          // Homework marked completed but no session found — show as completed
          setSessionCompleted(true);
          setMessages([{ role: "assistant", content: `Questo compito è già stato completato! ✅\n\n**${hw.title}**\n\nPuoi ripassare i concetti nella sezione "Ripassa e rafforza".` }]);
          setSetupDone(true);
        } else {
          setShowCheckin(true);
        }
      } else {
        // Check for paused sessions first
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
            setShowCheckin(true);
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
          // Task is completed — load conversation history if available
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
              setShowCheckin(true);
            }
          } else {
            setShowCheckin(true);
          }
        } else {
          setShowCheckin(true);
        }
      }
    } catch (err) {
      console.error("loadSession error:", err);
    }
    setLoading(false);
  }

  async function startNewSession(emotion: string) {
    setShowCheckin(false);
    setSessionEmotion(emotion);
    
    // Check if this is an oral study task — if so, show method block first
    if (homework && isOralStudyTask(homework.task_type, homework.title)) {
      setPendingEmotion(emotion);
      setMethodPhase("ask_familiarity");
      setSetupDone(true);
      setLoading(false);

      // Emotional response first, then familiarity question
      const emotionResponse = getEmotionResponse(emotion);
      setMessages([{
        role: "assistant",
        content: `${emotionResponse}\n\nPrima di iniziare, dimmi: questo argomento lo conosci già oppure è la prima volta che lo studi?`,
        actions: [
          { label: "🆕  Prima volta", value: "first_time", icon: "🆕" },
          { label: "✅  Lo conosco già", value: "already_know", icon: "✅" },
          { label: "🔄  Solo in parte", value: "partial", icon: "🔄" },
        ],
      }]);
      return;
    }

    // For exercise tasks, go directly to session creation
    await createAndStartSession(emotion, null);
  }

  function handleMethodAction(value: string) {
    // Handle finish session action
    if (value === "finish_session") {
      setMessages(prev => prev.map(m => ({ ...m, actions: undefined })));
      playCelebrationSound();
      setShowCelebration(true);
      return;
    }

    if (methodPhase === "ask_familiarity") {
      const fam = value as Familiarity;
      setFamiliarity(fam);
      setMethodPhase("propose_method");

      const familiarityLabel = fam === "first_time" ? "Prima volta" : fam === "already_know" ? "Lo conosco già" : "Solo in parte";
      const proposal = getMethodProposal(fam, homework?.task_type || "study", homework?.title || "");

      setMessages(prev => [
        ...prev.map(m => ({ ...m, actions: undefined })),
        { role: "user", content: familiarityLabel },
        {
          role: "assistant",
          content: proposal,
          actions: [
            { label: "🚀  Cominciamo", value: "start_session", primary: true },
          ],
        },
      ]);
    } else if (methodPhase === "propose_method" && value === "start_session") {
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
          }),
        }
      );

      let generatedSteps: any[] = [];
      if (res.ok) {
        const result = await res.json();
        generatedSteps = result.steps || [];
      }

      if (generatedSteps.length === 0) {
        const isExercise = homework.task_type !== "study" && !isOralStudyTask(homework.task_type, homework.title);
        if (isExercise) {
          generatedSteps = [
              { number: 1, text: "Leggiamo insieme l'esercizio. Ti presento il problema e vediamo cosa ci viene chiesto.", bloomLevel: 1 },
              { number: 2, text: "Quale formula, regola o procedimento pensi si possa applicare qui? Se non lo sai, chiedimi una mini-ripetizione.", bloomLevel: 2 },
              { number: 3, text: "Prova ad impostare il primo passaggio della risoluzione. Cosa ottieni?", bloomLevel: 3 },
              { number: 4, text: "Controlla il risultato: ha senso? Come puoi verificarlo?", bloomLevel: 4 },
            ];
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

      // For oral study tasks, also prompt voice as primary response mode
      const isOral = isOralStudyTask(homework.task_type, homework.title);
      const voicePrompt = isOral
        ? "\n\n🎤 **Rispondi a voce** — premi il tasto Voce per parlare, oppure scrivi in una frase breve."
        : "";

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

  const handleSend = useCallback(async (text: string) => {
    if (sending || !text.trim()) return;
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
        coachBehavior = `Sei un tutor che guida lo studente a RISOLVERE un esercizio. Il tuo metodo:
1. All'inizio PRESENTA tu il problema allo studente: riporta il testo dell'esercizio e spiega cosa viene chiesto
2. Guida il ragionamento passo-passo: fai domande mirate per portare lo studente alla soluzione
3. NON dare mai la soluzione diretta — usa indizi progressivi
4. Se lo studente non sa come procedere, offri una MINI-RIPETIZIONE della regola/formula necessaria (breve, 2-3 frasi + esempio)
5. Se lo studente sbaglia, spiega PERCHÉ è sbagliato e rilancia con un indizio (Bloom L1→L2→L3)
6. Se lo studente è bloccato dopo 2 tentativi, dai un indizio più esplicito
7. Quando risponde correttamente, conferma e passa allo step successivo
8. Sii breve e diretto: 2-3 frasi + una domanda

IMPORTANTE: Sei TU a dover guidare. Non chiedere allo studente di elencare i dati — presentaglieli tu e poi chiedi di ragionare.`;
      } else if (isOral && familiarity) {
        coachBehavior = `Sei un tutor che aiuta lo studente a STUDIARE, CAPIRE e RIPETERE un argomento per l'orale.

${getCoachBehaviorForFamiliarity(familiarity)}

REGOLE GENERALI PER LO STUDIO ORALE:
- "Spiegare con parole tue" NON deve significare scrivere testi lunghi
- Preferisci sempre che lo studente risponda A VOCE (ricordagli di usare il pulsante 🎤)
- Se scrive, accetta risposte BREVI (una frase basta)
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

      const fullText = await streamChat({
        messages: newMessages,
        onDelta: (full) => setStreamingText(full),
        onDone: () => {},
        extraBody: {
          systemPrompt: `${coachBehavior}\n\nCompito: ${homework?.title}. Materia: ${homework?.subject}. Livello: ${schoolLevel}.\nOBIETTIVO: ${goalStr}.${contentInstruction}${systemAddition}${emotionContext}\n\nSe lo studente completa lo step correttamente, scrivi [STEP_COMPLETATO: ${currentStep}]. Se tutti gli step sono completati, scrivi [SESSIONE_COMPLETATA]. Se lo studente mostra una difficoltà specifica, scrivi [SEGNALA_DIFFICOLTÀ: descrizione].`,
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

      // For oral study tasks, add voice prompt reminder periodically
      const isOralActive = isOralStudyTask(homework?.task_type || "", homework?.title || "");
      if (isOralActive && !displayText.includes("🎤") && newMessages.filter(m => m.role === "user").length % 3 === 0) {
        displayText += "\n\n🎤 Ricorda: puoi rispondermi a voce!";
      }

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
            }),
          }).catch(() => {});
        } catch {}

        // Mark session as completed — add "Fine" button instead of auto-celebration
        setSessionCompleted(true);
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
  }, [messages, sending, steps, currentStep, totalSteps, sessionId, homework, userId, schoolLevel, homeworkId, isChild, familiarity]);

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
  };
}
