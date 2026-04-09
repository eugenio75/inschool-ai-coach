import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Mic, Paperclip, Lightbulb, AlertCircle, RefreshCw, Loader2, Square,
  Volume2, VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMsg } from "@/lib/streamChat";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { CoachAvatar, type CoachAvatarMood } from "@/components/shared/CoachAvatar";
import { MathText } from "@/components/shared/MathText";
import { ProgressiveMessage } from "@/components/shared/ProgressiveMessage";
import { WritingPen } from "@/components/shared/handwritten/WritingPen";
import { Whiteboard } from "@/components/study/Whiteboard";
import { fireConfetti, playCorrectSound } from "@/lib/confetti";
import { useTranslation } from "react-i18next";

/** Parse coach JSON responses (socratic_question format) into display text */
function parseCoachJsonResponse(raw: string): string {
  // First try JSON parsing
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let text = raw;
  if (cleaned.startsWith('{')) {
    try {
      const json = JSON.parse(cleaned);
      const parts = [
        json.confirm_if_correct,
        json.socratic_question,
        json.hint_if_needed,
      ].filter(Boolean);
      if (parts.length > 0) text = parts.join('\n\n');
    } catch { /* not JSON */ }
  }

  // Strip SVG_REVEAL markers (dead code — reveal is handled by exerciseSteps + celle_compilate override)
  text = text.replace(/\[SVG_REVEAL:\s*element=\w+\s+value=[\d.]+\s+color=#[A-Fa-f0-9]+\]/g, '').trim();

  return text;
}

interface ChatShellProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  coachName?: string;
  studentGreeting?: string;
  messages: ChatMsg[];
  streamingText: string;
  sending: boolean;
  onSend?: (text: string) => void;
  onBack: () => void;
  onAction?: (value: string) => void;
  onEndSession?: () => void;
  progress?: number;
  progressLabel?: string;
  showHint?: boolean;
  showStuck?: boolean;
  showExplain?: boolean;
  showVoice?: boolean;
  showAttach?: boolean;
  showPomodoro?: boolean;
  pomodoroMinutes?: number;
  extraFooter?: React.ReactNode;
  inputPlaceholder?: string;
  disabled?: boolean;
}

function detectMoodFromText(text: string): CoachAvatarMood {
  const lower = text.toLowerCase();
  if (/bravo|bravissim[ao]|ottimo|perfetto|eccellente|fantastico|complimenti|ben fatto|hai completato|🎉|✅|💪|🌟/i.test(lower))
    return "correct";
  if (/difficolt[àa]|errore|sbagliato|attenzione|non è corrett|riprova|non proprio|purtroppo|hmm/i.test(lower))
    return "encouraging";
  if (/forza|dai che|ci sei quasi|continua|non mollare|stai andando|bene così|quasi giusto|buon lavoro|ci siamo/i.test(lower))
    return "proud";
  if (/\?|pensa|rifletti|secondo te|prova a|cosa ne pensi|come faresti|perché|qual è/i.test(lower))
    return "thinking";
  return "default";
}

// Detect if the coach is asking the student a question (waiting for response)
function isWaitingForStudent(text: string): boolean {
  return /\?\s*$/.test(text.trim()) || /tocca a te|prova tu|rispondi|dimmi|qual è|quanto fa/i.test(text);
}

function sanitizeWhiteboardRecognition(raw: string): string {
  if (!raw) return "";

  const cleaned = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("data:")) return false;
      if (line === "[DONE]") return false;
      if (/chatcmpl|system_fingerprint|logprobs|finish_reason|obfuscation|service_tier|chat\.completion\.chunk/i.test(line)) return false;
      if (/^\{\s*"id"\s*:\s*"chatcmpl/i.test(line)) return false;
      return true;
    })
    .join(" ")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^\[Risposta scritta sulla lavagna\]\s*/i, "")
    .replace(/^\[Risposta dalla lavagna\]\s*/i, "")
    .trim();

  if (!cleaned) return "";
  if (/^\{[\s\S]*\}$/.test(cleaned) && !/[a-zàèéìòù\d]/i.test(cleaned.replace(/[{}":,\[\]]/g, ""))) {
    return "";
  }

  return cleaned;
}

// Detect if the coach confirms a correct answer
function isCorrectFeedback(text: string): boolean {
  return /esatto|corrett[oai]|bravo|bravissim|perfetto|giusto|ben fatto|ottimo|eccellente|✅|🎉/i.test(text) &&
    !/non è corrett|sbagliato|non proprio/i.test(text);
}

// Detect if the coach signals a wrong answer
function isWrongFeedback(text: string): boolean {
  return /quasi|riprova|non proprio|non è|proviamo|rifacciamo|attenzione|hmm|🤔/i.test(text);
}

type CoachStatus = "thinking" | "writing" | "reading" | "waiting" | "idle";

function getStatusIndicator(status: CoachStatus, name?: string) {
  const label = name || "Il tuo coach";
  switch (status) {
    case "thinking": return { icon: "💭", text: `${label} sta pensando...` };
    case "writing": return { icon: "🖊️", text: `${label} sta preparando la risposta...` };
    case "reading": return { icon: "👀", text: `${label} sta leggendo la lavagna...` };
    case "waiting": return { icon: "✏️", text: "Tocca a te!" };
    case "idle": return null;
  }
}

export function ChatShell({
  title, subtitle, badgeText, coachName, studentGreeting,
  messages, streamingText, sending,
  onSend, onBack, onAction, onEndSession,
  progress, progressLabel,
  showHint = true, showStuck = true, showExplain = true,
  showVoice = true, showAttach = true,
  showPomodoro = false, pomodoroMinutes = 25,
  extraFooter, inputPlaceholder,
  disabled = false,
}: ChatShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedPlaceholder = inputPlaceholder || t("chat_input_placeholder");
  const [input, setInput] = useState("");
  const [showExplainOptions, setShowExplainOptions] = useState(false);
  const [progressiveComplete, setProgressiveComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset progressive complete when messages change
  useEffect(() => {
    setProgressiveComplete(false);
  }, [messages.length]);

  // Whiteboard state
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [whiteboardLoading, setWhiteboardLoading] = useState(false);

  // Points & feedback state
  const [sessionPoints, setSessionPoints] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [pointsPopup, setPointsPopup] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Coach status
  const coachStatus: CoachStatus = whiteboardLoading
    ? "reading"
    : sending
      ? "thinking"
      : !sending && messages.length > 0 && isWaitingForStudent(messages[messages.length - 1]?.content || "")
        ? "waiting"
        : "idle";

  // ── Incremental SVG: compute per-message exercise step ──
  // Tracks how many sub-steps the student has confirmed so far.
  // exerciseSteps[i] = undefined means "show full SVG" (explanation mode).
  // exerciseSteps[i] = 0 means "show only the problem, no solution".
  // exerciseSteps[i] = N means "show N confirmed sub-steps".
  const exerciseSteps = useMemo(() => {
    const steps: (number | undefined)[] = [];
    let inExercise = false;
    let step = 0;

    for (const msg of messages) {
      if (msg.role !== "assistant") {
        steps.push(undefined);
        continue;
      }
      const text = msg.content || "";
      const hasColonna = /\[COLONNA:/i.test(text);
      const hasParziale = /parziale\s*=\s*true/i.test(text);

      if (!inExercise) {
        // Detect exercise start: COLONNA with parziale=true, or COLONNA + question
        if (hasColonna && (hasParziale || /prova tu|tocca a te|quanto fa|quante volte|calcola|come inizieresti/i.test(text.toLowerCase()))) {
          inExercise = true;
          step = 0;
          steps.push(step);
          continue;
        }
        steps.push(undefined); // explanation mode
        continue;
      }

      // Already in exercise mode — only increment step if previous message was from the student
      const msgIndex = messages.indexOf(msg);
      const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
      const prevWasStudent = prevMsg?.role === "user";
      const isConfirm = prevWasStudent
        && /esatto|perfetto|brav[oaie]|bravissim|corretto|giusto|ottimo|eccellente|ben fatto|✅|🎉/i.test(text)
        && !/non è corrett|sbagliato|non proprio|purtroppo/i.test(text);

      // If exercise seems to end (no more COLONNA, or "completo/finito")
      if (/abbiamo finito|risultato finale|complimenti.*completato|hai completato/i.test(text.toLowerCase())) {
        steps.push(undefined); // show full result
        inExercise = false;
        continue;
      }

      // Push CURRENT step for this message, THEN increment.
      // This way the confirmation message still shows the previous step,
      // and only the NEXT message will show the revealed answer.
      steps.push(hasColonna ? step : undefined);

      if (isConfirm) {
        step++;
      }
    }
    // Debug logging for SVG step tracking
    messages.forEach((msg, i) => {
      if (msg.role === "assistant") {
        console.log(`MSG ${i}: step=${steps[i]}, hasColonna=${/\[COLONNA:/i.test(msg.content||'')}, isConfirm=${/esatto|perfetto|bravo/i.test(msg.content||'')}`);
      }
    });

    return steps;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Detect correct/wrong answers from new assistant messages
  useEffect(() => {
    if (messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    if (isCorrectFeedback(lastMsg.content)) {
      const newStreak = correctStreak + 1;
      setCorrectStreak(newStreak);
      setSessionPoints(prev => prev + 10);
      setPointsPopup(10);
      setTimeout(() => setPointsPopup(null), 1500);

      if (soundEnabled) playCorrectSound();

      if (newStreak >= 3 && newStreak % 3 === 0) {
        fireConfetti();
      }
    } else if (isWrongFeedback(lastMsg.content)) {
      setCorrectStreak(0);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    }
  }, [messages.length]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || sending || !onSend) return;
    onSend(input.trim());
    setInput("");
  }

  const [isListening, setIsListening] = useState(false);
  const [attachProcessing, setAttachProcessing] = useState(false);

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onSend) return;
    e.target.value = "";

    setAttachProcessing(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-homework`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            imageUrls: [dataUrl],
            sourceType: file.type.includes("pdf") ? "photo-book" : "photo-diary",
          }),
        }
      );

      if (!res.ok) {
        onSend("[Il file non è leggibile] Non riesco a leggere questo file. Prova con una foto più nitida o un PDF diverso.");
        return;
      }

      const result = await res.json();
      if (result.tasks && result.tasks.length > 0) {
        const extractedText = result.tasks.map((t: any) => {
          const parts = [t.title];
          if (t.description) parts.push(t.description);
          if (t.exerciseText) parts.push(`Esercizio: ${t.exerciseText}`);
          return parts.join("\n");
        }).join("\n\n---\n\n");

        onSend(`[Contenuto estratto dal file "${file.name}"]\n\n${extractedText}\n\nAnalizza questo contenuto nel contesto della sessione attiva.`);
      } else {
        onSend("[Il file non è leggibile] Non riesco a leggere questo file. Prova con una foto più nitida o un PDF diverso.");
      }
    } catch (err) {
      console.error("Attach file error:", err);
      onSend("[Il file non è leggibile] Non riesco a leggere questo file. Prova con una foto più nitida o un PDF diverso.");
    } finally {
      setAttachProcessing(false);
    }
  }

  // Whiteboard OCR submission
  async function handleWhiteboardSubmit(imageDataUrl: string) {
    setWhiteboardLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
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
            stream: false,
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Leggi questa immagine scritta a mano da uno studente. Restituisci SOLO il testo riconosciuto, pulito e naturale. Non restituire JSON, non restituire codice, non restituire markdown, non spiegare nulla. Se non è leggibile, rispondi solo con: ILLEGGIBILE`,
                },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            }],
            model: "gpt-4o",
            maxTokens: 120,
          }),
        }
      );

      const text = await res.text();
      let recognized = "";

      try {
        const parsed = JSON.parse(text);
        recognized = parsed?.choices?.[0]?.message?.content || parsed?.response || parsed?.message || "";
      } catch {
        recognized = text;
      }

      const cleanedRecognition = sanitizeWhiteboardRecognition(recognized);

      setWhiteboardOpen(false);

      if (!cleanedRecognition || /^illeggibile$/i.test(cleanedRecognition)) {
        onSend?.("Non riesco a leggere bene la lavagna... puoi riscrivere più grande? 😊");
      } else {
        onSend?.(cleanedRecognition);
      }
    } catch (err) {
      console.error("Whiteboard OCR error:", err);
      setWhiteboardOpen(false);
      onSend?.("Non riesco a leggere la lavagna. Prova a scrivere con la tastiera.");
    } finally {
      setWhiteboardLoading(false);
    }
  }

  function startVoice() {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        alert(t("chat_mic_denied"));
        return;
      }
      const recognition = new SR();
      recognition.lang = "it-IT";
      recognition.continuous = false;
      recognition.interimResults = false;
      setIsListening(true);
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) onSend?.(transcript);
        setIsListening(false);
      };
      recognition.onerror = (e: any) => {
        setIsListening(false);
        if (e.error === "not-allowed") {
          alert(t("chat_mic_denied"));
        } else if (e.error === "no-speech") {
          // silence
        } else {
          console.warn("Errore riconoscimento vocale:", e.error);
        }
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      setIsListening(false);
      console.error("Errore avvio microfono:", err);
    }
  }

  const lastMsg = messages[messages.length - 1];
  const hasActions = lastMsg?.role === "assistant" && lastMsg.actions && lastMsg.actions.length > 0;
  const showWhiteboardOption = lastMsg?.role === "assistant" && isWaitingForStudent(lastMsg.content || "") && !hasActions && !sending;
  const statusInfo = getStatusIndicator(coachStatus, coachName);

  // Parse arrow options from assistant messages into action buttons
  function parseInlineOptions(text: string): { cleanText: string; options: string[]; hasLinkPrep: boolean } {
    const lines = text.split("\n");
    const options: string[] = [];
    const cleanLines: string[] = [];
    let hasLinkPrep = false;
    for (const line of lines) {
      if (line.includes("[LINK_PREP]")) {
        hasLinkPrep = true;
        cleanLines.push(line.replace(/\[LINK_PREP\]/g, "").trim());
        continue;
      }
      const match = line.match(/^\s*(?:👉|•|-)\s+(.+)$/);
      if (match) {
        options.push(match[1].trim());
      } else {
        cleanLines.push(line);
      }
    }
    return { cleanText: cleanLines.join("\n").trim(), options, hasLinkPrep };
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        {coachName && (
          <CoachAvatar mood="default" size={32} />
        )}
        <div className="flex-1 min-w-0">
          {coachName && <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">{coachName}</p>}
          {studentGreeting && <p className="text-[10px] text-muted-foreground">{studentGreeting}</p>}
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          {progress !== undefined && (
            <div className="flex items-center gap-2 mt-1">
              {progressLabel && <span className="text-xs text-muted-foreground">{progressLabel}</span>}
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-32">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
              </div>
            </div>
          )}
        </div>

        {/* Points display */}
        <div className="relative flex items-center gap-1">
          {sessionPoints > 0 && (
            <motion.div
              key={sessionPoints}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.2, 1] }}
              className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full"
            >
              ⭐ {sessionPoints}
            </motion.div>
          )}
          <AnimatePresence>
            {pointsPopup && (
              <motion.span
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -20 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2 }}
                className="absolute -top-4 right-0 text-xs font-bold text-[#1D9E75]"
              >
                +{pointsPopup}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Sound toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {badgeText && (
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{badgeText}</span>
        )}
        {showPomodoro && (
          <PomodoroTimer compact focusMinutes={pomodoroMinutes} userMessageCount={messages.filter(m => m.role === "user").length} />
        )}
        {onEndSession && messages.length >= 2 && (
          <button
            onClick={onEndSession}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
          >
            <Square className="w-3 h-3" />
            Termina
          </button>
        )}
      </div>

      {/* Status indicator bar */}
      <AnimatePresence>
        {statusInfo && coachStatus !== "idle" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-muted/50 border-b border-border px-4 py-1.5 flex items-center gap-2 text-xs text-muted-foreground font-['Patrick_Hand'] overflow-hidden"
          >
            <span className={coachStatus === "waiting" ? "animate-pulse text-[#E57373]" : ""}>{statusInfo.icon}</span>
            <span className={coachStatus === "waiting" ? "text-[#E57373] font-semibold" : ""}>{statusInfo.text}</span>
            {correctStreak >= 3 && (
              <span className="ml-auto text-amber-500 font-bold">🔥 Zona! ×{correctStreak}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 py-4 space-y-4 ${shaking ? "animate-shake" : ""}`}>
        <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
            // Parse JSON coach responses before any other processing
            let rawContent = msg.role === "assistant" ? parseCoachJsonResponse(msg.content || "") : (msg.content || "");
            // CRITICAL: Override celle_compilate with frontend-computed value
            // This prevents the AI from revealing future steps in the SVG
            if (msg.role === "assistant" && exerciseSteps[i] !== undefined && /\[COLONNA:/i.test(rawContent)) {
              const step = exerciseSteps[i]!;
              // Force parziale=true if not present
              if (!/parziale\s*=\s*true/i.test(rawContent)) {
                rawContent = rawContent.replace(
                  /(\[COLONNA:\s*tipo\s*=\s*\w+\s*,\s*numeri\s*=\s*[\d,]+)/gi,
                  '$1, parziale=true'
                );
              }
              // Override celle_compilate with our computed value
              if (/celle_compilate\s*=\s*\d+/i.test(rawContent)) {
                rawContent = rawContent.replace(/celle_compilate\s*=\s*\d+/gi, `celle_compilate=${step}`);
              } else {
                rawContent = rawContent.replace(
                  /(parziale\s*=\s*true)/gi,
                  `$1, celle_compilate=${step}`
                );
              }
            }
            const msgMood: CoachAvatarMood = msg.role === "assistant" ? detectMoodFromText(rawContent) : "default";
            const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
            // Parse inline options (👉) from assistant messages
            const { cleanText: parsedCleanText, options: parsedOptions, hasLinkPrep } = msg.role === "assistant" ? parseInlineOptions(rawContent) : { cleanText: rawContent, options: [], hasLinkPrep: false };
            // Only show parsed inline options on the FIRST assistant message (familiarity check), not on every message
            const isFirstAssistantMsg = msg.role === "assistant" && messages.filter((m, idx) => m.role === "assistant" && idx <= i).length === 1;
            const showParsedOptions = isLastAssistant && isFirstAssistantMsg && parsedOptions.length > 0 && !msg.actions?.length;
            const displayContent = (showParsedOptions || hasLinkPrep) ? parsedCleanText : rawContent;

            return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 mr-2 mt-1">
                  <CoachAvatar mood={msgMood} size={32} />
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={`rounded-xl px-4 py-3 text-[15px] leading-[1.7] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "notebook-bubble rounded-bl-sm"
                }`}>
                  {isLastAssistant ? (
                    <div>
                      <div className="flex items-center gap-1 mb-1 opacity-60">
                        <WritingPen writing={false} />
                      </div>
                      <ProgressiveMessage content={displayContent || ""} charDelay={35} blockPause={800} onComplete={() => setProgressiveComplete(true)} exerciseStep={exerciseSteps[i]} />
                    </div>
                  ) : (
                    <MathText exerciseStep={exerciseSteps[i]}>{displayContent || ""}</MathText>
                  )}
                </div>
                {/* Parsed inline options as vertical buttons — only show AFTER progressive message finishes */}
                {showParsedOptions && progressiveComplete && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-2 mt-3">
                    {parsedOptions.map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi); // A, B, C...
                      return (
                        <button
                          key={oi}
                          onClick={() => onSend?.(opt)}
                          disabled={sending}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all text-left"
                        >
                          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">{letter}</span>
                          {opt}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
                {/* Prep redirect CTA button when [LINK_PREP] tag detected */}
                {hasLinkPrep && progressiveComplete && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-3">
                    <button
                      onClick={() => navigate("/session?type=prep" + (msg.content?.match(/materia/i) ? "" : ""))}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all w-full justify-center"
                    >
                      🎯 {t("coach_cta_go_to_prep")}
                    </button>
                  </motion.div>
                )}
                {msg.actions && msg.actions.length > 0 && i === messages.length - 1 && (
                  <div className="flex flex-col gap-2 mt-3">
                    {msg.actions.map((action, ai) => (
                      <button
                        key={ai}
                        onClick={() => onAction?.(action.value)}
                        disabled={sending}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                          action.primary
                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            : "bg-card text-foreground border-border hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        {action.icon && <span className="text-lg">{action.icon}</span>}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            );
          })}
        </AnimatePresence>

        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="flex-shrink-0 mr-2">
              <CoachAvatar mood={whiteboardLoading ? "thinking" : "thinking"} size={32} />
            </div>
            <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <WritingPen writing={true} />
              <span className="text-sm text-muted-foreground font-['Patrick_Hand']">
                {whiteboardLoading ? `${coachName || "Il tuo coach"} sta leggendo la lavagna...` : `${coachName || "Il tuo coach"} sta pensando...`}
              </span>
            </div>
          </div>
        )}

        {/* Whiteboard card removed — button now in toolbar below */}
      </div>

      {/* Extra footer */}
      {extraFooter}

      {/* Input toolbar */}
      {!hasActions && !disabled && onSend && (
        <div className="border-t border-border bg-card p-3 shrink-0 sticky bottom-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {showVoice && (
              <button onClick={startVoice} disabled={sending || isListening}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isListening
                    ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-950 animate-pulse"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}>
                <Mic className="w-3.5 h-3.5" /> {isListening ? t("chat_listening") : t("chat_voice")}
              </button>
            )}
            {showAttach && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" /> {attachProcessing ? t("chat_analyzing") : t("chat_attach")}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleAttachFile} disabled={attachProcessing} />
              </label>
            )}
            {showHint && (
              <button onClick={() => onSend(t("chat_send_hint"))} disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary/5 transition-colors">
                <Lightbulb className="w-3.5 h-3.5" /> {t("chat_hint")}
              </button>
            )}
            {showStuck && (
              <button onClick={() => onSend(t("chat_send_stuck"))} disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
                <AlertCircle className="w-3.5 h-3.5" /> {t("chat_stuck")}
              </button>
            )}
            {/* Whiteboard button — always visible */}
            <button onClick={() => setWhiteboardOpen(true)} disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
              🖊️ Lavagna
            </button>
            {showExplain && (
              <div className="relative">
                <button onClick={() => setShowExplainOptions(!showExplainOptions)} disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> {t("chat_explain_differently")}
                </button>
                {showExplainOptions && (
                  <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                    {[
                      { label: t("chat_simpler"), msg: t("chat_send_simpler") },
                      { label: t("chat_example"), msg: t("chat_send_example") },
                      { label: t("chat_step_by_step"), msg: t("chat_send_step_by_step") },
                      { label: t("chat_shorter"), msg: t("chat_send_shorter") },
                    ].map(opt => (
                      <button key={opt.label} onClick={() => { setShowExplainOptions(false); onSend(opt.msg); }}
                        className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={resolvedPlaceholder}
              className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || sending}
              className="bg-primary hover:bg-primary/90 rounded-xl h-10 w-10">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Whiteboard modal */}
      <Whiteboard
        open={whiteboardOpen}
        onClose={() => setWhiteboardOpen(false)}
        onSubmit={handleWhiteboardSubmit}
        loading={whiteboardLoading}
      />
    </div>
  );
}