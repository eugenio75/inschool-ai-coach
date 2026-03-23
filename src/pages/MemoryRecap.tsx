import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, RefreshCw, ChevronDown, ChevronUp, Sparkles, Loader2, Send, MessageCircle, X, BookOpen, Calendar, BarChart3, Layers, ThumbsDown, Minus as MinusIcon, ThumbsUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getMemoryItems, updateMemoryStrength, getDailyMissions, completeMission } from "@/lib/database";
import { subjectColors } from "@/lib/mockData";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// Helper: get Monday of the current week
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(d: Date): Date {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDate = new Date(d);
  itemDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / 86400000);
  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

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
        const strengthMatch = assistantText.match(/\[STRENGTH_UPDATE:\s*(\d+)\]/);
        if (strengthMatch) {
          const newStrength = Math.max(0, Math.min(100, parseInt(strengthMatch[1])));
          onStrengthUpdate(newStrength);
          assistantText = assistantText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "").trim();
        }
        setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
      }
    } catch (err) {
      console.error("Review error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Oops, c'è stato un problema. Riprova!" }]);
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
      <div className="flex items-center justify-between px-4 py-2.5 bg-sage-light/30 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Ripasso attivo</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

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

const RecapCard = ({ item, onUpdate, compact = false }: { item: any; onUpdate: (id: string, strength: number) => void; compact?: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const colors = subjectColors[item.subject] || subjectColors.Matematica;

  const handleStrengthUpdate = async (newStrength: number) => {
    await updateMemoryStrength(item.id, newStrength);
    onUpdate(item.id, newStrength);
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
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-start gap-3 p-4 text-left">
        {!compact && (
          <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
            <Brain className={`w-4 h-4 ${colors.text}`} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {compact && (
            <p className="text-[10px] text-muted-foreground mb-0.5">
              {formatDate(item.created_at)}
            </p>
          )}
          <h3 className="font-display font-semibold text-foreground text-sm">{item.concept}</h3>
          <div className="mt-1.5"><StrengthBar strength={item.strength || 0} /></div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">
              {item.summary && (
                <div className="bg-sage-light/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-sage-dark uppercase tracking-wider mb-1">Quello che hai studiato</p>
                  <p className="text-sm text-foreground leading-relaxed">{item.summary}</p>
                </div>
              )}

              {!reviewMode ? (
                <Button
                  onClick={() => setReviewMode(true)}
                  className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl"
                  size="sm"
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

// ============ SUBJECT TAB ============

const SubjectSection = ({ subject, items, onUpdate }: { subject: string; items: any[]; onUpdate: (id: string, strength: number) => void }) => {
  const colors = subjectColors[subject] || subjectColors.Matematica;

  // Group items by day (most recent first for display, but items within each day in chronological order)
  const dayGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    // Items are already sorted by created_at ascending from the DB
    const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    for (const item of sorted) {
      const dayKey = new Date(item.created_at).toISOString().split("T")[0];
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(item);
    }

    // Sort items within each day chronologically (oldest first)
    for (const key of Object.keys(groups)) {
      groups[key].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    // Return day keys sorted most recent first
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  const weakCount = items.filter(i => (i.strength || 0) < 50).length;

  return (
    <div className="space-y-4">
      {/* Subject stats */}
      <div className={`${colors.bg} rounded-2xl p-4 flex items-center gap-3`}>
        <div className={`w-10 h-10 rounded-xl bg-card/60 flex items-center justify-center`}>
          <Brain className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${colors.text}`}>{items.length} concett{items.length === 1 ? "o" : "i"}</p>
          {weakCount > 0 && (
            <p className="text-xs text-muted-foreground">{weakCount} da rafforzare</p>
          )}
        </div>
      </div>

      {/* Day groups */}
      {dayGroups.map(([dayKey, dayItems]) => (
        <div key={dayKey}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {getDayLabel(dayKey)}
            </span>
          </div>
          <div className="space-y-2">
            {dayItems.map((item: any, i: number) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.05 }}>
                <RecapCard item={item} onUpdate={onUpdate} compact />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============ WEEKLY SUMMARY ============

const WeeklySummary = ({ items, onUpdate }: { items: any[]; onUpdate: (id: string, strength: number) => void }) => {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = getSunday(now);

  const weekItems = useMemo(() => 
    items.filter(i => {
      const d = new Date(i.created_at);
      return d >= monday && d <= sunday;
    }),
    [items, monday.getTime(), sunday.getTime()]
  );

  const subjectGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of weekItems) {
      if (!groups[item.subject]) groups[item.subject] = [];
      groups[item.subject].push(item);
    }
    // Sort within each group chronologically
    for (const key of Object.keys(groups)) {
      groups[key].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [weekItems]);

  const weekLabel = `${monday.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;

  if (weekItems.length === 0) {
    return (
      <div className="text-center py-12 px-6">
        <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Nessun concetto studiato questa settimana.</p>
        <p className="text-muted-foreground text-xs mt-1">Completa delle sessioni di studio per vedere il riepilogo!</p>
      </div>
    );
  }

  const avgStrength = Math.round(weekItems.reduce((s, i) => s + (i.strength || 0), 0) / weekItems.length);

  return (
    <div className="space-y-5">
      {/* Week overview card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{weekLabel}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{weekItems.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Concetti</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{subjectGroups.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Materie</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{avgStrength}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Forza media</p>
          </div>
        </div>
      </div>

      {/* Per-subject breakdown */}
      {subjectGroups.map(([subject, subjectItems]) => {
        const colors = subjectColors[subject] || subjectColors.Matematica;
        const weakCount = subjectItems.filter((i: any) => (i.strength || 0) < 50).length;
        return (
          <div key={subject}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center`}>
                <BookOpen className={`w-3.5 h-3.5 ${colors.text}`} />
              </div>
              <h3 className={`font-display font-semibold text-sm ${colors.text}`}>{subject}</h3>
              <span className="text-xs text-muted-foreground">({subjectItems.length})</span>
              {weakCount > 0 && (
                <span className="text-[10px] bg-terracotta-light text-terracotta px-1.5 py-0.5 rounded-full font-medium ml-auto">
                  {weakCount} da rafforzare
                </span>
              )}
            </div>
            <div className="space-y-2">
              {subjectItems.map((item: any, i: number) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.05 }}>
                  <RecapCard item={item} onUpdate={onUpdate} compact />
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============ FLASHCARD TAB ============

const FlashcardTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sessionStats, setSessionStats] = useState({ correct: 0, almost: 0, wrong: 0 });
  const [sessionDone, setSessionDone] = useState(false);
  const [coachIntervention, setCoachIntervention] = useState<string | null>(null);

  useEffect(() => {
    loadCards();
  }, [user]);

  const loadCards = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", user.id)
      .order("is_flagged", { ascending: false })
      .order("next_review_at", { ascending: true, nullsFirst: true });
    
    // Prioritize: flagged first, then due for review, then unseen
    const sorted = (data || []).sort((a: any, b: any) => {
      if (a.is_flagged && !b.is_flagged) return -1;
      if (!a.is_flagged && b.is_flagged) return 1;
      const now = new Date().toISOString();
      const aDue = !a.next_review_at || a.next_review_at <= now;
      const bDue = !b.next_review_at || b.next_review_at <= now;
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return (a.times_shown || 0) - (b.times_shown || 0);
    });
    setCards(sorted);
    setLoading(false);
  };

  const filteredCards = useMemo(() => {
    if (subjectFilter === "all") return cards;
    return cards.filter(c => c.subject === subjectFilter);
  }, [cards, subjectFilter]);

  const subjects = useMemo(() => {
    const s = new Set(cards.map(c => c.subject));
    return Array.from(s).sort();
  }, [cards]);

  const currentCard = filteredCards[currentIndex];

  const handleRate = async (rating: "wrong" | "almost" | "correct") => {
    if (!currentCard || !user) return;
    setCoachIntervention(null);

    const updates: any = {
      times_shown: (currentCard.times_shown || 0) + 1,
      last_shown_at: new Date().toISOString(),
    };

    if (rating === "correct") {
      updates.times_correct = (currentCard.times_correct || 0) + 1;
      // SRS: next review in days based on streak
      const streak = (currentCard.times_correct || 0) + 1;
      const days = Math.min(streak * 2, 30);
      updates.next_review_at = new Date(Date.now() + days * 86400000).toISOString();
      updates.is_flagged = false;
      setSessionStats(s => ({ ...s, correct: s.correct + 1 }));
    } else if (rating === "wrong") {
      const newWrong = (currentCard.times_wrong || 0) + 1;
      updates.times_wrong = newWrong;
      updates.next_review_at = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      updates.is_flagged = newWrong >= 3;
      setSessionStats(s => ({ ...s, wrong: s.wrong + 1 }));
      if (newWrong >= 3) {
        setCoachIntervention(currentCard.subject);
      }
    } else {
      updates.next_review_at = new Date(Date.now() + 86400000).toISOString(); // 1 day
      setSessionStats(s => ({ ...s, almost: s.almost + 1 }));
    }

    await supabase.from("flashcards").update(updates).eq("id", currentCard.id);
    
    // Update local state
    setCards(prev => prev.map(c => c.id === currentCard.id ? { ...c, ...updates } : c));
    setFlipped(false);

    if (currentIndex < filteredCards.length - 1) {
      setTimeout(() => setCurrentIndex(i => i + 1), 200);
    } else {
      setSessionDone(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Nessuna flashcard ancora</p>
        <p className="text-muted-foreground text-sm mt-1">Completa sessioni di studio per generare carte automaticamente!</p>
      </div>
    );
  }

  if (sessionDone) {
    const total = sessionStats.correct + sessionStats.almost + sessionStats.wrong;
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
          {sessionStats.wrong > 0 && (
            <p className="text-sm text-muted-foreground mb-4">Le carte difficili sono state salvate per il prossimo ripasso</p>
          )}
          <button
            onClick={() => { setSessionDone(false); setCurrentIndex(0); setSessionStats({ correct: 0, almost: 0, wrong: 0 }); loadCards(); }}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm"
          >
            Ricomincia
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
      {/* Subject filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => { setSubjectFilter("all"); setCurrentIndex(0); setFlipped(false); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
            subjectFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Tutte ({cards.length})
        </button>
        {subjects.map(s => {
          const count = cards.filter(c => c.subject === s).length;
          return (
            <button
              key={s}
              onClick={() => { setSubjectFilter(s); setCurrentIndex(0); setFlipped(false); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                subjectFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{currentIndex + 1} / {filteredCards.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentIndex + 1) / filteredCards.length) * 100}%` }} />
        </div>
      </div>

      {/* Flashcard */}
      {currentCard && (
        <div className="perspective-1000">
          <motion.div
            className="relative w-full cursor-pointer"
            style={{ minHeight: 240 }}
            onClick={() => setFlipped(!flipped)}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Front */}
            <div
              className={`absolute inset-0 rounded-2xl border-2 p-6 flex flex-col justify-center items-center text-center backface-hidden ${
                currentCard.is_flagged ? "border-red-300 bg-red-50/50 dark:bg-red-900/10" : "border-primary/30 bg-card"
              } shadow-md`}
              style={{ backfaceVisibility: "hidden" }}
            >
              {currentCard.is_flagged && (
                <span className="absolute top-3 right-3 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Da rafforzare
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 font-semibold">{currentCard.subject}</span>
              <p className="font-display text-lg font-semibold text-foreground leading-snug">{currentCard.question}</p>
              <p className="text-xs text-muted-foreground mt-4">Tocca per girare</p>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 flex flex-col justify-center items-center text-center shadow-md"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <span className="text-[10px] uppercase tracking-wider text-primary mb-3 font-semibold">Risposta</span>
              <p className="text-base text-foreground leading-relaxed">{currentCard.answer}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Coach intervention */}
      <AnimatePresence>
        {coachIntervention && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4"
          >
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              Questo concetto ti crea difficoltà — vuoi che ci lavoriamo insieme?
            </p>
            <button
              onClick={() => navigate(`/challenge/new?subject=${encodeURIComponent(coachIntervention)}`)}
              className="mt-2 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
            >
              Apri sessione guidata
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating buttons */}
      {currentCard && flipped && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3"
        >
          <button
            onClick={() => handleRate("wrong")}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors"
          >
            <ThumbsDown className="w-5 h-5 text-red-500" />
            <span className="text-xs font-medium text-red-600">Non sapevo</span>
          </button>
          <button
            onClick={() => handleRate("almost")}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
          >
            <MinusIcon className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600">Quasi</span>
          </button>
          <button
            onClick={() => handleRate("correct")}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
          >
            <ThumbsUp className="w-5 h-5 text-green-500" />
            <span className="text-xs font-medium text-green-600">Lo sapevo</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

// ============ MAIN PAGE ============

type ViewMode = "subjects" | "weekly";
type MainTab = "ai" | "flashcard";

const MemoryRecap = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("subjects");
  const [mainTab, setMainTab] = useState<MainTab>("ai");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

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

  // Extract unique subjects
  const subjects = useMemo(() => {
    const subjectMap: Record<string, number> = {};
    for (const item of items) {
      subjectMap[item.subject] = (subjectMap[item.subject] || 0) + 1;
    }
    return Object.entries(subjectMap).sort(([, a], [, b]) => b - a);
  }, [items]);

  // Auto-select first subject
  useEffect(() => {
    if (subjects.length > 0 && !activeSubject) {
      setActiveSubject(subjects[0][0]);
    }
  }, [subjects, activeSubject]);

  const activeItems = useMemo(() =>
    items.filter(i => i.subject === activeSubject),
    [items, activeSubject]
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 pt-6 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Memoria e Ripasso</span>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">Quello che hai imparato</h1>
            <p className="text-muted-foreground text-sm">Organizzato per materia, giorno per giorno</p>
          </motion.div>

          {/* Main tab toggle: AI Chat vs Flashcard */}
          <div className="flex gap-1 mt-4 bg-muted/50 rounded-xl p-1">
            <button
              onClick={() => setMainTab("ai")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                mainTab === "ai"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" /> Chat AI
            </button>
            <button
              onClick={() => setMainTab("flashcard")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                mainTab === "flashcard"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Flashcard
            </button>
          </div>

          {/* View mode toggle (only for AI tab) */}
          {mainTab === "ai" && items.length > 0 && (
            <div className="flex gap-1 mt-2 bg-muted/30 rounded-xl p-1">
              <button
                onClick={() => setViewMode("subjects")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "subjects"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Per materia
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "weekly"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Riepilogo settimana
              </button>
            </div>
          )}
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
      ) : viewMode === "subjects" ? (
        <div className="max-w-3xl mx-auto">
          {/* Subject tabs - horizontal scroll */}
          <div className="px-6 pt-5 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {subjects.map(([subject, count]) => {
                const colors = subjectColors[subject] || subjectColors.Matematica;
                const isActive = subject === activeSubject;
                return (
                  <button
                    key={subject}
                    onClick={() => setActiveSubject(subject)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                      isActive
                        ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-primary/30`
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {subject}
                    <span className={`${isActive ? "bg-card/60" : "bg-muted"} px-1.5 py-0.5 rounded-full text-[10px]`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active subject content */}
          {activeSubject && (
            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSubject}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <SubjectSection
                    subject={activeSubject}
                    items={activeItems}
                    onUpdate={handleItemUpdate}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 pt-5 pb-6">
          <WeeklySummary items={items} onUpdate={handleItemUpdate} />
        </div>
      )}
    </div>
  );
};

export default MemoryRecap;
