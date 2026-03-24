import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Brain, RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Loader2, Send, MessageCircle, X, BookOpen, Calendar, BarChart3,
  Layers, ThumbsDown, Minus as MinusIcon, ThumbsUp, AlertCircle,
  AlertTriangle, CalendarDays, GraduationCap, TrendingUp, Flame,
  Target, ChevronRight,
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

// ─── Helpers ───

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

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function getPrepLabel(schoolLevel: string) {
  switch (schoolLevel) {
    case "alunno": case "medie": return "Prepara l'interrogazione";
    case "universitario": return "Prepara l'esame";
    default: return "Prepara la verifica";
  }
}

// ─── StrengthBar ───

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

// ─── ReviewChat ───

interface ReviewMessage { role: "assistant" | "user"; content: string; }

const ReviewChat = ({ item, onStrengthUpdate, onClose }: {
  item: any; onStrengthUpdate: (n: number) => void; onClose: () => void;
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
          body: JSON.stringify({ messages: allMessages, concept: item.concept, summary: item.summary, subject: item.subject, strength: item.strength, studentProfile: profile }),
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
        const strengthMatch = assistantText.match(/\[STRENGTH_UPDATE:\s*(\d+)\]/);
        if (strengthMatch) {
          onStrengthUpdate(Math.max(0, Math.min(100, parseInt(strengthMatch[1]))));
          assistantText = assistantText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "").trim();
        }
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
    <div className="mt-3 bg-muted/30 rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-sage-light/30 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Ripasso attivo</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div ref={scrollRef} className="max-h-60 overflow-y-auto p-3 space-y-2.5">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${msg.role === "assistant" ? "bg-card text-foreground rounded-bl-md border border-border" : "bg-primary text-primary-foreground rounded-br-md"}`}>
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
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Scrivi la tua risposta..." disabled={isTyping}
          className="flex-1 min-w-0 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button onClick={handleSend} disabled={!input.trim() || isTyping}
          className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── RecapCard ───

const RecapCard = ({ item, onUpdate, compact = false }: { item: any; onUpdate: (id: string, s: number) => void; compact?: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const colors = subjectColors[item.subject] || subjectColors.Matematica;

  const handleStrengthUpdate = async (newStrength: number) => {
    await updateMemoryStrength(item.id, newStrength);
    onUpdate(item.id, newStrength);
    try {
      const missions = await getDailyMissions();
      const reviewMission = missions.find((m: any) => (m.mission_type === "review_concept" || m.mission_type === "review_weak_concept") && !m.completed);
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
          {compact && <p className="text-[10px] text-muted-foreground mb-0.5">{formatDate(item.created_at)}</p>}
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
                <Button onClick={() => setReviewMode(true)} className="w-full bg-primary text-primary-foreground hover:bg-sage-dark rounded-xl" size="sm">
                  <MessageCircle className="w-4 h-4 mr-2" /> Ripassa con il Coach
                </Button>
              ) : (
                <ReviewChat item={item} onStrengthUpdate={handleStrengthUpdate} onClose={() => setReviewMode(false)} />
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

// ═══════════════════════════════════════════
// SECTION: Weekly Summary
// ═══════════════════════════════════════════

const WeeklySummaryCard = ({ items, focusSessions }: { items: any[]; focusSessions: number }) => {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = getSunday(now);

  const weekItems = useMemo(() =>
    items.filter(i => { const d = new Date(i.created_at); return d >= monday && d <= sunday; }),
    [items, monday.getTime(), sunday.getTime()]
  );

  const weekReviewed = useMemo(() =>
    items.filter(i => {
      if (!i.last_reviewed) return false;
      const d = new Date(i.last_reviewed);
      return d >= monday && d <= sunday;
    }),
    [items, monday.getTime(), sunday.getTime()]
  );

  const avgStrength = items.length > 0 ? Math.round(items.reduce((s, i) => s + (i.strength || 0), 0) / items.length) : 0;
  const weekLabel = `${monday.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}
      className="bg-card rounded-2xl border border-border p-4 shadow-soft">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{weekLabel}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-muted/50 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-foreground">{weekItems.length}</p>
          <p className="text-[10px] text-muted-foreground">Nuovi concetti</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-foreground">{weekReviewed.length}</p>
          <p className="text-[10px] text-muted-foreground">Ripassati</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-foreground">{focusSessions}</p>
          <p className="text-[10px] text-muted-foreground">Sessioni</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-foreground">{avgStrength}%</p>
          <p className="text-[10px] text-muted-foreground">Forza media</p>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// SECTION: Weak Concepts
// ═══════════════════════════════════════════

const WeakConceptsSection = ({ items, onUpdate }: { items: any[]; onUpdate: (id: string, s: number) => void }) => {
  const weakItems = useMemo(() =>
    items.filter(i => (i.strength || 0) < 50).sort((a, b) => (a.strength || 0) - (b.strength || 0)),
    [items]
  );
  const [showAll, setShowAll] = useState(false);

  if (weakItems.length === 0) return null;

  const displayed = showAll ? weakItems : weakItems.slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-terracotta" />
        <h3 className="font-display font-semibold text-sm text-foreground">Concetti da rafforzare</h3>
        <span className="text-xs bg-terracotta-light text-terracotta px-2 py-0.5 rounded-full font-medium">{weakItems.length}</span>
      </div>
      <div className="space-y-2">
        {displayed.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.04 }}>
            <RecapCard item={item} onUpdate={onUpdate} />
          </motion.div>
        ))}
      </div>
      {weakItems.length > 3 && (
        <button onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-primary font-medium hover:underline">
          {showAll ? "Mostra meno" : `Vedi tutti (${weakItems.length})`}
        </button>
      )}
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// SECTION: Subjects Overview
// ═══════════════════════════════════════════

const SubjectsOverview = ({ items, onSelect }: { items: any[]; onSelect: (subject: string) => void }) => {
  const subjects = useMemo(() => {
    const map: Record<string, { count: number; weak: number; avgStrength: number }> = {};
    for (const item of items) {
      if (!map[item.subject]) map[item.subject] = { count: 0, weak: 0, avgStrength: 0 };
      map[item.subject].count++;
      if ((item.strength || 0) < 50) map[item.subject].weak++;
      map[item.subject].avgStrength += (item.strength || 0);
    }
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data, avgStrength: Math.round(data.avgStrength / data.count) }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  if (subjects.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-sm text-foreground">Per materia</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {subjects.map((s) => {
          const colors = subjectColors[s.name] || subjectColors.Matematica;
          return (
            <button key={s.name} onClick={() => onSelect(s.name)}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
              <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                <BookOpen className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{s.count} concetti</span>
                  {s.weak > 0 && <span className="text-[10px] text-terracotta font-medium">{s.weak} deboli</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// SECTION: Subject Detail View
// ═══════════════════════════════════════════

const SubjectDetail = ({ subject, items, onUpdate, onBack }: {
  subject: string; items: any[]; onUpdate: (id: string, s: number) => void; onBack: () => void;
}) => {
  const colors = subjectColors[subject] || subjectColors.Matematica;
  const dayGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const item of sorted) {
      const dayKey = new Date(item.created_at).toISOString().split("T")[0];
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(item);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  const weakCount = items.filter(i => (i.strength || 0) < 50).length;
  const avgStrength = Math.round(items.reduce((s, i) => s + (i.strength || 0), 0) / items.length);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
        <ArrowLeft className="w-4 h-4" /> Tutte le materie
      </button>
      <div className={`${colors.bg} rounded-2xl p-4 flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-card/60 flex items-center justify-center">
          <Brain className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1">
          <p className={`text-base font-bold ${colors.text}`}>{subject}</p>
          <p className="text-xs text-muted-foreground">{items.length} concetti · forza media {avgStrength}%</p>
        </div>
        {weakCount > 0 && (
          <span className="text-[10px] bg-terracotta-light text-terracotta px-2 py-0.5 rounded-full font-medium">
            {weakCount} da rafforzare
          </span>
        )}
      </div>

      {dayGroups.map(([dayKey, dayItems]) => (
        <div key={dayKey}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getDayLabel(dayKey)}</span>
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
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// SECTION: Study Mode Cards
// ═══════════════════════════════════════════

const StudyModeCards = ({ onStartReview, onStartFlashcard }: {
  onStartReview: (topic: string, subject: string) => void;
  onStartFlashcard: (mode: string) => void;
}) => {
  const navigate = useNavigate();
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";
  const [freeInput, setFreeInput] = useState("");

  const modes = [
    { id: "today", label: "Ripassa quello di oggi", icon: CalendarDays, color: "bg-primary/10 text-primary" },
    { id: "cumulative", label: "Ripasso cumulativo", icon: Brain, color: "bg-clay-light text-clay-dark" },
    { id: "prep", label: getPrepLabel(schoolLevel), icon: GraduationCap, color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  ];

  const handleModeClick = (id: string) => {
    if (id === "today" || id === "cumulative") {
      onStartFlashcard(id);
    } else if (id === "prep") {
      onStartFlashcard("program");
    }
  };

  const handleFreeSubmit = () => {
    const trimmed = freeInput.trim();
    if (!trimmed) return;
    onStartFlashcard("topic:" + trimmed);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-sm text-foreground">Inizia una sessione</h3>
      </div>
      <div className="grid grid-cols-1 gap-2 mb-3">
        {modes.map((m) => (
          <button key={m.id} onClick={() => handleModeClick(m.id)}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left">
            <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center flex-shrink-0`}>
              <m.icon className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">{m.label}</p>
          </button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
        </div>
        <Input
          value={freeInput}
          onChange={e => setFreeInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFreeSubmit()}
          placeholder="Oppure scrivi un argomento specifico..."
          className="text-sm pl-9"
        />
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// SECTION: Flashcard Tab (inline from old MemoryRecap)
// ═══════════════════════════════════════════

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

  useEffect(() => { loadCards(); }, [user]);

  const loadCards = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("flashcards").select("*").eq("user_id", user.id)
      .order("is_flagged", { ascending: false }).order("next_review_at", { ascending: true, nullsFirst: true });
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

  const filteredCards = useMemo(() => subjectFilter === "all" ? cards : cards.filter(c => c.subject === subjectFilter), [cards, subjectFilter]);
  const subjects = useMemo(() => Array.from(new Set(cards.map(c => c.subject))).sort(), [cards]);
  const currentCard = filteredCards[currentIndex];

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
    if (currentIndex < filteredCards.length - 1) setTimeout(() => setCurrentIndex(i => i + 1), 200);
    else setSessionDone(true);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (cards.length === 0) return (
    <div className="text-center py-16 px-6">
      <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground font-medium">Nessuna flashcard ancora</p>
      <p className="text-muted-foreground text-sm mt-1">Completa sessioni di studio per generare carte automaticamente!</p>
    </div>
  );

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
          <button onClick={() => { setSessionDone(false); setCurrentIndex(0); setSessionStats({ correct: 0, almost: 0, wrong: 0 }); loadCards(); }}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm">Ricomincia</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => { setSubjectFilter("all"); setCurrentIndex(0); setFlipped(false); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${subjectFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          Tutte ({cards.length})
        </button>
        {subjects.map(s => (
          <button key={s} onClick={() => { setSubjectFilter(s); setCurrentIndex(0); setFlipped(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${subjectFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {s} ({cards.filter(c => c.subject === s).length})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{currentIndex + 1} / {filteredCards.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentIndex + 1) / filteredCards.length) * 100}%` }} />
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
// MAIN PAGE
// ═══════════════════════════════════════════

type MainTab = "overview" | "flashcard" | "errors";

const MemoryRecap = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [focusSessionCount, setFocusSessionCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const data = await getMemoryItems();
      setItems(data);
      setLoading(false);

      // Load weekly focus sessions count
      const profileId = getChildSession()?.profileId;
      if (profileId) {
        const now = new Date();
        const monday = getMonday(now);
        const { count } = await supabase
          .from("focus_sessions")
          .select("id", { count: "exact", head: true })
          .eq("child_profile_id", profileId)
          .gte("completed_at", monday.toISOString());
        setFocusSessionCount(count || 0);
      }
    };
    load();
  }, []);

  const handleItemUpdate = (id: string, newStrength: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, strength: newStrength, last_reviewed: new Date().toISOString() } : item
    ));
  };

  const handleStartFlashcard = (mode: string) => {
    if (mode.startsWith("topic:")) {
      navigate(`/flashcards?mode=topic&topic=${encodeURIComponent(mode.slice(6))}`);
    } else {
      navigate(`/flashcards?mode=${mode}`);
    }
  };

  const handleStartReview = (topic: string, subject: string) => {
    navigate(`/us?type=review&subject=${encodeURIComponent(subject)}`);
  };

  const activeSubjectItems = useMemo(() =>
    selectedSubject ? items.filter(i => i.subject === selectedSubject) : [],
    [items, selectedSubject]
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

          {/* Main tabs */}
          <div className="flex gap-1 mt-3 bg-muted/50 rounded-xl p-1">
            <button onClick={() => setMainTab("overview")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mainTab === "overview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Brain className="w-3.5 h-3.5" /> Panoramica
            </button>
            <button onClick={() => setMainTab("flashcard")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mainTab === "flashcard" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Layers className="w-3.5 h-3.5" /> Flashcard
            </button>
            <button onClick={() => setMainTab("errors")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${mainTab === "errors" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> Errori
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {mainTab === "errors" ? (
        <LearningErrorsTab />
      ) : mainTab === "flashcard" ? (
        <FlashcardTab />
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-6 space-y-6">
          {/* Weekly Summary */}
          <WeeklySummaryCard items={items} focusSessions={focusSessionCount} />

          {/* Weak Concepts */}
          <WeakConceptsSection items={items} onUpdate={handleItemUpdate} />

          {/* Subject Detail or Subjects Overview */}
          {selectedSubject ? (
            <AnimatePresence mode="wait">
              <SubjectDetail
                key={selectedSubject}
                subject={selectedSubject}
                items={activeSubjectItems}
                onUpdate={handleItemUpdate}
                onBack={() => setSelectedSubject(null)}
              />
            </AnimatePresence>
          ) : (
            <SubjectsOverview items={items} onSelect={setSelectedSubject} />
          )}

          {/* Study Mode Cards */}
          <StudyModeCards
            onStartReview={handleStartReview}
            onStartFlashcard={handleStartFlashcard}
          />

          {items.length === 0 && (
            <div className="text-center py-8 px-6">
              <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nessun concetto salvato ancora.</p>
              <p className="text-muted-foreground text-sm mt-1">Completa delle sessioni di studio per iniziare!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemoryRecap;