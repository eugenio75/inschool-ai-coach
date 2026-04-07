import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Mic, Paperclip, Lightbulb, AlertCircle, RefreshCw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMsg } from "@/lib/streamChat";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { CoachAvatar, type CoachAvatarMood } from "@/components/shared/CoachAvatar";
import { MathText } from "@/components/shared/MathText";
import { useTranslation } from "react-i18next";

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

export function ChatShell({
  title, subtitle, badgeText, coachName,
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
  const resolvedPlaceholder = inputPlaceholder || t("chat_input_placeholder");
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

  return (
    <div className="h-screen flex flex-col bg-card">
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
            const msgMood: CoachAvatarMood = msg.role === "assistant" ? detectMoodFromText(msg.content || "") : "default";
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
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  <MathText>{msg.content}</MathText>
                </div>
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
            <div className="flex-shrink-0 mr-2 mt-1">
              <CoachAvatar mood="thinking" size={32} />
            </div>
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-muted px-4 py-3 text-[15px] leading-[1.7] whitespace-pre-wrap text-foreground">
              <MathText>{streamingText}</MathText>
              <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="flex-shrink-0 mr-2">
              <CoachAvatar mood="thinking" size={32} />
            </div>
            <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Extra footer */}
      {extraFooter}

      {/* Input toolbar */}
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
    </div>
  );
}
