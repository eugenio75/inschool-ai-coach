import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ChevronUp, ChevronDown, Send, Mic, MicOff, Camera, Image, X, Calculator } from "lucide-react";
import { MathNotepad } from "@/components/MathNotepad";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface TaskContext {
  title?: string;
  subject?: string;
  description?: string;
  sourceType?: string;
  keyConcepts?: string[];
  microSteps?: any[];
  difficulty?: number;
  sourceImageUrl?: string;
  taskType?: string;
}

interface WeakConcept {
  concept: string;
  summary?: string;
  strength?: number;
}

interface GuidanceCardProps {
  emotion: string;
  taskTitle?: string;
  taskSubject?: string;
  taskContext?: TaskContext;
  bottomOffset?: number;
  sessionKey?: string;
  onMessagesChange?: (messages: ChatMessage[]) => void;
  weakConcepts?: WeakConcept[];
}

export interface ChatMessage {
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

export const GuidanceCard = ({ emotion, taskTitle, taskSubject, taskContext, bottomOffset, sessionKey, onMessagesChange, weakConcepts }: GuidanceCardProps) => {
  const isMathSubject = /matem|aritm|geometr|algebra/i.test((taskSubject || "") + " " + (taskContext?.subject || ""));
  const CHAT_SESSION_VERSION = "v4";
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (sessionKey) {
      try {
        const saved = sessionStorage.getItem(`focus-chat-${sessionKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            sessionStorage.removeItem(`focus-chat-${sessionKey}`);
            return [];
          }
          if (parsed?._version === CHAT_SESSION_VERSION && Array.isArray(parsed.messages)) {
            return parsed.messages;
          }
          sessionStorage.removeItem(`focus-chat-${sessionKey}`);
        }
      } catch {
        sessionStorage.removeItem(`focus-chat-${sessionKey}`);
      }
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Speech recognition
  const getProfile = () => {
    try {
      const saved = localStorage.getItem("inschool-profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const removePendingImage = () => setPendingImage(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = typeof reader.result === "string" ? reader.result : null;
        setPendingImage(imageUrl);
        setIsUploading(false);
      };
      reader.onerror = () => setIsUploading(false);
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
    }

    e.target.value = "";
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results || [])
        .map((result: any) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();

      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const toggleRecording = () => {
    const recognition = recognitionRef.current;
    if (!recognition || isTyping) return;

    if (isRecording) {
      try {
        recognition.stop();
      } catch {}
      setIsRecording(false);
      return;
    }

    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  // Track if we need to auto-trigger AI analysis after initial message
  const autoAnalyzeRef = useRef(false);

  // Initial message - wait for task context when a task is present
  useEffect(() => {
    if (messages.length > 0) return; // Already restored from sessionStorage

    const hasTaskIdentity = Boolean(taskTitle || taskSubject || taskContext?.title);
    const isTaskContextReady = !hasTaskIdentity || Boolean(taskContext);
    if (!isTaskContextReady) return;
    
    const profile = getProfile();
    const name = profile?.name || "campione";
    const sourceType = taskContext?.sourceType || "manual";
    const isPhotoTask = ["photo", "textbook", "photo-book", "photo-diary"].includes(sourceType);
    const hasSourcePage = Boolean(taskContext?.sourceImageUrl);
    const readingContext = `${taskTitle || ""} ${taskSubject || ""} ${taskContext?.title || ""} ${taskContext?.description || ""}`.toLowerCase();
    const isReadingComprehensionTask = /(comprension|comprendere|brano|testo|lettura|leggi e rispondi|rispondi alle domande|domande sul testo|racconto)/i.test(readingContext);
    const hasReadingText = (taskContext?.description || "").trim().length > 80;
    
    // Detect oral/study tasks: subjects like Storia, Geografia, Scienze with manual source
    const oralContext = `${taskTitle || ""} ${taskContext?.title || ""} ${taskContext?.description || ""}`.toLowerCase();
    const isOralSubject = /stori|geografi|scienz|italian|letteratur|grammati|biologi|filosof|diritt|civic|religion|music/i.test((taskSubject || "") + " " + (taskContext?.subject || ""));
    const isManualSource = sourceType === "manual";
    const isOralStudyTask = isManualSource && (
      /(studia|ripeti|ripassa|ripetere|ripassare|orale|interrogazione|esponi|esporre|presentazione|memorizza|impara|leggere e studiare|preparare)/i.test(oralContext) ||
      (isOralSubject && !isReadingComprehensionTask && !/(eserciz|calcol|risolv|complet|scrivi|traduci|osserva|indica|parlane|conversando|prova a capire)/i.test(oralContext))
    );
    
    const isStudyTask = taskContext?.taskType === "study";
    
    let initial: string;
    let shouldAutoAnalyze = false;

    if (isStudyTask) {
      // Study tasks: go directly to interrogation mode
      initial = `Ciao ${name}! 📖 Oggi studiamo "${taskContext?.title || taskTitle || "l'argomento"}"${taskSubject ? ` di ${taskSubject}` : ""}. Ho il testo della pagina e ti farò delle domande per aiutarti a capire e memorizzare tutto. Partiamo!`;
      shouldAutoAnalyze = true;
    } else if (isPhotoTask && hasSourcePage) {
      const title = taskContext?.title || taskTitle || "";
      initial = `Perfetto ${name}! Ho la pagina davanti${taskSubject ? ` di ${taskSubject}` : ""}. Lavoriamo su "${title}". Analizzo l'esercizio e ti preparo il ripasso... ⏳`;
      shouldAutoAnalyze = true;
    } else if (isPhotoTask) {
      initial = `Perfetto ${name}! Ho già il testo dell'attività${taskSubject ? ` di ${taskSubject}` : ""}. Partiamo da qui: ${taskContext?.description ? `"${taskContext.description}"` : `guardiamo insieme cosa chiede l'esercizio`}.`;
      shouldAutoAnalyze = true;
    } else if (isOralStudyTask) {
      if (emotion === "frustrated" || emotion === "worried") {
        initial = `Capisco che può sembrare tanto, ${name}. Ma facciamo un passo alla volta — ti faccio io qualche domanda su "${taskTitle || "l'argomento"}"${taskSubject ? ` di ${taskSubject}` : ""} per capire da dove partiamo. 📖`;
      } else if (emotion === "tired") {
        initial = `Sei stanco, ${name}, va bene. Facciamo una cosa leggera: ti faccio qualche domanda su "${taskTitle || "l'argomento"}" e vediamo cosa ricordi. Niente stress! 📖`;
      } else {
        initial = `Perfetto ${name}! Oggi studiamo "${taskTitle || "l'argomento"}"${taskSubject ? ` di ${taskSubject}` : ""}. 📖 Ti faccio subito qualche domanda per capire cosa sai già — poi approfondiamo dove serve!`;
      }
      shouldAutoAnalyze = true;
    } else if (emotion === "frustrated" || emotion === "worried") {
      initial = isReadingComprehensionTask
        ? `Capisco che può sembrare difficile, ${name}. Facciamo un passo alla volta: di chi o di cosa parla il brano?`
        : `Capisco che può sembrare difficile, ${name}. Facciamo il primo piccolo passo insieme — solo quello. Cosa dice la consegna?`;
    } else if (emotion === "tired") {
      initial = isReadingComprehensionTask
        ? `Sei stanco, ${name}, va bene. Partiamo con una domanda semplice sul brano: qual è il fatto principale che hai letto?`
        : `Sei stanco, ${name}, è normale. Facciamo solo un micro-passo, poi vediamo come va. Cosa dice la consegna dell'esercizio?`;
    } else if (isReadingComprehensionTask && hasReadingText) {
      initial = `Perfetto ${name}! Ti faccio domande sul brano per vedere se l'hai capito bene. Iniziamo: di chi o di cosa parla il testo?`;
    } else if (isReadingComprehensionTask) {
      initial = `Perfetto ${name}! Facciamo comprensione del testo. Raccontami in 2 frasi cosa hai letto e poi ti faccio domande mirate.`;
    } else if (taskTitle?.toLowerCase().includes("legg") || taskTitle?.toLowerCase().includes("lettura") || taskTitle?.toLowerCase().includes("libro")) {
      initial = `Perfetto ${name}! Vedo che devi leggere. 📖 Quale libro o capitolo stai leggendo? Raccontami un po'!`;
    } else {
      initial = `Perfetto ${name}, iniziamo! ${taskTitle ? `Stiamo lavorando su "${taskTitle}"${taskSubject ? ` di ${taskSubject}` : ""}.` : ""} Cosa dice la consegna?`;
    }
    
    const initMessages: ChatMessage[] = [{ id: "init", role: "coach", text: initial }];
    setMessages(initMessages);
    
    if (shouldAutoAnalyze) {
      autoAnalyzeRef.current = true;
    }
  }, [messages.length, taskTitle, taskSubject, taskContext, emotion]);

  // Auto-trigger AI analysis after initial message is set
  useEffect(() => {
    if (autoAnalyzeRef.current && messages.length === 1 && messages[0].id === "init") {
      autoAnalyzeRef.current = false;
      const studentMsg: ChatMessage = {
        id: `student-auto-${Date.now()}`,
        role: "student",
        text: "Sì, partiamo! Fammi delle domande.",
      };
      const updated = [...messages, studentMsg];
      setMessages(updated);
      streamCoachReply(updated);
    }
  }, [messages]);

  // Defensive recovery: if a stale generic prompt survives on photo/PDF tasks, replace it and auto-start analysis
  useEffect(() => {
    const sourceType = taskContext?.sourceType || "manual";
    const isPhotoTask = ["photo", "textbook", "photo-book", "photo-diary"].includes(sourceType);
    const staleGenericPrompt = /cosa dice la consegna dell'esercizio\?/i.test(messages[0]?.text || "");

    if (!isPhotoTask || !staleGenericPrompt || messages.length !== 1 || messages[0]?.id !== "init") {
      return;
    }

    const profile = getProfile();
    const name = profile?.name || "campione";
    const safeInitial = taskContext?.description
      ? `Perfetto ${name}! Ho già il testo dell'attività${taskSubject ? ` di ${taskSubject}` : ""}. Partiamo da qui: "${taskContext.description}".`
      : `Perfetto ${name}! Ho già il compito${taskSubject ? ` di ${taskSubject}` : ""}. Lo guardo io e partiamo insieme.`;

    autoAnalyzeRef.current = true;
    setMessages([{ id: "init", role: "coach", text: safeInitial }]);
  }, [messages, taskContext, taskSubject]);

  // Persist messages to sessionStorage and notify parent
  useEffect(() => {
    if (sessionKey && messages.length > 0) {
      sessionStorage.setItem(
        `focus-chat-${sessionKey}`,
        JSON.stringify({ _version: CHAT_SESSION_VERSION, messages })
      );
    }
    onMessagesChange?.(messages);
  }, [messages, sessionKey, onMessagesChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, streamingText]);

  const streamCoachReply = async (allMessages: ChatMessage[]) => {
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
            weakConcepts: weakConcepts?.length ? weakConcepts : undefined,
            taskContext: taskContext ? {
              title: taskContext.title || taskTitle,
              subject: taskContext.subject || taskSubject,
              description: taskContext.description,
              sourceType: taskContext.sourceType,
              keyConcepts: taskContext.keyConcepts,
              microSteps: taskContext.microSteps,
              difficulty: taskContext.difficulty,
              sourceImageUrl: taskContext.sourceImageUrl,
              taskType: taskContext.taskType,
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
    const readingContext = `${taskTitle || ""} ${taskSubject || ""} ${taskContext?.title || ""} ${taskContext?.description || ""}`.toLowerCase();
    const isReadingComprehensionTask = /(comprension|comprendere|brano|testo|lettura|leggi e rispondi|rispondi alle domande|domande sul testo|racconto)/i.test(readingContext);

    if (isReadingComprehensionTask) {
      if (lower.match(/non capisco|difficile|non so|aiuto|non riesco/)) {
        return "Va bene, torniamo al brano. Chi o che cosa è al centro del testo?";
      }
      if (lower.match(/capito|compreso|ho capito|ho compreso/)) {
        return "Bene, controlliamo subito. Qual è il fatto più importante raccontato nel brano?";
      }
      return "Ti faccio una domanda sul testo: chi è il protagonista, oppure di che cosa parla il brano?";
    }

    if (lower.match(/non capisco|difficile|non so|aiuto|non riesco/))
      return "Respira un attimo. È normale sentirsi così. Facciamo solo un piccolo passo — qual è la prima cosa che vedi nell'esercizio?";
    if (lower.match(/bloccato|stuck/))
      return "Nessun problema! Rileggiamo insieme la consegna. Cosa ti chiede di fare esattamente?";
    if (lower.match(/indizio|hint|suggerimento/))
      return "Un piccolo indizio: guarda bene i dati che hai. Cosa noti? C'è qualcosa che già conosci?";
    if (lower.match(/capito|ho capito|fatto/))
      return "Fantastico! Spiegami con parole tue cosa hai capito. Così vediamo se ci siamo! 🌱";
    return "Partiamo da un passo preciso: cosa ti chiede esattamente la consegna?";
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || isTyping) return;

    const newMsg: ChatMessage = {
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
    const newMsg: ChatMessage = { id: `student-${Date.now()}`, role: "student", text: label };
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

      <div className={isInline ? "h-full flex flex-col px-0 pb-0" : "max-w-3xl mx-auto px-4 pb-4"}>
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
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-xl leading-relaxed ${
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
                        <div className="max-w-[85%] bg-sage-light/50 text-foreground rounded-2xl rounded-bl-md px-4 py-3 text-lg leading-relaxed">
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
                      {isMathSubject && (
                        <button
                          onClick={() => setNotepadOpen(true)}
                          disabled={isTyping}
                          className="h-8 px-2.5 rounded-lg bg-sage-light text-sage-dark hover:bg-accent hover:text-foreground flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-40 text-xs font-medium"
                          title="Blocco note per i calcoli"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">Calcoli</span>
                        </button>
                      )}
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
                        className={`flex-1 min-w-0 bg-muted/50 border rounded-xl px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-all ${isRecording ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
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

      {/* Math Notepad */}
      {isMathSubject && (
        <MathNotepad
          open={notepadOpen}
          onClose={() => setNotepadOpen(false)}
        />
      )}
    </motion.div>
  );
};
