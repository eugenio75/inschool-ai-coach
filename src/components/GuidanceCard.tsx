import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ChevronUp, ChevronDown, Send, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface GuidanceCardProps {
  emotion: string;
  taskTitle?: string;
  taskSubject?: string;
}

interface Message {
  id: string;
  role: "coach" | "student";
  text: string;
}

const thinkingPaths = [
  { id: "stuck", label: "Sono bloccato", variant: "sage" as const },
  { id: "hint", label: "Dammi un indizio", variant: "clay" as const },
  { id: "gotit", label: "Ho capito!", variant: "muted" as const },
];

const variantClasses = {
  sage: "bg-sage-light text-sage-dark hover:bg-accent",
  clay: "bg-clay-light text-clay-dark hover:bg-accent",
  muted: "bg-muted text-muted-foreground hover:bg-accent",
};

export const GuidanceCard = ({ emotion, taskTitle, taskSubject }: GuidanceCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Speech recognition setup
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInput("(Il tuo browser non supporta il riconoscimento vocale)");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Load student profile
  const getProfile = () => {
    try {
      const saved = localStorage.getItem("inschool-profile");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  // Initial message based on emotion
  useEffect(() => {
    const profile = getProfile();
    const name = profile?.name || "campione";
    
    let initial: string;
    if (emotion === "frustrated" || emotion === "worried") {
      initial = `Capisco che può sembrare difficile, ${name}. Facciamo il primo piccolo passo insieme — solo quello. Cosa dice la consegna?`;
    } else if (emotion === "tired") {
      initial = `Sei stanco, ${name}, è normale. Facciamo solo un micro-passo, poi vediamo come va. Cosa devi fare in questo esercizio?`;
    } else {
      initial = `Perfetto ${name}, iniziamo! ${taskTitle ? `Stiamo lavorando su "${taskTitle}"${taskSubject ? ` di ${taskSubject}` : ""}.` : ""} Leggi la consegna dell'esercizio. Cosa ti chiede di fare?`;
    }
    
    setMessages([{ id: "init", role: "coach", text: initial }]);
  }, [emotion, taskTitle, taskSubject]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, streamingText]);

  const streamCoachReply = async (allMessages: Message[]) => {
    setIsTyping(true);
    setStreamingText("");

    const profile = getProfile();
    const chatMessages = allMessages.map(m => ({
      role: m.role === "coach" ? "assistant" as const : "user" as const,
      content: m.text,
    }));

    // Add context about the current task
    if (taskTitle) {
      chatMessages.unshift({
        role: "user" as const,
        content: `[CONTESTO: Lo studente sta lavorando su "${taskTitle}" di ${taskSubject || "materia non specificata"}. Emozione iniziale: ${emotion}. Non mostrare questo messaggio, usalo solo come contesto.]`,
      });
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: chatMessages,
            studentProfile: profile,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Errore di connessione");
      }

      if (!response.body) throw new Error("No stream body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setStreamingText(assistantText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Finalize message
      if (assistantText) {
        setMessages(prev => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: assistantText }]);
      }
    } catch (err) {
      console.error("AI Coach error:", err);
      // Fallback to local response
      const fallback = getFallbackResponse(allMessages[allMessages.length - 1]?.text || "");
      setMessages(prev => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: fallback }]);
    } finally {
      setIsTyping(false);
      setStreamingText("");
    }
  };

  const getFallbackResponse = (input: string): string => {
    const lower = input.toLowerCase();
    if (lower.match(/non capisco|difficile|non so|aiuto|non riesco/))
      return "Respira un attimo. È normale sentirsi così. Facciamo solo un piccolo passo — qual è la prima cosa che vedi nell'esercizio?";
    if (lower.match(/bloccato|stuck/))
      return "Nessun problema! Rileggiamo insieme la consegna. Cosa ti chiede di fare esattamente?";
    if (lower.match(/indizio|hint|suggerimento/))
      return "Un piccolo indizio: guarda bene i dati che hai. Cosa noti? C'è qualcosa che già conosci?";
    if (lower.match(/capito|ho capito|fatto/))
      return "Fantastico! Spiegami con parole tue cosa hai capito. Così vediamo se ci siamo! 🌱";
    return "Interessante! Prova a spiegarmelo con un esempio. Come ci sei arrivato?";
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const newMsg: Message = { id: `student-${Date.now()}`, role: "student", text: trimmed };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput("");
    streamCoachReply(updated);
  };

  const handlePath = (pathId: string) => {
    const label = thinkingPaths.find((p) => p.id === pathId)?.label || "";
    const newMsg: Message = { id: `student-${Date.now()}`, role: "student", text: label };
    const updated = [...messages, newMsg];
    setMessages(updated);
    streamCoachReply(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="fixed bottom-0 left-0 right-0 z-40"
    >
      <div className="max-w-2xl mx-auto px-4 pb-4">
        <div className="bg-card rounded-2xl shadow-hover border border-primary/10 overflow-hidden">
          {/* Toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sage-light flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-sage-dark" />
              </div>
              <span className="text-sm font-display font-semibold text-foreground">Coach AI</span>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 flex flex-col">
                  {/* Chat messages */}
                  <div
                    ref={scrollRef}
                    className="max-h-56 overflow-y-auto space-y-3 mb-3 scroll-smooth"
                  >
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "coach"
                              ? "bg-sage-light/50 text-foreground rounded-bl-md"
                              : "bg-primary text-primary-foreground rounded-br-md"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}

                    {/* Streaming text */}
                    {streamingText && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div className="max-w-[85%] bg-sage-light/50 text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed">
                          {streamingText}
                          <span className="inline-block w-1.5 h-4 bg-primary/40 ml-0.5 animate-pulse" />
                        </div>
                      </motion.div>
                    )}

                    {/* Typing indicator (before stream starts) */}
                    {isTyping && !streamingText && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div className="bg-sage-light/50 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Quick action buttons */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {thinkingPaths.map((path) => (
                      <button
                        key={path.id}
                        onClick={() => handlePath(path.id)}
                        disabled={isTyping}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 ${variantClasses[path.variant]}`}
                      >
                        {path.label}
                      </button>
                    ))}
                  </div>

                  {/* Text input */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Scrivi qui la tua risposta..."
                      disabled={isTyping}
                      className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-all"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isTyping}
                      className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
