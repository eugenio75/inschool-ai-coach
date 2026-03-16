import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, RefreshCw, ChevronDown, ChevronUp, Sparkles, Loader2, Send, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMemoryItems, updateMemoryStrength, getDailyMissions, completeMission } from "@/lib/database";
import { subjectColors } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const StrengthBar = ({ strength }: { strength: number }) => {
  const color = strength >= 70 ? "bg-primary" : strength >= 40 ? "bg-secondary" : "bg-terracotta";
  const label = strength >= 70 ? "Forte" : strength >= 40 ? "Da rivedere" : "Da rafforzare";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${strength}%` }} transition={spring} />
      </div>
      <span className="text-xs text-muted-foreground w-24 text-right">{label}</span>
    </div>
  );
};

interface ReviewMessage {
  role: "assistant" | "user";
  content: string;
}

const ReviewChat = ({ item, onStrengthUpdate, onClose }: {
  item: any;
  onStrengthUpdate: (newStrength: number) => void;
  onClose: () => void;
}) => {
  const [messages, setMessages] = useState<ReviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getProfile = () => {
    try {
      const saved = localStorage.getItem("inschool-profile");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  // Start review with initial question
  useEffect(() => {
    streamReply([]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, streamingText]);

  const streamReply = async (allMessages: ReviewMessage[]) => {
    setIsTyping(true);
    setStreamingText("");
    const profile = getProfile();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-memory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages,
            concept: item.concept,
            summary: item.summary,
            subject: item.subject,
            strength: item.strength,
            studentProfile: profile,
          }),
        }
      );

      if (!response.ok || !response.body) throw new Error("Errore");

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
        // Check for strength update tag
        const strengthMatch = assistantText.match(/\[STRENGTH_UPDATE:\s*(\d+)\]/);
        if (strengthMatch) {
          const newStrength = Math.max(0, Math.min(100, parseInt(strengthMatch[1])));
          onStrengthUpdate(newStrength);
          // Remove the tag from displayed text
          assistantText = assistantText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "").trim();
        }
        setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
      }
    } catch (err) {
      console.error("Review error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Oops, c'è stato un problema. Riprova! 🌱" }]);
    } finally {
      setIsTyping(false);
      setStreamingText("");
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;
    const updated = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(updated);
    setInput("");
    streamReply(updated);
  };

  return (
    <div className="mt-3 bg-muted/30 rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-sage-light/30 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Ripasso attivo</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-60 overflow-y-auto p-3 space-y-2.5">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              msg.role === "assistant"
                ? "bg-card text-foreground rounded-bl-md border border-border"
                : "bg-primary text-primary-foreground rounded-br-md"
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-card text-foreground rounded-2xl rounded-bl-md border border-border px-3.5 py-2 text-sm leading-relaxed">
              {streamingText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "")}
              <span className="inline-block w-1.5 h-4 bg-primary/40 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {isTyping && !streamingText && (
          <div className="flex justify-start">
            <div className="bg-card rounded-2xl rounded-bl-md border border-border px-4 py-3 flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Scrivi la tua risposta..."
          disabled={isTyping}
          className="flex-1 min-w-0 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
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
  );
};

const RecapCard = ({ item, onUpdate }: { item: any; onUpdate: (id: string, strength: number) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const colors = subjectColors[item.subject] || subjectColors.Matematica;

  const handleStrengthUpdate = async (newStrength: number) => {
    await updateMemoryStrength(item.id, newStrength);
    onUpdate(item.id, newStrength);
    // Auto-complete review missions
    try {
      const missions = await getDailyMissions();
      const reviewMission = missions.find((m: any) =>
        (m.mission_type === "review_concept" || m.mission_type === "review_weak_concept") && !m.completed
      );
      if (reviewMission) await completeMission(reviewMission.id, reviewMission.points_reward);
    } catch {}
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-start gap-4 p-5 text-left">
        <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Brain className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{item.subject}</span>
          </div>
          <h3 className="font-display font-semibold text-foreground">{item.concept}</h3>
          <div className="mt-2"><StrengthBar strength={item.strength || 0} /></div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4">
              {/* Summary - always visible */}
              {item.summary && (
                <div className="bg-sage-light/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-sage-dark uppercase tracking-wider mb-1">📖 Quello che hai studiato</p>
                  <p className="text-sm text-foreground leading-relaxed">{item.summary}</p>
                </div>
              )}

              {/* Review button or active review chat */}
              {!reviewMode ? (
                <Button
                  onClick={() => setReviewMode(true)}
                  className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> Ripassa con il Coach
                </Button>
              ) : (
                <ReviewChat
                  item={item}
                  onStrengthUpdate={handleStrengthUpdate}
                  onClose={() => setReviewMode(false)}
                />
              )}

              <p className="text-xs text-muted-foreground">
                Ultimo ripasso: {item.last_reviewed ? new Date(item.last_reviewed).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "mai"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MemoryRecap = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getMemoryItems();
      setItems(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleItemUpdate = (id: string, newStrength: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, strength: newStrength, last_reviewed: new Date().toISOString() } : item
    ));
  };

  const weak = items.filter(i => (i.strength || 0) < 50);
  const strong = items.filter(i => (i.strength || 0) >= 50);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border px-6 pt-6 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <span className="font-display text-lg font-semibold text-foreground">Memoria e Ripasso</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">Quello che hai imparato 🧠</h1>
            <p className="text-muted-foreground text-sm">Rileggi, ripassa e metti alla prova la tua memoria!</p>
          </motion.div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nessun concetto salvato ancora.</p>
          <p className="text-muted-foreground text-sm mt-1">Completa delle sessioni di studio per iniziare!</p>
        </div>
      ) : (
        <>
          {weak.length > 0 && (
            <div className="px-6 mt-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw className="w-4 h-4 text-terracotta" />
                  <h2 className="font-display font-semibold text-foreground">Da rafforzare</h2>
                  <span className="text-xs bg-terracotta-light text-terracotta px-2 py-0.5 rounded-full font-medium">{weak.length}</span>
                </div>
                <div className="space-y-3">
                  {weak.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.08 }}>
                      <RecapCard item={item} onUpdate={handleItemUpdate} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {strong.length > 0 && (
            <div className="px-6 mt-8">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-sage-dark" />
                  <h2 className="font-display font-semibold text-foreground">Concetti solidi</h2>
                </div>
                <div className="space-y-3">
                  {strong.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 + i * 0.08 }}>
                      <RecapCard item={item} onUpdate={handleItemUpdate} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MemoryRecap;
