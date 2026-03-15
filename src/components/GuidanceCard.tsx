import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ChevronUp, ChevronDown, Send } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

interface GuidanceCardProps {
  emotion: string;
  taskTitle?: string;
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

// Simulated coach responses based on context
const coachReplies: Record<string, string[]> = {
  stuck: [
    "Nessun problema! Rileggiamo insieme la consegna. Cosa ti chiede di fare esattamente?",
    "Facciamo un passo indietro. Qual è la prima cosa che noti nell'esercizio?",
    "Va bene, capita a tutti. Proviamo a scomporre il problema in pezzi più piccoli. Qual è il primo pezzo?",
  ],
  hint: [
    "Un piccolo indizio: guarda i numeri. Cosa hanno in comune?",
    "Prova a pensare: hai già visto qualcosa di simile in classe? Quando?",
    "Ecco un suggerimento: prova a rileggere l'ultima riga della consegna. Cosa ti dice di fare?",
  ],
  gotit: [
    "Fantastico! Spiegami con parole tue cosa hai capito. Così vediamo se ci siamo.",
    "Bravo! Adesso prova a fare il prossimo passo da solo. Se serve, ci sono.",
    "Ottimo lavoro! Riesci a pensare a un altro modo per arrivare alla stessa risposta?",
  ],
  // Simulated responses to free-text input
  generic: [
    "Interessante quello che dici! Prova a spiegarmelo con un esempio.",
    "Buona osservazione. E secondo te, perché funziona così?",
    "Ci sei quasi! Cosa succederebbe se provassimo a fare il contrario?",
    "Mi piace come stai ragionando. Qual è il prossimo passo secondo te?",
    "Ok, fermati un attimo. Rileggi quello che hai scritto: ha senso per te?",
    "Stai andando nella direzione giusta. Cosa ti manca per completare il ragionamento?",
    "Prova a pensarla così: se dovessi spiegarlo a un amico, cosa diresti?",
    "Bene! Adesso chiediti: come faccio a verificare se è giusto?",
  ],
  math: [
    "Ok, partiamo dal primo numero. Cosa sai fare con le frazioni?",
    "Ricordi la regola? Quando dividi una frazione, cosa fai con la seconda?",
    "Proviamo insieme: qual è il primo passaggio per risolvere questa operazione?",
    "Hai provato a disegnarlo? A volte vedere le frazioni aiuta tantissimo.",
  ],
  reading: [
    "Hai letto tutto il paragrafo? Qual è l'idea principale secondo te?",
    "Prova a sottolineare le parole che non conosci. Quante sono?",
    "Se dovessi riassumere in una frase sola, cosa diresti?",
    "C'è un personaggio o un concetto che ti ha colpito? Perché?",
  ],
};

function getCoachReply(input: string, replyCount: number): string {
  const lower = input.toLowerCase();
  
  // Check for math-related keywords
  if (lower.match(/frazion|numer|divid|moltiplic|sottraz|addizion|calcol|matemat|uguale/)) {
    const replies = coachReplies.math;
    return replies[replyCount % replies.length];
  }
  
  // Check for reading/comprehension keywords
  if (lower.match(/legg|pagin|paragraf|capito|testo|storia|parola|signific/)) {
    const replies = coachReplies.reading;
    return replies[replyCount % replies.length];
  }
  
  // Check for frustration/difficulty
  if (lower.match(/non capisco|difficile|non so|aiuto|non riesco|impossibile|odio/)) {
    return "Respira un attimo. È normale sentirsi così. Facciamo solo un piccolo passo — qual è la prima cosa che vedi nell'esercizio?";
  }
  
  // Check for "I think I know" / attempts
  if (lower.match(/penso|credo|forse|secondo me|provo|potrebbe essere/)) {
    return "Ottima idea! Prova e vediamo cosa succede. Non aver paura di sbagliare, è così che si impara.";
  }
  
  // Check for correct answer attempts
  if (lower.match(/è giusto|corretto|fatto|finito|risultato/)) {
    return "Bene! Adesso spiegami come ci sei arrivato. Qual è stato il tuo ragionamento?";
  }
  
  const replies = coachReplies.generic;
  return replies[replyCount % replies.length];
}

export const GuidanceCard = ({ emotion, taskTitle }: GuidanceCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [replyCount, setReplyCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial message based on emotion
  useEffect(() => {
    const initial = emotion === "frustrated" || emotion === "worried"
      ? "Capisco che può sembrare difficile. Facciamo il primo piccolo passo insieme — solo quello. Cosa dice la consegna?"
      : emotion === "tired"
      ? "Sei stanco, è normale. Facciamo solo un micro-passo, poi vediamo come va. Cosa devi fare in questo esercizio?"
      : `Perfetto, iniziamo! ${taskTitle ? `Stiamo lavorando su "${taskTitle}".` : ""} Leggi la consegna dell'esercizio. Cosa ti chiede di fare?`;
    
    setMessages([{ id: "init", role: "coach", text: initial }]);
  }, [emotion, taskTitle]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const addCoachReply = (text: string) => {
    setIsTyping(true);
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: `coach-${Date.now()}`, role: "coach", text }]);
      setIsTyping(false);
      setReplyCount((c) => c + 1);
    }, delay);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    setMessages((prev) => [...prev, { id: `student-${Date.now()}`, role: "student", text: trimmed }]);
    setInput("");
    addCoachReply(getCoachReply(trimmed, replyCount));
  };

  const handlePath = (pathId: string) => {
    const label = thinkingPaths.find((p) => p.id === pathId)?.label || "";
    setMessages((prev) => [...prev, { id: `student-${Date.now()}`, role: "student", text: label }]);
    const replies = coachReplies[pathId];
    addCoachReply(replies[replyCount % replies.length]);
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
              {!expanded && messages.length > 1 && (
                <span className="text-xs text-muted-foreground ml-1">
                  — {messages[messages.length - 1].text.slice(0, 40)}...
                </span>
              )}
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
                    className="max-h-48 overflow-y-auto space-y-3 mb-3 scroll-smooth"
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

                    {/* Typing indicator */}
                    {isTyping && (
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
