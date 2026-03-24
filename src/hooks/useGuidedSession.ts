import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTask as fetchTask } from "@/lib/database";
import { isChildSession, childApi } from "@/lib/childSession";
import { ChatMsg, streamChat } from "@/lib/streamChat";
import { playCelebrationSound } from "@/lib/celebrationSound";

interface UseGuidedSessionProps {
  homeworkId: string | null;
  userId: string | undefined;
  schoolLevel: string;
  profileName: string;
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
        // Use child-api for paused session check
        const result = await childApi("get-paused-session", { homeworkId });
        if (result.session) {
          const sess = result.session;
          setSessionId(sess.id);
          setCurrentStep(sess.current_step || 1);
          setTotalSteps(sess.total_steps || 0);
          setSteps(result.steps || []);
          const resumeMsg = sess.last_difficulty
            ? `Ripartiamo da dove eravamo. L'ultima volta avevi difficoltà con: ${sess.last_difficulty}. Riprendiamo dallo step ${sess.current_step}.`
            : `Bentornato! Ripartiamo dallo step ${sess.current_step}.`;
          setMessages([{ role: "assistant", content: resumeMsg }]);
          setSetupDone(true);
        } else {
          setShowCheckin(true);
        }
      } else {
        // Check for existing paused session via Supabase directly
        const { data: existing } = await supabase
          .from("guided_sessions")
          .select("*")
          .eq("homework_id", homeworkId)
          .eq("status", "paused")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          const sess = existing[0];
          setSessionId(sess.id);
          setCurrentStep(sess.current_step || 1);
          setTotalSteps(sess.total_steps || 0);

          const { data: savedSteps } = await supabase
            .from("study_steps")
            .select("*")
            .eq("session_id", sess.id)
            .order("step_number", { ascending: true });
          setSteps(savedSteps || []);

          const resumeMsg = sess.last_difficulty
            ? `Ripartiamo da dove eravamo. L'ultima volta avevi difficoltà con: ${sess.last_difficulty}. Riprendiamo dallo step ${sess.current_step}.`
            : `Bentornato! Ripartiamo dallo step ${sess.current_step}.`;
          setMessages([{ role: "assistant", content: resumeMsg }]);
          setSetupDone(true);
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
    setLoading(true);

    try {
      // Generate steps via edge function
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
          }),
        }
      );

      let generatedSteps: any[] = [];
      if (res.ok) {
        const result = await res.json();
        generatedSteps = result.steps || [];
      }

      if (generatedSteps.length === 0) {
        const isExercise = homework.task_type !== "study";
        generatedSteps = isExercise
          ? [
              { number: 1, text: "Leggi bene il testo dell'esercizio: quali sono i dati che hai a disposizione e cosa ti viene chiesto di trovare?", bloomLevel: 1 },
              { number: 2, text: "Quale formula, regola o procedimento pensi si possa applicare qui? Se non lo sai, chiedimi una mini-ripetizione.", bloomLevel: 2 },
              { number: 3, text: "Prova ad impostare il primo passaggio della risoluzione. Cosa ottieni?", bloomLevel: 3 },
              { number: 4, text: "Controlla il risultato: ha senso? Come puoi verificarlo?", bloomLevel: 4 },
            ]
          : [
              { number: 1, text: "Qual è il concetto principale di questo argomento? Prova a spiegarlo.", bloomLevel: 1 },
              { number: 2, text: "Quali sono le parti o i punti chiave da ricordare?", bloomLevel: 2 },
              { number: 3, text: "Sapresti fare un esempio concreto di quello che hai studiato?", bloomLevel: 3 },
            ];
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

      const emotionResponse = emotion === "concentrato"
        ? "Perfetto, sei concentrato. Partiamo subito."
        : emotion === "stanco"
        ? "Capisco che sei un po' stanco. Andiamo con calma, un passo alla volta."
        : "Nessun problema se ti senti bloccato. Iniziamo da qualcosa di semplice.";

      const firstStep = generatedSteps[0];
      setMessages([{
        role: "assistant",
        content: `${emotionResponse}\n\n${homework.title} — Step 1 di ${generatedSteps.length}:\n\n${firstStep.text}`,
      }]);
      setSetupDone(true);
    } catch (err) {
      console.error("startNewSession error:", err);
      setMessages([{ role: "assistant", content: "Si è verificato un errore nell'avvio della sessione. Riprova." }]);
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

      const isExercise = homework?.task_type !== "study";
      const coachBehavior = isExercise
        ? `Sei un tutor che guida lo studente a RISOLVERE un esercizio. Il tuo metodo:
1. NON dare mai la soluzione diretta, ma guida il ragionamento passo-passo
2. Se lo studente non sa come procedere, offri una MINI-RIPETIZIONE della regola/formula necessaria (breve, 2-3 frasi + esempio)
3. Se lo studente sbaglia, spiega PERCHÉ è sbagliato e rilancia con un indizio (Bloom L1→L2→L3)
4. Se lo studente è bloccato dopo 2 tentativi, dai un indizio più esplicito
5. Quando risponde correttamente, conferma e passa allo step successivo
6. Sii breve e diretto: 2-3 frasi + una domanda`
        : `Sei un tutor che verifica la comprensione di un argomento di studio. Il tuo metodo:
1. Fai domande specifiche e concrete sull'argomento (NON "raccontami tutto")
2. Se lo studente non sa rispondere, dai una mini-spiegazione e riprova
3. Segui la Tassonomia di Bloom: parti da domande fattuali (L1-L2) e sali verso analisi e sintesi (L3-L6)
4. Sii breve: 2-3 frasi + una domanda`;

      const fullText = await streamChat({
        messages: newMessages,
        onDelta: (full) => setStreamingText(full),
        onDone: () => {},
        extraBody: {
          systemPrompt: `${coachBehavior}\n\nCompito: ${homework?.title}. Materia: ${homework?.subject}. Livello: ${schoolLevel}.${systemAddition}\n\nSe lo studente completa lo step correttamente, scrivi [STEP_COMPLETATO: ${currentStep}]. Se tutti gli step sono completati, scrivi [SESSIONE_COMPLETATA]. Se lo studente mostra una difficoltà specifica, scrivi [SEGNALA_DIFFICOLTÀ: descrizione].`,
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
        if (isChild) {
          await childApi("complete-session", { sessionId, homeworkId });
        } else {
          await supabase.from("guided_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionId);
          await supabase.from("homework_tasks").update({ completed: true, updated_at: new Date().toISOString() }).eq("id", homeworkId);
        }

        // Generate flashcards in background
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${s?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
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
        } catch {}

        setTimeout(() => {
          playCelebrationSound();
          setShowCelebration(true);
        }, 500);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }, [messages, sending, steps, currentStep, totalSteps, sessionId, homework, userId, schoolLevel, homeworkId, isChild]);

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
    progressPercent,
    progressLabel,
    loadSession,
    startNewSession,
    handleSend,
    pauseSession,
    abandonSession,
  };
}