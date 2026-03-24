import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, RotateCcw, ThumbsDown, Minus, ThumbsUp,
  MessageCircle, Loader2, ChevronRight, AlertTriangle, Trophy,
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

interface CardResult {
  card: Flashcard;
  eval: Eval;
  attempts: number;
}

export default function FlashcardSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectFilter = searchParams.get("subject") || "";
  const profile = getProfile();
  const schoolLevel = profile?.school_level || "superiori";
  const { user } = useAuth();
  const userId = user?.id || getChildSession()?.profileId;
  const isJunior = schoolLevel === "alunno" || schoolLevel === "medie";

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  // Coach intervention state
  const [coachMode, setCoachMode] = useState(false);
  const [coachMessages, setCoachMessages] = useState<ChatMsg[]>([]);
  const [coachStreaming, setCoachStreaming] = useState("");
  const [coachSending, setCoachSending] = useState(false);
  const [coachCard, setCoachCard] = useState<Flashcard | null>(null);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    setLoading(true);
    try {
      const childSession = getChildSession();
      const childMode = isChildSession();

      if (childMode && childSession) {
        // Use child-api to bypass RLS
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
          const sorted = [...data].sort((a, b) => {
            if (a.is_flagged && !b.is_flagged) return -1;
            if (!a.is_flagged && b.is_flagged) return 1;
            const wrongDiff = (b.times_wrong || 0) - (a.times_wrong || 0);
            if (wrongDiff !== 0) return wrongDiff;
            return (b.difficulty || 1) - (a.difficulty || 1);
          });
          setCards(sorted as Flashcard[]);
        }
      } else {
        let query = supabase
          .from("flashcards")
          .select("*")
          .eq("user_id", userId!)
          .order("next_review_at", { ascending: true, nullsFirst: true })
          .limit(20);

        if (subjectFilter) {
          query = query.eq("subject", subjectFilter);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          const sorted = [...data].sort((a, b) => {
            if (a.is_flagged && !b.is_flagged) return -1;
            if (!a.is_flagged && b.is_flagged) return 1;
            const wrongDiff = (b.times_wrong || 0) - (a.times_wrong || 0);
            if (wrongDiff !== 0) return wrongDiff;
            return (b.difficulty || 1) - (a.difficulty || 1);
          });
          setCards(sorted as Flashcard[]);
        }
      }
    } catch (err) {
      console.error("loadCards error:", err);
    }
    setLoading(false);
  }

  const currentCard = cards[currentIndex] || null;

  async function handleEval(evaluation: Eval) {
    if (!currentCard) return;

    const newWrongCounts = { ...wrongCounts };
    if (evaluation === "wrong") {
      newWrongCounts[currentCard.id] = (newWrongCounts[currentCard.id] || 0) + 1;
    }
    setWrongCounts(newWrongCounts);

    // Update DB
    const updates: any = {
      times_shown: (currentCard.times_correct + currentCard.times_wrong + 1),
      last_shown_at: new Date().toISOString(),
    };

    if (evaluation === "correct") {
      updates.times_correct = (currentCard.times_correct || 0) + 1;
      // Push next review further
      const days = Math.min(30, Math.pow(2, (currentCard.times_correct || 0)));
      updates.next_review_at = new Date(Date.now() + days * 86400000).toISOString();
    } else if (evaluation === "wrong") {
      updates.times_wrong = (currentCard.times_wrong || 0) + 1;
      updates.is_flagged = true;
      // Review sooner
      updates.next_review_at = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    } else {
      // almost - review tomorrow
      updates.next_review_at = new Date(Date.now() + 86400000).toISOString();
    }

    await supabase.from("flashcards").update(updates).eq("id", currentCard.id);

    const result: CardResult = {
      card: currentCard,
      eval: evaluation,
      attempts: newWrongCounts[currentCard.id] || 0,
    };
    setResults(prev => [...prev, result]);

    // Check if coach should intervene (wrong 2+ times on same card)
    if (evaluation === "wrong" && (newWrongCounts[currentCard.id] || 0) >= 2) {
      triggerCoachIntervention(currentCard);
      return;
    }

    advanceCard();
  }

  function advanceCard() {
    setFlipped(false);
    if (currentIndex + 1 >= cards.length) {
      // Check if there are wrong cards to retry
      const wrongCards = results.filter(r => r.eval === "wrong").map(r => r.card);
      if (wrongCards.length > 0 && results.length < cards.length * 2) {
        // Add wrong cards back for retry (max one extra pass)
        setCards(prev => [...prev, ...wrongCards.filter(wc => !prev.slice(currentIndex + 1).some(c => c.id === wc.id))]);
      }
      if (currentIndex + 1 >= cards.length) {
        finishSession();
        return;
      }
    }
    setCurrentIndex(prev => prev + 1);
  }

  function finishSession() {
    playCelebrationSound();
    setDone(true);
  }

  function triggerCoachIntervention(card: Flashcard) {
    setCoachCard(card);
    setCoachMode(true);
    setCoachMessages([]);
    setCoachSending(true);
    setCoachStreaming("");

    const systemPrompt = `Sei un coach di studio. Lo studente sta facendo un ripasso con flashcard e ha sbagliato più volte questa domanda:

DOMANDA: ${card.question}
RISPOSTA CORRETTA: ${card.answer}
MATERIA: ${card.subject}
LIVELLO: ${schoolLevel}

Il tuo compito:
1. Spiega il concetto in modo chiaro e ${isJunior ? "semplice, adatto a un bambino" : "diretto"}
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

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
            Completa delle sessioni di studio per generare flashcard automaticamente.
          </p>
          <Button onClick={() => navigate(-1)}>Torna indietro</Button>
        </div>
      </div>
    );
  }

  // ─── Coach intervention ───
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
        showVoice={!isJunior}
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
          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl border border-border p-6 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-1">
              {percentage}% corretto
            </h2>
            <p className="text-sm text-muted-foreground">
              {summary.correct} corrette · {summary.almost} quasi · {summary.wrong} da rivedere
            </p>
          </motion.div>

          {/* Progress bar */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {summary.correct > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(summary.correct / summary.total) * 100}%` }}
                  className="bg-primary rounded-full"
                  transition={{ duration: 0.8 }}
                />
              )}
              {summary.almost > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(summary.almost / summary.total) * 100}%` }}
                  className="bg-secondary rounded-full"
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              )}
              {summary.wrong > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(summary.wrong / summary.total) * 100}%` }}
                  className="bg-destructive rounded-full"
                  transition={{ duration: 0.8, delay: 0.4 }}
                />
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Corrette</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary" /> Quasi</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Da rivedere</span>
            </div>
          </div>

          {/* Hard cards */}
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

          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Torna alla dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ─── Card view ───
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">
            Flashcard {subjectFilter || ""}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{currentIndex + 1} di {cards.length}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-32">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Card area */}
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
            {/* Flip card */}
            <button
              onClick={() => setFlipped(!flipped)}
              className="w-full aspect-[3/2] perspective-1000"
            >
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
                {/* Front */}
                <div className="absolute inset-0 backface-hidden bg-card rounded-3xl border-2 border-border shadow-soft flex flex-col items-center justify-center p-8">
                  <span className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
                    {currentCard?.subject}
                  </span>
                  <p className={`font-display font-bold text-foreground text-center leading-relaxed ${isJunior ? "text-xl" : "text-lg"}`}>
                    {currentCard?.question}
                  </p>
                  <span className="text-xs text-muted-foreground mt-6">Tocca per girare</span>
                </div>
                {/* Back */}
                <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)] bg-primary/5 rounded-3xl border-2 border-primary/20 shadow-soft flex flex-col items-center justify-center p-8">
                  <span className="text-xs text-primary mb-3 font-medium uppercase tracking-wider">Risposta</span>
                  <p className={`font-display font-semibold text-foreground text-center leading-relaxed ${isJunior ? "text-xl" : "text-lg"}`}>
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

      {/* Eval buttons */}
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
