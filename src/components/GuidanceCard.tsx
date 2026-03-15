import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ChevronUp, ChevronDown, Send, Mic, MicOff, Camera, Image, X } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface TaskContext {
  title?: string;
  subject?: string;
  description?: string;
  sourceType?: string;
  keyConcepts?: string[];
  microSteps?: any[];
  difficulty?: number;
}

interface GuidanceCardProps {
  emotion: string;
  taskTitle?: string;
  taskSubject?: string;
  taskContext?: TaskContext;
  bottomOffset?: number;
  sessionKey?: string; // key for sessionStorage persistence
  onMessagesChange?: (messages: Message[]) => void;
}

interface Message {
  id: string;
  role: "coach" | "student";
  text: string;
  imageUrl?: string;
}

const thinkingPaths = [
  { id: "stuck", label: "Sono bloccato", variant: "sage" as const },
  { id: "hint", label: "Dammi un indizio", variant: "clay" as const },
  { id: "check", label: "Controlla la mia risposta", variant: "muted" as const },
];

const variantClasses = {
  sage: "bg-sage-light text-sage-dark hover:bg-accent",
  clay: "bg-clay-light text-clay-dark hover:bg-accent",
  muted: "bg-muted text-muted-foreground hover:bg-accent",
};

export const GuidanceCard = ({ emotion, taskTitle, taskSubject, taskContext, bottomOffset }: GuidanceCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Speech recognition
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
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    isRecording ? stopRecording() : startRecording();
  };

  // Image handling
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      // Convert to base64 data URL for preview and sending
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImage(reader.result as string);
        setIsUploading(false);
      };
      reader.onerror = () => setIsUploading(false);
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removePendingImage = () => setPendingImage(null);

  const getProfile = () => {
    try {
      const saved = localStorage.getItem("inschool-profile");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  // Initial message
  useEffect(() => {
    const profile = getProfile();
    const name = profile?.name || "campione";
    const sourceType = taskContext?.sourceType || "manual";
    
    let initial: string;
    if (emotion === "frustrated" || emotion === "worried") {
      initial = `Capisco che può sembrare difficile, ${name}. Facciamo il primo piccolo passo insieme — solo quello. Cosa dice la consegna?`;
    } else if (emotion === "tired") {
      initial = `Sei stanco, ${name}, è normale. Facciamo solo un micro-passo, poi vediamo come va. Cosa devi fare in questo esercizio?`;
    } else if (sourceType === "photo" || sourceType === "textbook") {
      initial = `Perfetto ${name}! Ho visto l'esercizio${taskSubject ? ` di ${taskSubject}` : ""}. Prima di tutto, facciamo un piccolo ripasso di quello che ci serve per risolverlo. Sei pronto?`;
    } else if (taskTitle?.toLowerCase().includes("legg") || taskTitle?.toLowerCase().includes("lettura") || taskTitle?.toLowerCase().includes("libro")) {
      initial = `Perfetto ${name}! Vedo che devi leggere. 📖 Quale libro o capitolo stai leggendo? Raccontami un po'!`;
    } else {
      initial = `Perfetto ${name}, iniziamo! ${taskTitle ? `Stiamo lavorando su "${taskTitle}"${taskSubject ? ` di ${taskSubject}` : ""}.` : ""} Leggi la consegna dell'esercizio. Cosa ti chiede di fare?`;
    }
    
    setMessages([{ id: "init", role: "coach", text: initial }]);
  }, [emotion, taskTitle, taskSubject, taskContext?.sourceType]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, streamingText]);

  const streamCoachReply = async (allMessages: Message[]) => {
    setIsTyping(true);
    setStreamingText("");

    const profile = getProfile();
    
    // Build chat messages, including images as multimodal content
    const chatMessages = allMessages.map(m => {
      if (m.imageUrl && m.role === "student") {
        // Multimodal message with image
        const content: any[] = [];
        if (m.text) {
          content.push({ type: "text", text: m.text });
        }
        content.push({
          type: "image_url",
          image_url: { url: m.imageUrl },
        });
        if (!m.text) {
          content.push({ type: "text", text: "Ho fotografato il mio quaderno con gli esercizi svolti. Puoi controllare le mie risposte?" });
        }
        return { role: "user" as const, content };
      }
      return {
        role: m.role === "coach" ? "assistant" as const : "user" as const,
        content: m.text,
      };
    });

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
            taskContext: taskContext ? {
              title: taskContext.title || taskTitle,
              subject: taskContext.subject || taskSubject,
              description: taskContext.description,
              sourceType: taskContext.sourceType,
              keyConcepts: taskContext.keyConcepts,
              microSteps: taskContext.microSteps,
              difficulty: taskContext.difficulty,
            } : {
              title: taskTitle,
              subject: taskSubject,
            },
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

      if (assistantText) {
        setMessages(prev => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: assistantText }]);
      }
    } catch (err) {
      console.error("AI Coach error:", err);
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
    if ((!trimmed && !pendingImage) || isTyping) return;

    const newMsg: Message = {
      id: `student-${Date.now()}`,
      role: "student",
      text: trimmed || (pendingImage ? "📷 Ho fotografato i miei esercizi" : ""),
      imageUrl: pendingImage || undefined,
    };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput("");
    setPendingImage(null);
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

  const isInline = typeof bottomOffset !== "number";

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className={isInline ? "h-full flex flex-col" : "fixed left-0 right-0 z-40"}
      style={isInline ? undefined : { bottom: bottomOffset }}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        className="hidden"
      />

      <div className={isInline ? "h-full flex flex-col px-0 pb-0" : "max-w-2xl mx-auto px-4 pb-4"}>
        <div className={`bg-card rounded-2xl shadow-hover border border-primary/10 overflow-hidden ${isInline ? "flex-1 flex flex-col min-h-0" : ""}`}>
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
                  <div ref={scrollRef} className={`${isInline ? "max-h-[24dvh]" : "max-h-56"} overflow-y-auto space-y-3 mb-3 scroll-smooth`}>
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
                          {msg.imageUrl && (
                            <img
                              src={msg.imageUrl}
                              alt="Esercizio fotografato"
                              className="rounded-lg mb-2 max-h-32 object-cover"
                            />
                          )}
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}

                    {/* Streaming text */}
                    {streamingText && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="max-w-[85%] bg-sage-light/50 text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed">
                          {streamingText}
                          <span className="inline-block w-1.5 h-4 bg-primary/40 ml-0.5 animate-pulse" />
                        </div>
                      </motion.div>
                    )}

                    {/* Typing indicator */}
                    {isTyping && !streamingText && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-sage-light/50 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Pending image preview */}
                  {pendingImage && (
                    <div className="mb-3 relative inline-block">
                      <img src={pendingImage} alt="Anteprima" className="h-20 rounded-xl border border-border object-cover" />
                      <button
                        onClick={removePendingImage}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

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

                  {/* Input area - two rows on mobile for better touch targets */}
                  <div className="flex flex-col gap-2">
                    {/* Media buttons row */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isTyping || isUploading}
                        className="h-8 px-2.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-40 text-xs font-medium"
                        title="Fotografa il quaderno"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Foto</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isTyping || isUploading}
                        className="h-8 px-2.5 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-40 text-xs font-medium"
                        title="Carica foto"
                      >
                        <Image className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Galleria</span>
                      </button>
                      <button
                        onClick={toggleRecording}
                        disabled={isTyping}
                        className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 text-xs font-medium ${
                          isRecording
                            ? "bg-destructive text-destructive-foreground animate-pulse"
                            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                        } disabled:opacity-40`}
                      >
                        {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span className="hidden xs:inline">{isRecording ? "Stop" : "Voce"}</span>
                      </button>
                    </div>
                    {/* Text input + send row */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRecording ? "🎙️ Sto ascoltando..." : pendingImage ? "Aggiungi un messaggio..." : "Scrivi qui..."}
                        disabled={isTyping}
                        className={`flex-1 min-w-0 bg-muted/50 border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-all ${isRecording ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
                      />
                      <button
                        onClick={handleSend}
                        disabled={(!input.trim() && !pendingImage) || isTyping}
                        className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
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
