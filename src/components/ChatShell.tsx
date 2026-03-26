import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Mic, Paperclip, Lightbulb, AlertCircle, RefreshCw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMsg } from "@/lib/streamChat";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { getCoachMoodSrc, detectMoodFromText, type CoachMood } from "@/components/shared/CoachAvatarPicker";
import { MathText } from "@/components/shared/MathText";

interface ChatShellProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  coachName?: string;
  messages: ChatMsg[];
  streamingText: string;
  sending: boolean;
  onSend?: (text: string) => void;
  onBack: () => void;
  onAction?: (value: string) => void;
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

export function ChatShell({
  title, subtitle, badgeText, coachName,
  messages, streamingText, sending,
  onSend, onBack, onAction,
  progress, progressLabel,
  showHint = true, showStuck = true, showExplain = true,
  showVoice = true, showAttach = true,
  showPomodoro = false, pomodoroMinutes = 25,
  extraFooter, inputPlaceholder = "Scrivi la tua risposta...",
  disabled = false,
}: ChatShellProps) {
  const [input, setInput] = useState("");
  const [showExplainOptions, setShowExplainOptions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

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
    e.target.value = ""; // reset input

    setAttachProcessing(true);
    try {
      // Convert file to base64 data URL
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call OCR edge function
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
        // Extract text content from OCR results
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

  function startVoice() {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        alert("Il tuo browser non supporta il riconoscimento vocale. Prova con Chrome.");
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
          alert("Permesso microfono negato. Controlla le impostazioni del browser.");
        } else if (e.error === "no-speech") {
          // silenzio, nessun feedback necessario
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

  return (
    <div className="h-screen flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
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
        {badgeText && (
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{badgeText}</span>
        )}
        {showPomodoro && (
          <PomodoroTimer compact focusMinutes={pomodoroMinutes} userMessageCount={messages.filter(m => m.role === "user").length} />
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const mood: CoachMood = msg.role === "assistant" ? detectMoodFromText(msg.content || "") : "happy";
            return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-1 overflow-hidden bg-primary/5">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={mood}
                      src={getCoachMoodSrc(mood)}
                      alt="Coach"
                      className="w-full h-full object-cover"
                      width={32} height={32}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  </AnimatePresence>
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  <MathText>{msg.content}</MathText>
                </div>
                {/* Inline action buttons */}
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

        {streamingText && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-1 overflow-hidden bg-primary/5">
              <motion.img
                src={getCoachMoodSrc("thinking")}
                alt="Coach"
                className="w-full h-full object-cover"
                width={32} height={32}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </div>
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              <MathText>{streamingText}</MathText>
              <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full flex-shrink-0 mr-2 overflow-hidden bg-primary/5">
              <motion.img
                src={getCoachMoodSrc("thinking")}
                alt="Coach"
                className="w-full h-full object-cover"
                width={32} height={32}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            </div>
            <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Extra footer */}
      {extraFooter}

      {/* Input toolbar - hide when actions are showing or disabled (read-only) */}
      {!hasActions && !disabled && onSend && (
        <div className="border-t border-border bg-card p-3 shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {showVoice && (
              <button onClick={startVoice} disabled={sending || isListening}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isListening
                    ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-950 animate-pulse"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}>
                <Mic className="w-3.5 h-3.5" /> {isListening ? "Ascolto..." : "Voce"}
              </button>
            )}
            {showAttach && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" /> {attachProcessing ? "Analisi..." : "Allega"}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleAttachFile} disabled={attachProcessing} />
              </label>
            )}
            {showHint && (
              <button onClick={() => onSend("Dammi un indizio.")} disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary/5 transition-colors">
                <Lightbulb className="w-3.5 h-3.5" /> Indizio
              </button>
            )}
            {showStuck && (
              <button onClick={() => onSend("Sono bloccato — cambia approccio e aiutami in modo più semplice.")} disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
                <AlertCircle className="w-3.5 h-3.5" /> Bloccato
              </button>
            )}
            {showExplain && (
              <div className="relative">
                <button onClick={() => setShowExplainOptions(!showExplainOptions)} disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Spiega diversamente
                </button>
                {showExplainOptions && (
                  <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                    {[
                      { label: "Più semplice", msg: "Spiegamelo in modo più semplice." },
                      { label: "Con un esempio", msg: "Fammi un esempio pratico per capire meglio." },
                      { label: "Passo passo", msg: "Spiegamelo passo passo, più lentamente." },
                      { label: "Più breve", msg: "Spiegamelo in modo più breve e diretto." },
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
              placeholder={inputPlaceholder}
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
    </div>
  );
}
