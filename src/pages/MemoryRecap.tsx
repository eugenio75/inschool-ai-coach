import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Brain, RefreshCw, Sparkles,
  Loader2, Send, MessageCircle, X, BookOpen,
  Layers, ThumbsDown, Minus as MinusIcon, ThumbsUp, AlertCircle,
  CalendarDays, Target, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMemoryItems, updateMemoryStrength, getDailyMissions, completeMission } from "@/lib/database";
import { subjectColors } from "@/lib/mockData";
import { isChildSession, getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// ─── Types ───
type Section = "ripasso" | "rinforza";
type ContentType = "today" | "cumulative" | "specific";
type StudyMethod = "coach" | "flashcard";
type Step = "home" | "subject-pick" | "summary" | "study";

interface WizardState {
  step: Step;
  section: Section | null;
  contentType: ContentType | null;
  subject: string | null;
  specificTopic: string | null;
  method: StudyMethod | null;
}

// ─── Helpers ───

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── ReviewChat (Coach chat) ───

interface ReviewMessage { role: "assistant" | "user"; content: string; }

const ReviewChat = ({ topic, subject, onClose }: {
  topic: string; subject: string; onClose: () => void;
}) => {
  const [messages, setMessages] = useState<ReviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { streamReply([]); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, isTyping, streamingText]);

  const streamReply = async (allMessages: ReviewMessage[]) => {
    setIsTyping(true);
    setStreamingText("");
    const profile = getProfile();
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ messages: allMessages, concept: topic, summary: "", subject, strength: 50, studentProfile: profile }),
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
            if (content) { assistantText += content; setStreamingText(assistantText); }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
      if (assistantText) {
        assistantText = assistantText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "").trim();
        setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
      }
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Oops, c'è stato un problema. Riprova!" }]); }
    finally { setIsTyping(false); setStreamingText(""); }
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
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{topic}</span>
          <span className="text-xs text-muted-foreground">· {subject}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "assistant" ? "bg-card text-foreground rounded-bl-md border border-border" : "bg-primary text-primary-foreground rounded-br-md"}`}>
              {msg.content}
            </div>
          </motion.div>
        ))}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-card text-foreground rounded-2xl rounded-bl-md border border-border px-4 py-2.5 text-sm leading-relaxed">
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
      <div className="p-3 border-t border-border bg-card flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Scrivi la tua risposta..." disabled={isTyping}
          className="flex-1 min-w-0 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button onClick={handleSend} disabled={!input.trim() || isTyping}
          className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Flashcard Session (inline) ───

const FlashcardSession = ({ cards: initialCards, subject, onClose }: {
  cards: any[]; subject: string; onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, almost: 0, wrong: 0 });
  const [sessionDone, setSessionDone] = useState(false);
  const [coachIntervention, setCoachIntervention] = useState<string | null>(null);

  const currentCard = cards[currentIndex];

  const handleRate = async (rating: "wrong" | "almost" | "correct") => {
    if (!currentCard || !user) return;
    setCoachIntervention(null);
    const updates: any = { times_shown: (currentCard.times_shown || 0) + 1, last_shown_at: new Date().toISOString() };
    if (rating === "correct") {
      updates.times_correct = (currentCard.times_correct || 0) + 1;
      const streak = (currentCard.times_correct || 0) + 1;
      updates.next_review_at = new Date(Date.now() + Math.min(streak * 2, 30) * 86400000).toISOString();
      updates.is_flagged = false;
      setSessionStats(s => ({ ...s, correct: s.correct + 1 }));
    } else if (rating === "wrong") {
      const newWrong = (currentCard.times_wrong || 0) + 1;
      updates.times_wrong = newWrong;
      updates.next_review_at = new Date(Date.now() + 3600000).toISOString();
      updates.is_flagged = newWrong >= 3;
      setSessionStats(s => ({ ...s, wrong: s.wrong + 1 }));
      if (newWrong >= 3) setCoachIntervention(currentCard.subject);
    } else {
      updates.next_review_at = new Date(Date.now() + 86400000).toISOString();
      setSessionStats(s => ({ ...s, almost: s.almost + 1 }));
    }
    await supabase.from("flashcards").update(updates).eq("id", currentCard.id);
    setCards(prev => prev.map(c => c.id === currentCard.id ? { ...c, ...updates } : c));
    setFlipped(false);
    if (currentIndex < cards.length - 1) setTimeout(() => setCurrentIndex(i => i + 1), 200);
    else setSessionDone(true);
  };

  if (sessionDone) {
    return (
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Sessione completata!</h2>
          <div className="grid grid-cols-3 gap-3 mt-6 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
              <p className="text-2xl font-bold text-green-600">{sessionStats.correct}</p>
              <p className="text-xs text-green-600/70">Corrette</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
              <p className="text-2xl font-bold text-amber-600">{sessionStats.almost}</p>
              <p className="text-xs text-amber-600/70">Quasi</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <p className="text-2xl font-bold text-red-600">{sessionStats.wrong}</p>
              <p className="text-xs text-red-600/70">Da ripassare</p>
            </div>
          </div>
          <button onClick={onClose} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm">
            Torna indietro
          </button>
        </motion.div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Nessuna flashcard disponibile</p>
        <p className="text-muted-foreground text-sm mt-1">Completa sessioni di studio per generare carte!</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium">Torna indietro</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-primary font-medium">
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        <span className="text-xs text-muted-foreground font-medium">{subject}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{currentIndex + 1} / {cards.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
        </div>
      </div>

      {currentCard && (
        <div className="perspective-1000">
          <motion.div className="relative w-full cursor-pointer" style={{ minHeight: 240 }} onClick={() => setFlipped(!flipped)}
            animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 25 }}>
            <div className={`absolute inset-0 rounded-2xl border-2 p-6 flex flex-col justify-center items-center text-center backface-hidden ${currentCard.is_flagged ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-card"} shadow-md`}
              style={{ backfaceVisibility: "hidden" }}>
              {currentCard.is_flagged && (
                <span className="absolute top-3 right-3 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Da rafforzare
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 font-semibold">{currentCard.subject}</span>
              <p className="font-display text-lg font-semibold text-foreground leading-snug">{currentCard.question}</p>
              <p className="text-xs text-muted-foreground mt-4">Tocca per girare</p>
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 flex flex-col justify-center items-center text-center shadow-md"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <span className="text-[10px] uppercase tracking-wider text-primary mb-3 font-semibold">Risposta</span>
              <p className="text-base text-foreground leading-relaxed">{currentCard.answer}</p>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {coachIntervention && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Questo concetto ti crea difficoltà — vuoi che ci lavoriamo insieme?</p>
            <button onClick={() => navigate(`/challenge/new?subject=${encodeURIComponent(coachIntervention)}`)}
              className="mt-2 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
              Apri sessione guidata
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {currentCard && flipped && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
          <button onClick={() => handleRate("wrong")}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors">
            <ThumbsDown className="w-5 h-5 text-destructive" /><span className="text-xs font-medium text-destructive">Non sapevo</span>
          </button>
          <button onClick={() => handleRate("almost")}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors">
            <MinusIcon className="w-5 h-5 text-amber-500" /><span className="text-xs font-medium text-amber-600">Quasi</span>
          </button>
          <button onClick={() => handleRate("correct")}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors">
            <ThumbsUp className="w-5 h-5 text-green-500" /><span className="text-xs font-medium text-green-600">Lo sapevo</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

// ─── Summary Card with expandable detail ───

const SummaryCard = ({ item, index, showStrength }: { item: any; index: number; showStrength: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const [deepSummary, setDeepSummary] = useState<string | null>(null);
  const [loadingDeep, setLoadingDeep] = useState(false);

  const fetchDeepSummary = async () => {
    if (deepSummary) { setExpanded(true); return; }
    setLoadingDeep(true);
    setExpanded(true);
    try {
      const profile = getProfile();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            messages: [],
            concept: item.concept,
            summary: item.summary || "",
            subject: item.subject,
            strength: item.strength || 50,
            studentProfile: profile,
            mode: "deep-summary",
          }),
        }
      );
      if (!response.ok || !response.body) throw new Error("Errore");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
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
            if (content) { fullText += content; setDeepSummary(fullText); }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
      if (fullText) setDeepSummary(fullText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "").trim());
    } catch {
      setDeepSummary("Non è stato possibile generare il riassunto. Riprova più tardi.");
    } finally {
      setLoadingDeep(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.03 }}
      className="bg-card rounded-xl border border-border p-3.5">
      <p className="text-sm font-semibold text-foreground">{item.concept}</p>
      {item.summary && (
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.summary}</p>
      )}
      {!item.summary && (
        <p className="text-sm text-muted-foreground mt-1.5 italic">Argomento studiato — espandi per un ripasso completo.</p>
      )}

      {/* Expanded deep summary */}
      <AnimatePresence>
        {expanded && deepSummary && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{deepSummary}</p>
          </motion.div>
        )}
      </AnimatePresence>
      {expanded && loadingDeep && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Genero un ripasso dettagliato...</span>
        </div>
      )}

      {/* Scopri di più button */}
      <button onClick={() => expanded ? setExpanded(false) : fetchDeepSummary()}
        className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
        {expanded ? "Chiudi" : "Scopri di più"}
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {showStrength && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${(item.strength || 0) < 30 ? "bg-destructive" : "bg-amber-500"}`}
              style={{ width: `${item.strength || 0}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{item.strength || 0}%</span>
        </div>
      )}
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// MAIN PAGE — Single Page Layout
// ═══════════════════════════════════════════

const MemoryRecap = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Section>("ripasso");
  const [wizard, setWizard] = useState<WizardState>({
    step: "home", section: null, contentType: null, subject: null, specificTopic: null, method: null,
  });
  const [specificInputRipasso, setSpecificInputRipasso] = useState("");
  const [specificInputRinforza, setSpecificInputRinforza] = useState("");
  const [autoNavigated, setAutoNavigated] = useState(false);

  // Load data
  useEffect(() => {
    const load = async () => {
      const memoryData = await getMemoryItems();
      setItems(memoryData);
      if (user) {
        const { data: fc } = await supabase.from("flashcards").select("*").eq("user_id", user.id)
          .order("next_review_at", { ascending: true, nullsFirst: true });
        setFlashcards(fc || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Auto-navigate from celebration: /memory?section=ripasso&content=today
  useEffect(() => {
    if (autoNavigated || loading) return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section") as Section | null;
    const content = params.get("content") as ContentType | null;
    if (section && content) {
      setActiveTab(section);
      setWizard({ step: "home", section, contentType: content, subject: null, specificTopic: null, method: null });
      setAutoNavigated(true);
    }
  }, [loading, autoNavigated]);


  const todayItems = useMemo(() => {
    const todayStart = getTodayStart();
    return items.filter(i => i.created_at >= todayStart).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [items]);

  const weakItems = useMemo(() =>
    items.filter(i => (i.strength || 0) < 50).sort((a, b) => (a.strength || 0) - (b.strength || 0)),
    [items]
  );

  // Get relevant items based on section + content type
  const getRelevantItems = (section: Section, contentType: ContentType): any[] => {
    if (section === "ripasso") {
      if (contentType === "today") return todayItems;
      if (contentType === "cumulative") return items;
      return [];
    }
    if (section === "rinforza") {
      if (contentType === "today") return weakItems.filter(i => i.created_at >= getTodayStart());
      if (contentType === "cumulative") return weakItems;
      return [];
    }
    return [];
  };

  const relevantSubjects = useMemo(() => {
    if (!wizard.section || !wizard.contentType || wizard.contentType === "specific") return [];
    const relevant = getRelevantItems(wizard.section, wizard.contentType);
    const subjectMap: Record<string, number> = {};
    for (const item of relevant) {
      const s = item.subject || "Altro";
      subjectMap[s] = (subjectMap[s] || 0) + 1;
    }
    return Object.entries(subjectMap).sort(([, a], [, b]) => b - a);
  }, [wizard.section, wizard.contentType, items, weakItems, todayItems]);

  // Get flashcards filtered
  const getFilteredFlashcards = (): any[] => {
    if (wizard.specificTopic) {
      const topic = wizard.specificTopic.toLowerCase();
      return flashcards.filter(c =>
        c.subject?.toLowerCase().includes(topic) ||
        c.question?.toLowerCase().includes(topic) ||
        c.answer?.toLowerCase().includes(topic)
      );
    }
    if (wizard.subject) {
      return flashcards.filter(c => c.subject === wizard.subject);
    }
    if (wizard.contentType === "today") {
      const todayStart = getTodayStart();
      return flashcards.filter(c => c.created_at >= todayStart);
    }
    return flashcards;
  };

  // Navigation
  const goBack = () => {
    if (wizard.step === "study") setWizard(w => ({ ...w, step: "summary", method: null }));
    else if (wizard.step === "summary") {
      if (wizard.contentType === "specific") setWizard(w => ({ ...w, step: "home", section: null, contentType: null, specificTopic: null, subject: null }));
      else setWizard(w => ({ ...w, step: "subject-pick", subject: null }));
    }
    else if (wizard.step === "subject-pick") setWizard(w => ({ ...w, step: "home", section: null, contentType: null }));
    else navigate("/dashboard");
  };

  const pickOption = (section: Section, contentType: ContentType) => {
    if (contentType === "specific") return; // handled by submit
    setWizard({ step: "subject-pick", section, contentType, subject: null, specificTopic: null, method: null });
  };

  const submitSpecific = (section: Section, topic: string) => {
    if (!topic.trim()) return;
    setWizard({ step: "summary", section, contentType: "specific", subject: topic.trim(), specificTopic: topic.trim(), method: null });
  };

  const selectSubject = (subject: string) => {
    setWizard(w => ({ ...w, step: "summary", subject }));
  };

  const selectMethod = (method: StudyMethod) => {
    if (method === "flashcard" && wizard.specificTopic) {
      navigate(`/flashcards?mode=topic&topic=${encodeURIComponent(wizard.specificTopic)}`);
      return;
    }
    setWizard(w => ({ ...w, step: "study", method }));
  };

  // Header
  const getSubtitle = (): string => {
    if (wizard.step === "home") return "Scegli cosa vuoi ripassare e fallo nel modo più adatto a te.";
    if (wizard.step === "subject-pick") {
      const label = wizard.section === "ripasso" ? "Ripasso" : "Rafforza";
      const ct = wizard.contentType === "today" ? "Di oggi" : "Cumulativo";
      return `${label} · ${ct}`;
    }
    if (wizard.step === "summary") return "Ecco cosa hai studiato";
    return "";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Section block builder ───
  const renderSectionBlock = (section: Section) => {
    const isRipasso = section === "ripasso";
    const specificInput = isRipasso ? specificInputRipasso : specificInputRinforza;
    const setSpecificInput = isRipasso ? setSpecificInputRipasso : setSpecificInputRinforza;

    return (
      <div className="space-y-2.5">

        {/* Option: Today */}
        <button onClick={() => pickOption(section, "today")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
          <CalendarDays className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium text-foreground flex-1">Quello che hai studiato oggi</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        {/* Option: Cumulative */}
        <button onClick={() => pickOption(section, "cumulative")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
          <Brain className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium text-foreground flex-1">Ripasso cumulativo</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        {/* Option: Specific topic */}
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Argomento specifico</span>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Input
              value={specificInput}
              onChange={e => setSpecificInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitSpecific(section, specificInput); }}
              placeholder="Es: frazioni, rivoluzione francese..."
              className="text-sm"
            />
            <Button onClick={() => submitSpecific(section, specificInput)} disabled={!specificInput.trim()} size="sm" className="shrink-0 px-4">
              Vai
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-foreground">Ripassa e Rafforza</h1>
          </div>
          {wizard.step !== "study" && (
            <p className="text-sm text-muted-foreground ml-8 mb-3">{getSubtitle()}</p>
          )}
          {/* Tab menu — only on home */}
          {wizard.step === "home" && (
            <div className="flex ml-8 gap-1">
              {(["ripasso", "rinforza"] as Section[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors relative ${
                    activeTab === tab
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {tab === "ripasso" ? "Ripasso" : "Rafforza"}
                  {activeTab === tab && (
                    <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 pt-5">
        <AnimatePresence mode="wait">

          {/* ═══ HOME: Both sections on one page ═══ */}
          {wizard.step === "home" && (
            <motion.div key={`home-${activeTab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-2.5 pt-1">
              {renderSectionBlock(activeTab)}
            </motion.div>
          )}

          {/* ═══ SUBJECT PICK ═══ */}
          {wizard.step === "subject-pick" && (
            <motion.div key="subject-pick" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scegli la materia</p>
              {relevantSubjects.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {wizard.contentType === "today" ? "Nessun contenuto studiato oggi" : "Nessun contenuto disponibile"}
                  </p>
                  <button onClick={goBack} className="mt-3 text-sm text-primary font-medium">Torna indietro</button>
                </div>
              ) : (
                <>
                  {wizard.contentType === "cumulative" && (
                    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring }}
                      onClick={() => selectSubject("all")}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground flex-1">Tutte le materie</p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </motion.button>
                  )}
                  {relevantSubjects.map(([subject, count], i) => {
                    const colors = subjectColors[subject] || subjectColors.Matematica;
                    return (
                      <motion.button key={subject} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring, delay: (i + 1) * 0.04 }}
                        onClick={() => selectSubject(subject)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                        <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                          <BookOpen className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <p className="text-sm font-semibold text-foreground flex-1">{subject}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{count}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </motion.button>
                    );
                  })}
                </>
              )}
            </motion.div>
          )}

          {/* ═══ SUMMARY ═══ */}
          {wizard.step === "summary" && (
            <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {wizard.subject === "all" ? "Tutte le materie" : wizard.subject}
                </p>
              </div>

              {(() => {
                let summaryItems = wizard.specificTopic
                  ? items.filter(i => i.concept?.toLowerCase().includes(wizard.specificTopic!.toLowerCase()) || i.subject?.toLowerCase().includes(wizard.specificTopic!.toLowerCase()))
                  : wizard.section === "rinforza"
                    ? (wizard.contentType === "today"
                        ? weakItems.filter(i => i.created_at >= getTodayStart() && (wizard.subject === "all" || i.subject === wizard.subject))
                        : weakItems.filter(i => wizard.subject === "all" || i.subject === wizard.subject))
                    : (wizard.contentType === "today"
                        ? todayItems.filter(i => wizard.subject === "all" || i.subject === wizard.subject)
                        : items.filter(i => wizard.subject === "all" || i.subject === wizard.subject));

                // Sort newest first
                summaryItems = [...summaryItems].sort((a, b) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                if (summaryItems.length === 0) {
                  return (
                    <div className="text-center py-10 px-6">
                      <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground font-medium">Nessun contenuto trovato</p>
                      <p className="text-xs text-muted-foreground mt-1">Prova con un'altra selezione</p>
                    </div>
                  );
                }

                // Group items by subject + time proximity (within 10 minutes = same exercise)
                const exerciseGroups: { subject: string; items: any[]; latestAt: Date }[] = [];
                for (const item of summaryItems) {
                  const itemTime = new Date(item.created_at).getTime();
                  const existing = exerciseGroups.find(g => 
                    g.subject === (item.subject || "Altro") && 
                    Math.abs(g.latestAt.getTime() - itemTime) < 10 * 60 * 1000
                  );
                  if (existing) {
                    existing.items.push(item);
                    if (itemTime > existing.latestAt.getTime()) existing.latestAt = new Date(item.created_at);
                  } else {
                    exerciseGroups.push({
                      subject: item.subject || "Altro",
                      items: [item],
                      latestAt: new Date(item.created_at),
                    });
                  }
                }

                // Sort groups newest first
                exerciseGroups.sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());

                return (
                  <div className="space-y-3">
                    {exerciseGroups.map((group, gi) => {
                      const colors = subjectColors[group.subject] || subjectColors.Matematica;
                      const timeLabel = new Date(group.latestAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      const showStrength = wizard.section === "rinforza";

                      return (
                        <motion.div
                          key={`${group.subject}-${gi}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring, delay: gi * 0.05 }}
                          className="rounded-2xl border border-border bg-card overflow-hidden"
                        >
                          {/* Exercise card header */}
                          <div className={`flex items-center gap-3 px-4 py-3 ${colors.bg || "bg-muted/30"} border-b border-border/50`}>
                            <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                              <BookOpen className={`w-4 h-4 ${colors.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{group.subject}</p>
                              <p className="text-[11px] text-muted-foreground">{group.items.length} concett{group.items.length === 1 ? "o" : "i"} · {timeLabel}</p>
                            </div>
                          </div>

                          {/* Concepts inside */}
                          <div className="px-4 py-3 space-y-3">
                            {group.items.map((item: any, i: number) => (
                              <div key={item.id} className={i > 0 ? "pt-3 border-t border-border/40" : ""}>
                                <p className="text-sm font-medium text-foreground">{item.concept}</p>
                                {item.summary && (
                                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.summary}</p>
                                )}
                                {!item.summary && (
                                  <p className="text-sm text-muted-foreground mt-1 italic">Argomento studiato</p>
                                )}
                                {showStrength && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${(item.strength || 0) < 30 ? "bg-destructive" : (item.strength || 0) < 60 ? "bg-amber-500" : "bg-primary"}`}
                                        style={{ width: `${item.strength || 0}%` }} />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{item.strength || 0}%</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* CTA buttons */}
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Come vuoi ripassare?</p>
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
                  onClick={() => selectMethod("coach")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground flex-1">Ripassa con il Coach</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>

                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.16 }}
                  onClick={() => selectMethod("flashcard")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                  <div className="w-11 h-11 rounded-xl bg-secondary/30 text-secondary-foreground flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground flex-1">Usa le Flashcard</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ STUDY ═══ */}
          {wizard.step === "study" && (
            <motion.div key="study" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {wizard.method === "coach" ? (
                <ReviewChat
                  topic={wizard.specificTopic || wizard.subject || "Ripasso generale"}
                  subject={wizard.subject === "all" ? "Generale" : (wizard.subject || "Generale")}
                  onClose={goBack}
                />
              ) : (
                <FlashcardSession
                  cards={getFilteredFlashcards()}
                  subject={wizard.subject === "all" ? "Tutte le materie" : (wizard.subject || "")}
                  onClose={goBack}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default MemoryRecap;
