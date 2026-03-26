import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, RotateCcw, ThumbsDown, Minus, ThumbsUp,
  MessageCircle, Loader2, ChevronRight, AlertTriangle, Trophy,
  CalendarDays, Brain, Sparkles, GraduationCap, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatShell } from "@/components/ChatShell";
import { ChatMsg, streamChat } from "@/lib/streamChat";
import { supabase } from "@/integrations/supabase/client";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { useAuth } from "@/hooks/useAuth";
import { playCelebrationSound } from "@/lib/celebrationSound";

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  subject: string;
  difficulty: number;
  times_correct: number;
  times_wrong: number;
  is_flagged: boolean;
}

type Eval = "wrong" | "almost" | "correct";
type FlashcardMode = "today" | "cumulative" | "topic" | "program";

interface CardResult {
  card: Flashcard;
  eval: Eval;
  attempts: number;
}

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// ─── Mode Chooser ───
function ModeChooser({
  onSelect,
  onBack,
  schoolLevel,
  hasExistingCards,
}: {
  onSelect: (mode: FlashcardMode, topic?: string) => void;
  onBack: () => void;
  schoolLevel: string;
  hasExistingCards: boolean;
}) {
  const [topicInput, setTopicInput] = useState("");
  const [showTopicInput, setShowTopicInput] = useState(false);
  const isExamLevel = schoolLevel === "universitario" || schoolLevel === "superiori";

  const modes = [
    {
      id: "today" as FlashcardMode,
      icon: CalendarDays,
      label: "Ripassa quello di oggi",
      desc: "Carte generate dalle sessioni di studio odierne",
      color: "bg-primary/10 text-primary",
      needsCards: true,
    },
    {
      id: "cumulative" as FlashcardMode,
      icon: Brain,
      label: "Ripasso cumulativo",
      desc: "Tutte le carte ordinate per priorità SRS",
      color: "bg-clay-light text-clay-dark",
      needsCards: true,
    },
    {
      id: "topic" as FlashcardMode,
      icon: Search,
      label: "Genera su un argomento",
      desc: "Scegli un tema e l'AI crea carte mirate",
      color: "bg-sage-light text-sage-dark",
      needsCards: false,
    },
    {
      id: "program" as FlashcardMode,
      icon: isExamLevel ? GraduationCap : Sparkles,
      label: isExamLevel ? "Preparati per l'esame" : "Preparati per la verifica",
      desc: isExamLevel
        ? "Carte allineate al programma d'esame della tua classe"
        : "Carte sui programmi ministeriali della tua classe",
      color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      needsCards: false,
    },
  ];

  if (showTopicInput) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowTopicInput(false)} className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Su che argomento?</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="w-full max-w-sm">
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Scrivi l'argomento e la materia, l'AI genererà carte di ripasso mirate
            </p>
            <input
              autoFocus
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && topicInput.trim() && onSelect("topic", topicInput.trim())}
              placeholder="Es. La Rivoluzione Francese, Equazioni di secondo grado..."
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
            />
            <Button
              onClick={() => topicInput.trim() && onSelect("topic", topicInput.trim())}
              disabled={!topicInput.trim()}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Genera flashcard
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="font-display text-base font-semibold text-foreground">Flashcard</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="w-full max-w-sm">
          <h2 className="font-display text-xl font-bold text-foreground mb-1 text-center">Cosa vuoi ripassare?</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center">Scegli la modalità di ripasso</p>
          <div className="flex flex-col gap-2.5">
            {modes.map((m, i) => {
              const disabled = m.needsCards && !hasExistingCards;
              return (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.05 * i }}
                  disabled={disabled}
                  onClick={() => {
                    if (m.id === "topic") {
                      setShowTopicInput(true);
                    } else {
                      onSelect(m.id);
                    }
                  }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card hover:bg-muted hover:border-primary/30 transition-all text-left w-full ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center shrink-0`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{m.desc}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
          {!hasExistingCards && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Completa sessioni di studio per sbloccare il ripasso del giorno e cumulativo
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function FlashcardSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectFilter = searchParams.get("subject") || "";
  const modeParam = searchParams.get("mode") as FlashcardMode | null;
  const fromMemory = searchParams.get("fromMemory") === "true";
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";
  const { user } = useAuth();
  const userId = user?.id || getChildSession()?.profileId;

  // Determine text size based on schoolLevel
  const isElementari = schoolLevel === "alunno";
  const textSizeClass = isElementari ? "text-xl" : "text-lg";

  const [mode, setMode] = useState<FlashcardMode | null>(modeParam);
  const [loading, setLoading] = useState(false);
  const [checkingCards, setCheckingCards] = useState(true);
  const [hasExistingCards, setHasExistingCards] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Coach intervention state
  const [coachMode, setCoachMode] = useState(false);
  const [coachMessages, setCoachMessages] = useState<ChatMsg[]>([]);
  const [coachStreaming, setCoachStreaming] = useState("");
  const [coachSending, setCoachSending] = useState(false);
  const [coachCard, setCoachCard] = useState<Flashcard | null>(null);

  // Check for cards passed from MemoryRecap via sessionStorage
  useEffect(() => {
    if (fromMemory) {
      try {
        const stored = sessionStorage.getItem("inschool-generated-flashcards");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCards(parsed);
            setMode("topic");
            setCheckingCards(false);
            setLoading(false);
            sessionStorage.removeItem("inschool-generated-flashcards");
            sessionStorage.removeItem("inschool-flashcard-subject");
            return;
          }
        }
      } catch {}
    }
  }, [fromMemory]);

  // Check if user has existing cards
  useEffect(() => {
    if (fromMemory && cards.length > 0) return;
    async function check() {
      try {
        const childSession = getChildSession();
        if (isChildSession() && childSession) {
          const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`;
          const res = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ action: "get-flashcards", accessCode: childSession.accessCode, childProfileId: childSession.profileId, payload: {} }),
          });
          const data = await res.json();
          setHasExistingCards(Array.isArray(data) && data.length > 0);
        } else if (userId) {
          const { count } = await supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId);
          setHasExistingCards((count || 0) > 0);
        }
      } catch {}
      setCheckingCards(false);
    }
    check();
  }, [userId, fromMemory, cards.length]);

  // If mode is set via param, auto-start
  useEffect(() => {
    if (modeParam && !checkingCards && !fromMemory) {
      handleModeSelect(modeParam);
    }
  }, [modeParam, checkingCards]);

  async function handleModeSelect(selectedMode: FlashcardMode, topic?: string) {
    setMode(selectedMode);
    setLoading(true);

    if (selectedMode === "topic" || selectedMode === "program") {
      await generateAICards(selectedMode, topic);
    } else {
      await loadExistingCards(selectedMode);
    }
  }

  async function generateAICards(selectedMode: FlashcardMode, topic?: string) {
    setGenerating(true);
    try {
      const classSection = profile?.class_section || "";
      const schoolName = profile?.school_name || "";
      const subjects = profile?.favorite_subjects || [];
      const difficultSubjects = profile?.difficult_subjects || [];

      let prompt = "";
      if (selectedMode === "topic") {
        prompt = `Genera flashcard di ripasso sull'argomento: "${topic}". Livello scolastico: ${schoolLevel}. Classe: ${classSection}.`;
      } else {
        const isExam = schoolLevel === "universitario" || schoolLevel === "superiori";
        const subjectList = [...subjects, ...difficultSubjects].filter(Boolean).join(", ");
        prompt = isExam
          ? `Genera flashcard di preparazione all'esame per uno studente di livello "${schoolLevel}", classe "${classSection}", scuola "${schoolName}". Materie principali: ${subjectList || "generiche"}. Segui i programmi ministeriali italiani. Concentrati sui concetti chiave più richiesti agli esami.`
          : `Genera flashcard di ripasso basate sui programmi ministeriali italiani per uno studente di livello "${schoolLevel}", classe "${classSection}". Materie: ${subjectList || "generiche"}. Concentrati sui concetti fondamentali del programma.`;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const childSession = getChildSession();
      if (childSession) {
        headers.apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        headers.apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            subject: topic || "Programma di studio",
            conversationHistory: prompt,
            schoolLevel,
          }),
        }
      );

      const data = await response.json();
      if (data.cards && data.cards.length > 0) {
        const generated: Flashcard[] = data.cards.map((c: any, i: number) => ({
          id: `gen-${Date.now()}-${i}`,
          question: c.question,
          answer: c.answer,
          subject: topic || "Programma",
          difficulty: c.difficulty || 1,
          times_correct: 0,
          times_wrong: 0,
          is_flagged: false,
        }));
        setCards(generated);
      }
    } catch (err) {
      console.error("Generate flashcards error:", err);
    }
    setGenerating(false);
    setLoading(false);
  }

  async function loadExistingCards(selectedMode: FlashcardMode) {
    try {
      const childSession = getChildSession();
      const childMode = isChildSession();

      if (childMode && childSession) {
        const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/child-api`;
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({
            action: "get-flashcards",
            accessCode: childSession.accessCode,
            childProfileId: childSession.profileId,
            payload: { subject: subjectFilter || undefined },
          }),
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          let filtered = data;
          if (selectedMode === "today") {
            const todayStr = new Date().toISOString().slice(0, 10);
            filtered = data.filter((c: any) => c.created_at?.slice(0, 10) === todayStr);
            if (filtered.length === 0) filtered = data.slice(0, 10);
          }
          const sorted = sortCards(filtered);
          setCards(sorted as Flashcard[]);
        }
      } else {
        let query = supabase.from("flashcards").select("*").eq("user_id", userId!);

        if (subjectFilter) query = query.eq("subject", subjectFilter);

        if (selectedMode === "today") {
          const todayStr = new Date().toISOString().slice(0, 10);
          query = query.gte("created_at", todayStr);
        }

        query = query.order("next_review_at", { ascending: true, nullsFirst: true }).limit(20);
        const { data } = await query;

        if (data && data.length > 0) {
          setCards(sortCards(data) as Flashcard[]);
        } else if (selectedMode === "today") {
          const { data: fallback } = await supabase
            .from("flashcards").select("*").eq("user_id", userId!)
            .order("next_review_at", { ascending: true, nullsFirst: true }).limit(20);
          if (fallback) setCards(sortCards(fallback) as Flashcard[]);
        }
      }
    } catch (err) {
      console.error("loadCards error:", err);
    }
    setLoading(false);
  }

  function sortCards(data: any[]) {
    return [...data].sort((a, b) => {
      if (a.is_flagged && !b.is_flagged) return -1;
      if (!a.is_flagged && b.is_flagged) return 1;
      const wrongDiff = (b.times_wrong || 0) - (a.times_wrong || 0);
      if (wrongDiff !== 0) return wrongDiff;
      return (b.difficulty || 1) - (a.difficulty || 1);
    });
  }

  const currentCard = cards[currentIndex] || null;

  async function handleEval(evaluation: Eval) {
    if (!currentCard) return;

    const newWrongCounts = { ...wrongCounts };
    if (evaluation === "wrong") {
      newWrongCounts[currentCard.id] = (newWrongCounts[currentCard.id] || 0) + 1;
    }
    setWrongCounts(newWrongCounts);

    // Update DB only for persisted cards
    if (!currentCard.id.startsWith("gen-")) {
      const updates: Record<string, any> = {
        last_shown_at: new Date().toISOString(),
        times_shown: ((currentCard as any).times_shown || 0) + 1,
      };

      if (evaluation === "correct") {
        updates.times_correct = (currentCard.times_correct || 0) + 1;
        const days = Math.min(30, Math.pow(2, (currentCard.times_correct || 0)));
        updates.next_review_at = new Date(Date.now() + days * 86400000).toISOString();
      } else if (evaluation === "wrong") {
        updates.times_wrong = (currentCard.times_wrong || 0) + 1;
        updates.is_flagged = true;
        updates.next_review_at = new Date(Date.now() + 3600000).toISOString(); // 1h for wrong cards
      } else {
        updates.next_review_at = new Date(Date.now() + 86400000).toISOString();
      }

      await supabase.from("flashcards").update(updates).eq("id", currentCard.id);
    }

    const result: CardResult = {
      card: currentCard,
      eval: evaluation,
      attempts: newWrongCounts[currentCard.id] || 0,
    };
    setResults(prev => [...prev, result]);

    // Coach intervention after 3 wrong on same card
    if (evaluation === "wrong" && (newWrongCounts[currentCard.id] || 0) >= 3) {
      triggerCoachIntervention(currentCard);
      return;
    }

    advanceCard();
  }

  function advanceCard() {
    setFlipped(false);
    if (currentIndex + 1 >= cards.length) {
      // Re-add wrong cards to end of deck
      const wrongCards = results.filter(r => r.eval === "wrong").map(r => r.card);
      if (wrongCards.length > 0 && results.length < cards.length * 2) {
        setCards(prev => [...prev, ...wrongCards.filter(wc => !prev.slice(currentIndex + 1).some(c => c.id === wc.id))]);
      }
      if (currentIndex + 1 >= cards.length) {
        finishSession();
        return;
      }
    }
    setCurrentIndex(prev => prev + 1);
  }

  async function finishSession() {
    playCelebrationSound();
    setDone(true);
    try {
      const { autoCompleteMissions } = await import("@/lib/database");
      await autoCompleteMissions(["review_weak_concept", "review_concept", "study_session"]);
    } catch (err) {
      console.error("Mission completion error:", err);
    }
  }

  function triggerCoachIntervention(card: Flashcard) {
    setCoachCard(card);
    setCoachMode(true);
    setCoachMessages([]);
    setCoachSending(true);
    setCoachStreaming("");

    // Adapt coach tone to schoolLevel
    let toneInstruction = "in modo chiaro e diretto";
    if (isElementari) {
      toneInstruction = "con parole semplicissime, frasi brevi, emoji e tono giocoso. Come se parlassi a un bambino";
    } else if (schoolLevel === "medie" || schoolLevel?.startsWith("media")) {
      toneInstruction = "con tono amichevole e diretto, adatto a un ragazzo di 11-13 anni. Non infantile ma accessibile";
    } else if (schoolLevel === "universitario") {
      toneInstruction = "con tono sobrio e accademico, alla pari. Nessun incoraggiamento infantile";
    }

    const systemPrompt = `Sei un coach di studio. Lo studente sta facendo un ripasso con flashcard e ha sbagliato più volte questa domanda:

DOMANDA: ${card.question}
RISPOSTA CORRETTA: ${card.answer}
MATERIA: ${card.subject}
LIVELLO: ${schoolLevel}

Il tuo compito:
1. Spiega il concetto ${toneInstruction}
2. Fai una domanda di verifica per assicurarti che abbia capito
3. Sii breve e incoraggiante

Inizia spiegando il concetto.`;

    streamChat({
      messages: [{ role: "user", content: systemPrompt }],
      onDelta: (full) => setCoachStreaming(full),
      onDone: (full) => {
        setCoachMessages([{ role: "assistant", content: full }]);
        setCoachStreaming("");
        setCoachSending(false);
      },
    }).catch(() => {
      setCoachMessages([{ role: "assistant", content: "Vediamo insieme questo concetto. Cosa ricordi della risposta?" }]);
      setCoachStreaming("");
      setCoachSending(false);
    });
  }

  const handleCoachSend = useCallback((text: string) => {
    if (coachSending) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...coachMessages, userMsg];
    setCoachMessages(newMessages);
    setCoachSending(true);
    setCoachStreaming("");

    streamChat({
      messages: newMessages,
      onDelta: (full) => setCoachStreaming(full),
      onDone: (full) => {
        setCoachMessages(prev => [...prev, { role: "assistant", content: full }]);
        setCoachStreaming("");
        setCoachSending(false);
      },
    }).catch(() => {
      setCoachMessages(prev => [...prev, { role: "assistant", content: "Errore. Riprova." }]);
      setCoachStreaming("");
      setCoachSending(false);
    });
  }, [coachMessages, coachSending]);

  function exitCoachMode() {
    setCoachMode(false);
    setCoachCard(null);
    advanceCard();
  }

  // ─── Summary stats ───
  const summary = useMemo(() => {
    const correct = results.filter(r => r.eval === "correct").length;
    const almost = results.filter(r => r.eval === "almost").length;
    const wrong = results.filter(r => r.eval === "wrong").length;
    const hardCards = results.filter(r => r.eval === "wrong" || r.attempts >= 2);
    const uniqueHard = Array.from(new Map(hardCards.map(r => [r.card.id, r])).values());
    return { correct, almost, wrong, total: results.length, hardCards: uniqueHard };
  }, [results]);

  // ─── Mode chooser ───
  if (!mode && !checkingCards) {
    return (
      <ModeChooser
        onSelect={handleModeSelect}
        onBack={() => navigate(-1)}
        schoolLevel={schoolLevel}
        hasExistingCards={hasExistingCards}
      />
    );
  }

  // ─── Loading / Generating ───
  if (loading || generating || checkingCards) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        {generating && (
          <p className="text-sm text-muted-foreground animate-pulse">L'AI sta generando le flashcard...</p>
        )}
      </div>
    );
  }

  // ─── No cards ───
  if (!loading && cards.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-lg font-bold text-foreground mb-2">Nessuna flashcard</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "today"
              ? "Non hai studiato ancora oggi. Completa una sessione per generare carte!"
              : "Completa delle sessioni di studio per generare flashcard automaticamente."}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => { setMode(null); setCards([]); }}>Cambia modalità</Button>
            <Button onClick={() => navigate(-1)}>Torna indietro</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Coach intervention (interactive mini-session) ───
  if (coachMode && coachCard) {
    return (
      <ChatShell
        title="Approfondiamo insieme"
        subtitle={coachCard.subject}
        badgeText="Mini-sessione"
        messages={coachMessages}
        streamingText={coachStreaming}
        sending={coachSending}
        onSend={handleCoachSend}
        onBack={exitCoachMode}
        showHint={false}
        showStuck={false}
        showExplain={true}
        showVoice={!isElementari}
        showAttach={false}
        extraFooter={
          coachMessages.length >= 2 ? (
            <div className="px-4 py-2 border-t border-border bg-muted/50">
              <Button size="sm" variant="outline" onClick={exitCoachMode} className="w-full">
                <ChevronRight className="w-4 h-4 mr-2" /> Ho capito, continua con le flashcard
              </Button>
            </div>
          ) : undefined
        }
        inputPlaceholder="Scrivi la tua risposta..."
      />
    );
  }

  // ─── Done / Summary ───
  if (done) {
    const percentage = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">Ripasso completato</h1>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="bg-card rounded-3xl border border-border p-6 text-center"
          >
            <Trophy className="w-10 h-10 text-primary mx-auto mb-3" />
            <h2 className="font-display text-2xl font-bold text-foreground mb-1">{percentage}%</h2>
            <p className="text-sm text-muted-foreground">
              {percentage >= 80 ? "Ottimo lavoro!" : percentage >= 50 ? "Buon progresso!" : "Continua a esercitarti!"}
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary/5 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-primary">{summary.correct}</p>
              <p className="text-[11px] text-muted-foreground">Corrette</p>
            </div>
            <div className="bg-secondary/10 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-secondary-foreground">{summary.almost}</p>
              <p className="text-[11px] text-muted-foreground">Quasi</p>
            </div>
            <div className="bg-destructive/5 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-destructive">{summary.wrong}</p>
              <p className="text-[11px] text-muted-foreground">Da rivedere</p>
            </div>
          </div>

          {/* Hard cards with "Approfondisci con il Coach" */}
          {summary.hardCards.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">Carte più difficili</h3>
              </div>
              <div className="space-y-2">
                {summary.hardCards.map(r => (
                  <div key={r.card.id} className="bg-muted/50 rounded-xl p-3">
                    <p className="text-sm font-medium text-foreground">{r.card.question}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.card.answer}</p>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => navigate("/us?type=review")}
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Approfondisci con il Coach
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMode(null); setCards([]); setResults([]); setCurrentIndex(0); setDone(false); setWrongCounts({}); }} className="flex-1">
              Altro ripasso
            </Button>
            <Button onClick={() => navigate("/dashboard")} className="flex-1">
              Torna alla dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Card view ───
  const progress = ((currentIndex) / cards.length) * 100;
  const modeLabels: Record<FlashcardMode, string> = {
    today: "Ripasso di oggi",
    cumulative: "Ripasso cumulativo",
    topic: "Argomento specifico",
    program: schoolLevel === "universitario" || schoolLevel === "superiori" ? "Preparazione esame" : "Programma",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">
            {modeLabels[mode!] || "Flashcard"} {subjectFilter ? `· ${subjectFilter}` : ""}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{currentIndex + 1} di {cards.length}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-32">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard?.id || "empty"}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md"
          >
            <button
              onClick={() => setFlipped(!flipped)}
              className="w-full aspect-[3/2] perspective-1000"
            >
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
                <div className="absolute inset-0 backface-hidden bg-card rounded-3xl border-2 border-border shadow-soft flex flex-col items-center justify-center p-8">
                  <span className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
                    {currentCard?.subject}
                  </span>
                  <p className={`font-display font-bold text-foreground text-center leading-relaxed ${textSizeClass}`}>
                    {currentCard?.question}
                  </p>
                  <span className="text-xs text-muted-foreground mt-6">Tocca per girare</span>
                </div>
                <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)] bg-primary/5 rounded-3xl border-2 border-primary/20 shadow-soft flex flex-col items-center justify-center p-8">
                  <span className="text-xs text-primary mb-3 font-medium uppercase tracking-wider">Risposta</span>
                  <p className={`font-display font-semibold text-foreground text-center leading-relaxed ${textSizeClass}`}>
                    {currentCard?.answer}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (currentCard) triggerCoachIntervention(currentCard); }}
                    className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-medium text-primary"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Spiegami meglio
                  </button>
                </div>
              </div>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-6 pb-8 shrink-0"
          >
            <p className="text-xs text-muted-foreground text-center mb-3">Come è andata?</p>
            <div className="flex gap-3 max-w-md mx-auto">
              <button
                onClick={() => handleEval("wrong")}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                <ThumbsDown className="w-5 h-5 text-destructive" />
                <span className="text-xs font-medium text-destructive">Non sapevo</span>
              </button>
              <button
                onClick={() => handleEval("almost")}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 border-secondary/30 bg-secondary/5 hover:bg-secondary/10 transition-colors"
              >
                <Minus className="w-5 h-5 text-secondary-foreground" />
                <span className="text-xs font-medium text-secondary-foreground">Quasi</span>
              </button>
              <button
                onClick={() => handleEval("correct")}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <ThumbsUp className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium text-primary">Lo sapevo</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
