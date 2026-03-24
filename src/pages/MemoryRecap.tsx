import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Brain, RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Loader2, Send, MessageCircle, X, BookOpen, Calendar, BarChart3,
  Layers, ThumbsDown, Minus as MinusIcon, ThumbsUp, AlertCircle,
  AlertTriangle, CalendarDays, GraduationCap, Target, ChevronRight,
} from "lucide-react";
import { LearningErrorsTab } from "@/components/LearningErrorsTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMemoryItems, updateMemoryStrength, getDailyMissions, completeMission } from "@/lib/database";
import { subjectColors } from "@/lib/mockData";
import { isChildSession, getChildSession } from "@/lib/childSession";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// ─── Types ───
type Section = "ripasso" | "rinforza" | "errori";
type ContentType = "today" | "cumulative" | "specific";
type StudyMethod = "coach" | "flashcard";

interface WizardState {
  step: "section" | "content" | "subject-pick" | "summary" | "method" | "study";
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
            <div className={`absolute inset-0 rounded-2xl border-2 p-6 flex flex-col justify-center items-center text-center backface-hidden ${currentCard.is_flagged ? "border-red-300 bg-red-50/50 dark:bg-red-900/10" : "border-primary/30 bg-card"} shadow-md`}
              style={{ backfaceVisibility: "hidden" }}>
              {currentCard.is_flagged && (
                <span className="absolute top-3 right-3 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
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
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors">
            <ThumbsDown className="w-5 h-5 text-red-500" /><span className="text-xs font-medium text-red-600">Non sapevo</span>
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

// ═══════════════════════════════════════════
// MAIN PAGE — Wizard Flow
// ═══════════════════════════════════════════

const MemoryRecap = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState<WizardState>({
    step: "section", section: null, contentType: null, subject: null, specificTopic: null, method: null,
  });
  const [specificInput, setSpecificInput] = useState("");

  // Load data
  useEffect(() => {
    const load = async () => {
      const memoryData = await getMemoryItems();
      setItems(memoryData);

      if (user) {
        const { data: fc } = await supabase.from("flashcards").select("*").eq("user_id", user.id)
          .order("next_review_at", { ascending: true, nullsFirst: true });
        setFlashcards(fc || []);

        const { data: le } = await supabase.from("learning_errors").select("*").eq("user_id", user.id)
          .eq("resolved", false).order("created_at", { ascending: false }).limit(100);
        setErrors(le || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Derived data
  const todayItems = useMemo(() => {
    const todayStart = getTodayStart();
    return items.filter(i => i.created_at >= todayStart);
  }, [items]);

  const weakItems = useMemo(() =>
    items.filter(i => (i.strength || 0) < 50).sort((a, b) => (a.strength || 0) - (b.strength || 0)),
    [items]
  );

  const todayErrors = useMemo(() => {
    const todayStart = getTodayStart();
    return errors.filter(e => e.created_at >= todayStart);
  }, [errors]);

  // Get subjects for the current section + content type
  const getRelevantItems = (): any[] => {
    if (wizard.section === "ripasso") {
      if (wizard.contentType === "today") return todayItems;
      if (wizard.contentType === "cumulative") return items;
      return [];
    }
    if (wizard.section === "rinforza") {
      if (wizard.contentType === "today") return weakItems.filter(i => i.created_at >= getTodayStart());
      if (wizard.contentType === "cumulative") return weakItems;
      return [];
    }
    if (wizard.section === "errori") {
      if (wizard.contentType === "today") return todayErrors;
      if (wizard.contentType === "cumulative") return errors;
      return [];
    }
    return [];
  };

  const relevantSubjects = useMemo(() => {
    const relevant = getRelevantItems();
    const subjectMap: Record<string, number> = {};
    for (const item of relevant) {
      const s = item.subject || "Altro";
      subjectMap[s] = (subjectMap[s] || 0) + 1;
    }
    return Object.entries(subjectMap).sort(([, a], [, b]) => b - a);
  }, [wizard.section, wizard.contentType, items, weakItems, errors, todayItems, todayErrors]);

  // Get flashcards filtered by the wizard context
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

  // Navigation helpers
  const goBack = () => {
    if (wizard.step === "study") setWizard(w => ({ ...w, step: "method", method: null }));
    else if (wizard.step === "method") setWizard(w => ({ ...w, step: "summary" }));
    else if (wizard.step === "summary") {
      if (wizard.contentType === "specific") setWizard(w => ({ ...w, step: "content", specificTopic: null, subject: null }));
      else setWizard(w => ({ ...w, step: "subject-pick", subject: null }));
    }
    else if (wizard.step === "subject-pick") setWizard(w => ({ ...w, step: "content", contentType: null }));
    else if (wizard.step === "content") setWizard(w => ({ ...w, step: "section", section: null }));
    else navigate("/dashboard");
  };

  const selectSection = (section: Section) => {
    setWizard({ step: "content", section, contentType: null, subject: null, specificTopic: null, method: null });
  };

  const selectContentType = (ct: ContentType) => {
    if (ct === "specific") {
      setWizard(w => ({ ...w, step: "content", contentType: ct }));
    } else {
      setWizard(w => ({ ...w, step: "subject-pick", contentType: ct, specificTopic: null }));
    }
  };

  const selectSubject = (subject: string) => {
    setWizard(w => ({ ...w, step: "summary", subject }));
  };

  const submitSpecificTopic = () => {
    const trimmed = specificInput.trim();
    if (!trimmed) return;
    setWizard(w => ({ ...w, step: "summary", contentType: "specific", specificTopic: trimmed, subject: trimmed }));
  };

  const selectMethod = (method: StudyMethod) => {
    if (method === "flashcard" && wizard.specificTopic) {
      // For specific topic, navigate to flashcard generation
      navigate(`/flashcards?mode=topic&topic=${encodeURIComponent(wizard.specificTopic)}`);
      return;
    }
    setWizard(w => ({ ...w, step: "study", method }));
  };

  // ─── Section labels & styles ───
  const sectionConfig: Record<Section, { label: string; description: string; icon: any; color: string }> = {
    ripasso: { label: "Ripasso", description: "Rivedi quello che hai già studiato", icon: RefreshCw, color: "bg-primary/10 text-primary" },
    rinforza: { label: "Concetti da rinforzare", description: "Rafforza gli argomenti dove hai più bisogno", icon: Target, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
    errori: { label: "Errori", description: "Trasforma gli errori in punti di forza", icon: AlertTriangle, color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  };

  // Header text
  const getHeaderText = (): string => {
    if (wizard.step === "section") return "Scegli cosa vuoi ripassare e fallo nel modo più adatto a te.";
    if (wizard.step === "content") return sectionConfig[wizard.section!].label;
    if (wizard.step === "subject-pick") return `${sectionConfig[wizard.section!].label} · ${wizard.contentType === "today" ? "Di oggi" : "Cumulativo"}`;
    if (wizard.step === "method") return `Come vuoi ripassare?`;
    return "";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-foreground">Ripassa e Rafforza</h1>
          </div>
          {wizard.step !== "study" && (
            <p className="text-sm text-muted-foreground ml-8">{getHeaderText()}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 pt-5">
        <AnimatePresence mode="wait">

          {/* ═══ STEP 1: Choose Section ═══ */}
          {wizard.step === "section" && (
            <motion.div key="section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-3">
              {(["ripasso", "rinforza", "errori"] as Section[]).map((section, i) => {
                const cfg = sectionConfig[section];
                const Icon = cfg.icon;
                // Show count badge
                let count = 0;
                if (section === "ripasso") count = items.length;
                if (section === "rinforza") count = weakItems.length;
                if (section === "errori") count = errors.length;

                return (
                  <motion.button key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.06 }}
                    onClick={() => selectSection(section)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                    <div className={`w-11 h-11 rounded-xl ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {count > 0 && (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* ═══ STEP 2: Choose Content Type ═══ */}
          {wizard.step === "content" && (
            <motion.div key="content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-3">
              {/* Today */}
              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0 }}
                onClick={() => selectContentType("today")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Quello che hai studiato oggi</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.button>

              {/* Cumulative */}
              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 }}
                onClick={() => selectContentType("cumulative")}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                <div className="w-11 h-11 rounded-xl bg-secondary/30 text-secondary-foreground flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Ripasso cumulativo</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.button>

              {/* Specific topic — inline input */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }}
                className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-accent/50 text-accent-foreground flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Argomento specifico</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={specificInput}
                    onChange={e => setSpecificInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitSpecificTopic()}
                    placeholder="Es: frazioni, rivoluzione francese..."
                    className="text-sm"
                  />
                  <Button onClick={submitSpecificTopic} disabled={!specificInput.trim()} size="sm" className="shrink-0 px-4">
                    Vai
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ STEP 2.5: Choose Subject ═══ */}
          {wizard.step === "subject-pick" && (
            <motion.div key="subject-pick" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scegli la materia</p>
              {relevantSubjects.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">
                    {wizard.contentType === "today"
                      ? "Nessun contenuto studiato oggi"
                      : "Nessun contenuto disponibile"}
                  </p>
                  <button onClick={goBack} className="mt-3 text-sm text-primary font-medium">Torna indietro</button>
                </div>
              ) : (
                <>
                  {/* "All subjects" option — only for cumulative */}
                  {wizard.contentType === "cumulative" && (
                    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring }}
                      onClick={() => selectSubject("all")}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Tutte le materie</p>
                      </div>
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
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{subject}</p>
                        </div>
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

          {/* ═══ STEP 3: Choose Method ═══ */}
          {wizard.step === "method" && (
            <motion.div key="method" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {wizard.subject === "all" ? "Tutte le materie" : wizard.subject}
              </p>

              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring }}
                onClick={() => selectMethod("coach")}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-foreground">Ripassa con il Coach</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Il coach ti guida con domande e ti aiuta a ricordare</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.button>

              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.06 }}
                onClick={() => selectMethod("flashcard")}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
                <div className="w-12 h-12 rounded-xl bg-secondary/30 text-secondary-foreground flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-foreground">Usa le Flashcard</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Carte rapide per memorizzare e ripassare velocemente</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.button>
            </motion.div>
          )}

          {/* ═══ STEP 4: Study ═══ */}
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
