import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Send, Lightbulb, AlertCircle, Loader2, Paperclip, Mic, RefreshCw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionCelebration } from "@/components/SessionCelebration";
import { playCelebrationSound } from "@/lib/celebrationSound";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MathText } from "@/components/shared/MathText";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export default function GuidedSession() {
  const navigate = useNavigate();
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const { user } = useAuth();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";

  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [emotionalCheckin, setEmotionalCheckin] = useState<string | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showExplainOptions, setShowExplainOptions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userId = user?.id || getChildSession()?.profileId;

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Load homework and check for existing session
  useEffect(() => {
    if (!homeworkId) return;
    loadSession();
  }, [homeworkId]);

  async function loadSession() {
    setLoading(true);
    try {
      // Load homework
      const { data: hw } = await supabase
        .from("homework_tasks")
        .select("*")
        .eq("id", homeworkId!)
        .single();
      if (!hw) { navigate("/dashboard"); return; }
      setHomework(hw);

      // Check for existing paused session
      const { data: existing } = await supabase
        .from("guided_sessions")
        .select("*")
        .eq("homework_id", homeworkId!)
        .eq("status", "paused")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        // Resume
        const sess = existing[0];
        setSessionId(sess.id);
        setCurrentStep(sess.current_step || 1);
        setTotalSteps(sess.total_steps || 0);

        // Load steps
        const { data: savedSteps } = await supabase
          .from("study_steps")
          .select("*")
          .eq("session_id", sess.id)
          .order("step_number", { ascending: true });
        setSteps(savedSteps || []);

        // Resume message
        const resumeMsg = sess.last_difficulty
          ? `Ripartiamo da dove eravamo. L'ultima volta avevi difficoltà con: ${sess.last_difficulty}. Riprendiamo dallo step ${sess.current_step}.`
          : `Bentornato! Ripartiamo dallo step ${sess.current_step}.`;
        setMessages([{ role: "assistant", content: resumeMsg }]);
        setLoading(false);
      } else {
        // New session - show emotional checkin
        setShowCheckin(true);
        setLoading(false);
      }
    } catch (err) {
      console.error("loadSession error:", err);
      setLoading(false);
    }
  }

  async function startNewSession(emotion: string) {
    setEmotionalCheckin(emotion);
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
        generatedSteps = [
          { number: 1, text: "Cosa sai già su questo argomento? Descrivilo con parole tue.", bloomLevel: 1 },
          { number: 2, text: "Quali sono le parti principali di questo compito?", bloomLevel: 2 },
          { number: 3, text: "Prova a risolvere il primo punto — cosa noti?", bloomLevel: 3 },
        ];
      }

      setTotalSteps(generatedSteps.length);

      // Create guided_session
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
      setSessionId(newSession.id);

      // Save steps
      const stepRows = generatedSteps.map((s: any) => ({
        user_id: userId,
        homework_id: homeworkId,
        session_id: newSession.id,
        step_number: s.number,
        step_text: s.text,
        status: s.number === 1 ? "active" : "pending",
      }));

      await supabase.from("study_steps").insert(stepRows);
      setSteps(generatedSteps);
      setCurrentStep(1);

      // Opening message from coach
      const firstStep = generatedSteps[0];
      const emotionResponse = emotion === "concentrato"
        ? "Perfetto, sei concentrato. Partiamo subito."
        : emotion === "stanco"
        ? "Capisco che sei un po' stanco. Andiamo con calma, un passo alla volta."
        : "Nessun problema se ti senti bloccato. Iniziamo da qualcosa di semplice.";

      setMessages([{
        role: "assistant",
        content: `${emotionResponse}\n\n${homework.title} — Step 1 di ${generatedSteps.length}:\n\n${firstStep.text}`,
      }]);
    } catch (err) {
      console.error("startNewSession error:", err);
      setMessages([{ role: "assistant", content: "Si è verificato un errore nell'avvio della sessione. Riprova." }]);
    }
    setLoading(false);
  }

  async function sendMessage(text?: string) {
    const msgText = text || input.trim();
    if (!msgText || sending) return;

    const userMsg: ChatMessage = { role: "user", content: msgText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);
    setStreamingText("");

    try {
      const currentStepData = steps[currentStep - 1];
      const systemAddition = currentStepData
        ? `\n\nStep attuale (${currentStep}/${totalSteps}): ${currentStepData.text || currentStepData.step_text}`
        : "";

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            systemPrompt: `Sei in una sessione di studio guidata. Compito: ${homework?.title}. Materia: ${homework?.subject}. Livello: ${schoolLevel}.${systemAddition}\n\nNon dare mai la risposta diretta. Guida lo studente con domande socratiche. Se risponde bene, scrivi [STEP_COMPLETATO: ${currentStep}]. Se tutti gli step sono fatti, scrivi [SESSIONE_COMPLETATA].`,
            stream: true,
          }),
        }
      );

      if (!res.ok) throw new Error("AI response failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  fullText += token;
                  setStreamingText(fullText);
                }
              } catch {}
            }
          }
        }
      }

      // Process signals
      let displayText = fullText;
      const stepComplete = fullText.match(/\[STEP_COMPLETATO:\s*(\d+)\]/);
      const sessionComplete = fullText.includes("[SESSIONE_COMPLETATA]");
      const difficultySignal = fullText.match(/\[SEGNALA_DIFFICOLTÀ:\s*(.+?)\]/);

      displayText = displayText.replace(/\[STEP_COMPLETATO:\s*\d+\]/, "").replace("[SESSIONE_COMPLETATA]", "").replace(/\[SEGNALA_DIFFICOLTÀ:\s*.+?\]/, "").trim();

      setStreamingText("");
      setMessages([...newMessages, { role: "assistant", content: displayText }]);

      if (stepComplete) {
        const stepNum = parseInt(stepComplete[1]);
        await supabase.from("study_steps").update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("session_id", sessionId).eq("step_number", stepNum);

        if (stepNum < totalSteps) {
          const next = stepNum + 1;
          setCurrentStep(next);
          await supabase.from("guided_sessions").update({ current_step: next, updated_at: new Date().toISOString() })
            .eq("id", sessionId);
        }
      }

      if (difficultySignal) {
        await supabase.from("learning_errors").insert({
          user_id: userId,
          subject: homework?.subject,
          topic: difficultySignal[1],
          error_type: "incomprensione",
          session_id: sessionId,
        });
      }

      if (sessionComplete) {
        await supabase.from("guided_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionId);
        await supabase.from("homework_tasks").update({ completed: true, updated_at: new Date().toISOString() }).eq("id", homeworkId);
        
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
      setMessages([...newMessages, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    }
    setSending(false);
  }

  function handleHint() {
    sendMessage("Dammi un indizio per questo step.");
  }

  function handleStuck() {
    sendMessage("Sono bloccato — cambia approccio e aiutami in modo più semplice.");
  }

  function handleBack() {
    if (messages.length > 1 && sessionId) {
      setShowPauseDialog(true);
    } else {
      navigate("/dashboard");
    }
  }

  async function pauseSession() {
    if (sessionId) {
      await supabase.from("guided_sessions").update({
        status: "paused",
        current_step: currentStep,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    navigate("/dashboard");
  }

  async function abandonSession() {
    if (sessionId) {
      await supabase.from("guided_sessions").update({
        status: "abandoned",
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    navigate("/dashboard");
  }

  const progressPercent = totalSteps > 0 ? ((currentStep - 1) / totalSteps) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  // Emotional checkin screen
  if (showCheckin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center"
        >
          <h2 className="font-display text-xl font-bold text-foreground mb-2">
            Come ti senti per iniziare?
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {homework?.title}
          </p>
          <div className="flex flex-col gap-3">
            {[
              { key: "concentrato", label: "Concentrato", icon: "🎯" },
              { key: "stanco", label: "Un po' stanco", icon: "😴" },
              { key: "bloccato", label: "Bloccato in partenza", icon: "😕" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => startNewSession(opt.key)}
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted transition-all text-left"
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {homework?.title || "Sessione di studio"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              Step {currentStep} di {totalSteps}
            </span>
            <div className="flex-1 h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden max-w-32">
              <motion.div
                className="h-full bg-[var(--color-accent)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
        {homework?.subject && (
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium">
            {homework.subject}
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <span className="text-white text-xs font-bold">C</span>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[var(--color-accent)] text-white rounded-br-sm"
                    : "bg-slate-100 text-[var(--color-text-primary)] rounded-bl-sm"
                }`}
              >
                <MathText>{msg.content}</MathText>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text-primary)]">
              <MathText>{streamingText}</MathText>
              <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[var(--color-navy)] flex items-center justify-center mr-2 flex-shrink-0">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <div className="bg-slate-100 rounded-xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
            </div>
          </div>
        )}
      </div>

      {/* Input toolbar */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button onClick={() => {
            try {
              const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              if (!SpeechRecognition) return;
              const recognition = new SpeechRecognition();
              recognition.lang = "it-IT";
              recognition.continuous = false;
              recognition.interimResults = false;
              recognition.onresult = (e: any) => {
                const transcript = e.results[0][0].transcript;
                if (transcript) sendMessage(transcript);
              };
              recognition.start();
            } catch {}
          }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors" disabled={sending}>
            <Mic className="w-3.5 h-3.5" />
            Voce
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            Allega
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              sendMessage(`[Ho allegato un file: ${file.name}] Analizzalo nel contesto di questo compito.`);
            }} />
          </label>
          <button onClick={handleHint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] text-xs font-medium hover:bg-[var(--color-accent-light)] transition-colors" disabled={sending}>
            <Lightbulb className="w-3.5 h-3.5" />
            Indizio
          </button>
          <button onClick={handleStuck} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors" disabled={sending}>
            <AlertCircle className="w-3.5 h-3.5" />
            Bloccato
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium hover:bg-[var(--color-bg)] transition-colors" disabled={sending} onClick={() => setShowExplainOptions(!showExplainOptions)}>
              <RefreshCw className="w-3.5 h-3.5" />
              Spiega diversamente
            </button>
            {showExplainOptions && (
              <div className="absolute bottom-full left-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                {[
                  { label: "Più semplice", msg: "Spiegamelo in modo più semplice." },
                  { label: "Con un esempio", msg: "Fammi un esempio pratico per capire meglio." },
                  { label: "Passo passo", msg: "Spiegamelo passo passo, più lentamente." },
                  { label: "Più breve", msg: "Spiegamelo in modo più breve e diretto." },
                ].map(opt => (
                  <button key={opt.label} onClick={() => { setShowExplainOptions(false); sendMessage(opt.msg); }}
                    className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] transition-colors">
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi la tua risposta..."
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            className="bg-[var(--color-accent)] hover:bg-[#005fa3] rounded-xl h-10 w-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Pause dialog */}
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
            <AlertDialogAction onClick={pauseSession} className="bg-[var(--color-accent)]">Metti in pausa</AlertDialogAction>
            <AlertDialogAction onClick={abandonSession} className="bg-[var(--color-danger)]">Abbandona</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Celebration */}
      <SessionCelebration
        isVisible={showCelebration}
        onClose={() => { setShowCelebration(false); navigate("/dashboard"); }}
        onGoToReview={() => { setShowCelebration(false); navigate("/memory?section=ripasso&content=today"); }}
        studentName={profile?.name || "Studente"}
        bloomLevel={currentStep}
        subject={homework?.subject || ""}
      />
    </div>
  );
}
