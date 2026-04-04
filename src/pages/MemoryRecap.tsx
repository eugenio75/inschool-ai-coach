import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Brain, RefreshCw, Sparkles,
  Loader2, Send, MessageCircle, X, BookOpen,
  Layers, ThumbsDown, Minus as MinusIcon, ThumbsUp, AlertCircle,
  CalendarDays, Target, ChevronRight, Zap, Gamepad2, Trophy,
  CheckCircle2, XCircle, Clock, Shuffle, HelpCircle, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MathText } from "@/components/shared/MathText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageBackButton } from "@/components/shared/PageBackButton";
import { getMemoryItems, updateMemoryStrength, getDailyMissions, completeMission, autoCompleteMissions } from "@/lib/database";
import { subjectColors } from "@/lib/mockData";
import { isChildSession, getChildSession, childApi } from "@/lib/childSession";
import { getCurrentLang } from "@/lib/langUtils";


const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

// ─── Types ───
type Section = "ripasso" | "rinforza";
type ContentType = "today" | "cumulative" | "specific";
type StudyMethod = "coach" | "flashcard" | "challenge" | "game";
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

const ReviewChat = ({ topic, subject, section, onClose }: {
  topic: string; subject: string; section: Section; onClose: () => void;
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
    const studyMode = section === "rinforza" ? "strengthen" : "review";
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ messages: allMessages, concept: topic, summary: "", subject, strength: 50, studentProfile: profile, studyMode, lang: getCurrentLang() }),
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

  const label = section === "rinforza" ? "Rafforza" : "Ripasso";

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{label}: {topic}</span>
          <span className="text-xs text-muted-foreground">· {subject}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "assistant" ? "bg-card text-foreground rounded-bl-md border border-border" : "bg-primary text-primary-foreground rounded-br-md"}`}>
              <MathText>{msg.content}</MathText>
            </div>
          </motion.div>
        ))}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-card text-foreground rounded-2xl rounded-bl-md border border-border px-4 py-2.5 text-sm leading-relaxed">
              <MathText>{streamingText.replace(/\[STRENGTH_UPDATE:\s*\d+\]/, "")}</MathText>
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

// ─── Challenge Session ───

interface ChallengeQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const ChallengeSession = ({ subject, topic, section, concepts, onClose }: {
  subject: string; topic: string; section: Section; concepts: any[]; onClose: () => void;
}) => {
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    generateChallenge();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const generateChallenge = async () => {
    setLoading(true);
    const profile = getProfile();
    const schoolLevel = profile?.school_level || "superiori";
    const conceptTexts = concepts.map(c => `${c.concept}: ${c.summary || ""}`).join("\n");
    const challengeType = section === "rinforza"
      ? "sfide mirate al miglioramento: correggi errori, rimetti in ordine passaggi, scegli il procedimento corretto, applica concetti a esempi concreti"
      : "sfide brevi per attivare attenzione e memoria: domande rapide, abbina concetto e definizione, riconosci concetti";

    // Profile-specific instructions
    let levelInstructions = "";
    if (schoolLevel === "alunno") {
      levelInstructions = "Domande semplicissime con linguaggio breve. Una cosa sola per volta. Opzioni corte e chiare. Tono giocoso.";
    } else if (schoolLevel === "medie" || schoolLevel?.startsWith("media")) {
      levelInstructions = "Domande di complessità moderata. Linguaggio chiaro e amichevole, adatto a 11-13 anni. Non infantile.";
    } else if (schoolLevel === "superiori") {
      levelInstructions = "Domande mirate al ragionamento e al metodo. Linguaggio disciplinare. Connessioni causa-effetto.";
    } else {
      levelInstructions = "Domande strategiche e dense. Terminologia tecnica. Comprensione profonda.";
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            lang: getCurrentLang(), subject,
            schoolLevel,
            conversationHistory: `Genera 5 domande a risposta multipla (4 opzioni, 1 corretta) come ${challengeType}.
Argomento: ${topic}
Concetti: ${conceptTexts}
${section === "rinforza" ? "Focalizzati sui punti deboli e gli errori comuni." : "Focalizzati sul richiamo e la memoria."}
${profile?.name ? `Studente: ${profile.name}` : ""}
LIVELLO: ${levelInstructions}

Formato JSON richiesto:
{"cards":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]}
correct è l'indice (0-3) della risposta giusta.`,
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const raw = data.cards || [];
        const parsed = raw.filter((q: any) => q.question && q.options?.length >= 2 && typeof q.correct === "number");
        if (parsed.length > 0) {
          setQuestions(parsed);
          startTimer();
        }
      }
    } catch (e) { console.error("Challenge gen error:", e); }
    finally { setLoading(false); }
  };

  const startTimer = () => {
    setTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswer = (idx: number) => {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const isCorrect = idx === questions[currentQ]?.correct;
    if (isCorrect) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    if (currentQ + 1 >= questions.length) {
      setDone(true);
      autoCompleteMissions(["review_weak_concept", "review_concept", "study_session"]).catch(() => {});
    } else {
      setCurrentQ(q => q + 1);
      setSelected(null);
      setShowResult(false);
      startTimer();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparo la sfida...</p>
      </div>
    );
  }

  if (done || questions.length === 0) {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-1">
            {questions.length === 0 ? "Nessuna sfida disponibile" : "Sfida completata!"}
          </h2>
          {questions.length > 0 && (
            <>
              <p className="text-3xl font-bold text-primary mt-4">{pct}%</p>
              <p className="text-sm text-muted-foreground">{score} su {questions.length} corrette</p>
              <div className="mt-4 text-sm text-muted-foreground">
                {pct >= 80 ? "🎉 Ottimo lavoro!" : pct >= 50 ? "💪 Buon inizio, continua così!" : "📚 Rivedi l'argomento e riprova!"}
              </div>
            </>
          )}
          <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm">
            Torna indietro
          </button>
        </motion.div>
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-primary font-medium">
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        <div className="flex items-center gap-3">
          {streak >= 2 && <span className="text-xs font-bold text-amber-500">🔥 {streak}</span>}
          <span className={`text-xs font-mono font-bold ${timer <= 10 ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="w-3 h-3 inline mr-1" />{timer}s
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{currentQ + 1} / {questions.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>
        <span className="font-semibold text-primary">{score} pt</span>
      </div>

      <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-sm font-semibold text-foreground leading-relaxed">{q.question}</p>
        </div>

        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let style = "border-border bg-card hover:border-primary/30";
            if (showResult) {
              if (i === q.correct) style = "border-green-400 bg-green-50 dark:bg-green-900/20";
              else if (i === selected && i !== q.correct) style = "border-destructive bg-destructive/5";
              else style = "border-border bg-card opacity-60";
            }
            return (
              <button key={i} onClick={() => handleAnswer(i)} disabled={showResult}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all text-sm ${style}`}>
                <span className="font-medium text-foreground">{opt}</span>
                {showResult && i === q.correct && <CheckCircle2 className="w-4 h-4 text-green-500 inline ml-2" />}
                {showResult && i === selected && i !== q.correct && <XCircle className="w-4 h-4 text-destructive inline ml-2" />}
              </button>
            );
          })}
        </div>

        {showResult && q.explanation && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground leading-relaxed">
            💡 {q.explanation}
          </motion.div>
        )}

        {showResult && (
          <Button onClick={nextQuestion} className="w-full">
            {currentQ + 1 >= questions.length ? "Vedi risultati" : "Prossima domanda"}
          </Button>
        )}
      </motion.div>
    </div>
  );
};

// ─── Game Session ───

type GameType = "true-false" | "complete" | "memory-match" | "find-error";

interface GameItem {
  statement: string;
  isTrue?: boolean;
  answer?: string;
  correction?: string;
  shuffledOptions?: string[];
}

const GameSession = ({ subject, topic, section, concepts, onClose }: {
  subject: string; topic: string; section: Section; concepts: any[]; onClose: () => void;
}) => {
  const [gameItems, setGameItems] = useState<GameItem[]>([]);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState<boolean | string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [textInput, setTextInput] = useState("");

  const gameOptions: { type: GameType; label: string; desc: string; icon: any; forSection: Section[] }[] = [
    { type: "true-false", label: "Vero o falso", desc: section === "rinforza" ? "Individua le affermazioni corrette e scorrette" : "Rispondi velocemente: vero o falso?", icon: CheckCircle2, forSection: ["ripasso", "rinforza"] },
    { type: "complete", label: "Completa la frase", desc: section === "rinforza" ? "Completa il passaggio mancante" : "Inserisci la parola giusta", icon: HelpCircle, forSection: ["ripasso", "rinforza"] },
    { type: "find-error", label: "Trova l'errore", desc: "Correggi l'affermazione sbagliata", icon: XCircle, forSection: ["rinforza"] },
    { type: "memory-match", label: "Scegli la risposta", desc: "Seleziona la risposta corretta", icon: Shuffle, forSection: ["ripasso", "rinforza"] },
  ];

  const availableGames = gameOptions.filter(g => g.forSection.includes(section));

  // Helper: shuffle array once (stable)
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const startGame = async (type: GameType) => {
    setGameType(type);
    setLoading(true);
    const profile = getProfile();
    const schoolLevel = profile?.school_level || "superiori";
    const conceptTexts = concepts.map(c => `${c.concept}: ${c.summary || ""}`).join("\n");

    let levelInstructions = "";
    if (schoolLevel === "alunno") {
      levelInstructions = "Gioco per bambini 6-10 anni. Frasi brevissime. Parole semplici. Tono giocoso e leggero. Nessun termine tecnico.";
    } else if (schoolLevel === "medie" || schoolLevel?.startsWith("media")) {
      levelInstructions = "Gioco per ragazzi 11-13 anni. Coinvolgente ma non infantile. Linguaggio chiaro e accessibile.";
    } else if (schoolLevel === "superiori") {
      levelInstructions = "Gioco orientato alla comprensione. Linguaggio disciplinare. Sfide di ragionamento.";
    } else {
      levelInstructions = "Gioco orientato alla comprensione profonda e terminologia tecnica. Registro accademico.";
    }

    let prompt = "";
    if (type === "true-false") {
      prompt = `Genera 6 affermazioni vero/falso su: ${topic}\nConcetti: ${conceptTexts}\n${levelInstructions}\nFormato JSON: {"cards":[{"question":"affermazione","options":["vero"],"correct":0,"explanation":""}]}\nPer affermazioni false, metti correct: -1 e in explanation scrivi la correzione.`;
    } else if (type === "complete") {
      prompt = `Genera 5 frasi da completare su: ${topic}\nConcetti: ${conceptTexts}\n${levelInstructions}\nOgni frase deve avere uno spazio vuoto (___). Formato JSON: {"cards":[{"question":"La ___ è...","options":["risposta corretta"],"correct":0,"explanation":"frase completa"}]}`;
    } else if (type === "find-error") {
      prompt = `Genera 5 affermazioni SBAGLIATE su: ${topic} che lo studente deve correggere.\nConcetti: ${conceptTexts}\n${levelInstructions}\nFormato JSON: {"cards":[{"question":"affermazione sbagliata","options":["correzione"],"correct":0,"explanation":"spiegazione dell'errore"}]}`;
    } else {
      // memory-match: ask for proper multiple choice with 4 options
      prompt = `Genera 5 domande a risposta multipla su: ${topic}\nConcetti: ${conceptTexts}\n${levelInstructions}\nOgni domanda DEVE avere esattamente 4 opzioni di risposta.\nFormato JSON: {"cards":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":""}]}\ncorrect è l'indice (0-3) della risposta giusta.`;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ subject, schoolLevel, conversationHistory: prompt, lang: getCurrentLang() }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const cards = data.cards || [];
        if (type === "true-false") {
          setGameItems(cards.map((c: any) => ({
            statement: c.question,
            isTrue: c.correct === 0,
            correction: c.explanation || "",
          })));
        } else if (type === "find-error") {
          setGameItems(cards.map((c: any) => ({
            statement: c.question,
            answer: c.options?.[0] || "",
            correction: c.explanation || "",
          })));
        } else if (type === "complete") {
          setGameItems(cards.map((c: any) => ({
            statement: c.question,
            answer: c.options?.[0] || "",
            correction: c.explanation || "",
          })));
        } else {
          // memory-match: pre-shuffle options at creation time (stable)
          setGameItems(cards.filter((c: any) => c.options?.length >= 2).map((c: any) => {
            const correctAnswer = c.options[c.correct] || c.options[0];
            const shuffled = shuffleArray([...c.options]);
            return {
              statement: c.question,
              answer: correctAnswer,
              correction: c.explanation || "",
              shuffledOptions: shuffled,
            };
          }));
        }
      }
    } catch (e) { console.error("Game gen error:", e); }
    finally { setLoading(false); }
  };

  const handleTrueFalse = (answer: boolean) => {
    if (answered) return;
    setAnswered(true);
    setUserAnswer(answer);
    if (answer === gameItems[currentIdx]?.isTrue) setScore(s => s + 1);
  };

  const handleTextAnswer = (ans: string) => {
    if (answered) return;
    setAnswered(true);
    setUserAnswer(ans);
    const correct = gameItems[currentIdx]?.answer?.toLowerCase().trim();
    if (ans.toLowerCase().trim() === correct) setScore(s => s + 1);
  };

  const handleOptionSelect = (opt: string) => {
    if (answered) return;
    setAnswered(true);
    setUserAnswer(opt);
    if (opt === gameItems[currentIdx]?.answer) setScore(s => s + 1);
  };

  const nextItem = () => {
    if (currentIdx + 1 >= gameItems.length) {
      setDone(true);
      autoCompleteMissions(["review_weak_concept", "review_concept", "study_session"]).catch(() => {});
    } else {
      setCurrentIdx(i => i + 1);
      setAnswered(false);
      setUserAnswer(null);
      setTextInput("");
    }
  };

  // Game type picker
  if (!gameType) {
    return (
      <div className="max-w-lg mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="font-display text-lg font-bold text-foreground">Scegli il gioco</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {section === "rinforza" ? "Capisci meglio con un'attività interattiva" : "Ripassa con un'attività più leggera e interattiva"}
        </p>
        <div className="space-y-2.5">
          {availableGames.map((g, i) => (
            <motion.button key={g.type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.05 }}
              onClick={() => startGame(g.type)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
              <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center">
                <g.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{g.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparo il gioco...</p>
      </div>
    );
  }

  if (done || gameItems.length === 0) {
    const pct = gameItems.length > 0 ? Math.round((score / gameItems.length) * 100) : 0;
    return (
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mx-auto mb-4">
            <Gamepad2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-1">
            {gameItems.length === 0 ? "Nessun gioco disponibile" : "Gioco completato!"}
          </h2>
          {gameItems.length > 0 && (
            <>
              <p className="text-3xl font-bold text-primary mt-4">{pct}%</p>
              <p className="text-sm text-muted-foreground">{score} su {gameItems.length}</p>
              <div className="mt-3 text-sm text-muted-foreground">
                {pct >= 80 ? "🎉 Fantastico!" : pct >= 50 ? "💪 Bene, continua!" : "📖 Rivedi i concetti e riprova!"}
              </div>
            </>
          )}
          <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm">Torna indietro</button>
        </motion.div>
      </div>
    );
  }

  const item = gameItems[currentIdx];

  return (
    <div className="max-w-lg mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-primary font-medium">
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        <span className="text-xs font-semibold text-primary">{score} pt</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{currentIdx + 1} / {gameItems.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentIdx + 1) / gameItems.length) * 100}%` }} />
        </div>
      </div>

      <motion.div key={currentIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-sm font-semibold text-foreground leading-relaxed">{item.statement}</p>
        </div>

        {gameType === "true-false" && (
          <div className="grid grid-cols-2 gap-3">
            {["Vero", "Falso"].map((label, i) => {
              const val = i === 0;
              let style = "border-border bg-card hover:border-primary/30";
              if (answered) {
                if (val === item.isTrue) style = "border-green-400 bg-green-50 dark:bg-green-900/20";
                else if (val === userAnswer) style = "border-destructive bg-destructive/5";
                else style = "border-border bg-card opacity-60";
              }
              return (
                <button key={label} onClick={() => handleTrueFalse(val)} disabled={answered}
                  className={`p-4 rounded-xl border-2 transition-all text-sm font-semibold ${style}`}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {(gameType === "complete" || gameType === "find-error") && (
          <div className="space-y-3">
            <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && textInput.trim()) handleTextAnswer(textInput.trim()); }}
              placeholder={gameType === "find-error" ? "Scrivi la correzione..." : "Completa la frase..."}
              disabled={answered}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
            {!answered && (
              <Button onClick={() => textInput.trim() && handleTextAnswer(textInput.trim())} disabled={!textInput.trim()} className="w-full">
                Conferma
              </Button>
            )}
          </div>
        )}

        {gameType === "memory-match" && item.shuffledOptions && (
          <div className="space-y-2">
            {item.shuffledOptions.map((opt, i) => {
              let style = "border-border bg-card hover:border-primary/30";
              if (answered) {
                if (opt === item.answer) style = "border-green-400 bg-green-50 dark:bg-green-900/20";
                else if (opt === userAnswer) style = "border-destructive bg-destructive/5";
                else style = "border-border bg-card opacity-60";
              }
              return (
                <button key={`${currentIdx}-${i}`} onClick={() => handleOptionSelect(opt)} disabled={answered}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all text-sm ${style}`}>
                  <span className="font-medium text-foreground">{opt}</span>
                  {answered && opt === item.answer && <CheckCircle2 className="w-4 h-4 text-green-500 inline ml-2" />}
                  {answered && opt === userAnswer && opt !== item.answer && <XCircle className="w-4 h-4 text-destructive inline ml-2" />}
                </button>
              );
            })}
          </div>
        )}

        {answered && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {item.correction && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground leading-relaxed">
                💡 {item.correction}
              </div>
            )}
            <Button onClick={nextItem} className="w-full">
              {currentIdx + 1 >= gameItems.length ? "Vedi risultati" : "Prossimo"}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

// ─── Concept Row ───

const ConceptRow = ({ item, index, showStrength, checked, onToggle }: {
  item: any; index: number; showStrength: boolean; checked: boolean; onToggle: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [deepSummary, setDeepSummary] = useState<string | null>(null);
  const [loadingDeep, setLoadingDeep] = useState(false);

  const fetchDeepSummary = async () => {
    if (deepSummary) { setExpanded(true); return; }
    setExpanded(true);
    setLoadingDeep(true);
    try {
      const profile = getProfile();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            messages: [], concept: item.concept, summary: item.summary || "",
            subject: item.subject || "", studentProfile: profile, mode: "deep-summary", lang: getCurrentLang(),
          }),
        }
      );
      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ") || line.trim() === "") continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const p = JSON.parse(jsonStr);
              const c = p.choices?.[0]?.delta?.content;
              if (c) text += c;
            } catch {}
          }
        }
        if (text) setDeepSummary(text);
      }
    } catch (e) { console.error("Deep summary error:", e); }
    finally { setLoadingDeep(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
      <button onClick={onToggle} className="mt-0.5 shrink-0">
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
          checked ? "bg-primary border-primary shadow-sm" : "border-muted-foreground/25 hover:border-primary/60 bg-background"
        }`}>
          {checked && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{item.concept}</p>
        {item.summary && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{item.summary}</p>}
        {!item.summary && <p className="text-xs text-muted-foreground mt-0.5 italic">Espandi per un ripasso completo</p>}

        <AnimatePresence>
          {expanded && deepSummary && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mt-2 pt-2 border-t border-border">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{deepSummary}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {expanded && loadingDeep && (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Genero un ripasso dettagliato...</span>
          </div>
        )}
        <button onClick={() => expanded ? setExpanded(false) : fetchDeepSummary()}
          className="mt-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
          {expanded ? "Chiudi" : "Scopri di più"}
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        {showStrength && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${(item.strength || 0) < 30 ? "bg-destructive" : "bg-amber-500"}`}
                style={{ width: `${item.strength || 0}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{item.strength || 0}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Subject Group Card ───

const SubjectGroupCard = ({ group, gi, showStrength, section, methodCards, onStartStudy }: {
  group: { subject: string; items: any[]; latestAt: Date };
  gi: number;
  showStrength: boolean;
  section: Section;
  methodCards: { method: StudyMethod; icon: any; label: string; desc: string; color: string }[];
  onStartStudy: (concepts: any[], subject: string, method: StudyMethod, topic: string) => void;
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(group.items.map(i => i.id)));
  const allSelected = selectedIds.size === group.items.length;
  const noneSelected = selectedIds.size === 0;
  const colors = subjectColors[group.subject] || subjectColors.Matematica;
  const timeLabel = new Date(group.latestAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(group.items.map(i => i.id)));
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedConcepts = group.items.filter(i => selectedIds.has(i.id));

  const handleMethod = (method: StudyMethod) => {
    if (noneSelected) return;
    const topicLabel = selectedConcepts.map(c => c.concept).join(", ");
    onStartStudy(selectedConcepts, group.subject, method, topicLabel);
  };

  return (
    <motion.div key={`${group.subject}-${gi}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: gi * 0.05 }}
      className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-3 ${colors.bg || "bg-muted/30"} border-b border-border/50`}>
        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
          <BookOpen className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{group.subject}</p>
          <p className="text-[11px] text-muted-foreground">{group.items.length} concett{group.items.length === 1 ? "o" : "i"} · {timeLabel}</p>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <button onClick={toggleAll} className="flex items-center gap-3 group">
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
            allSelected ? "bg-primary border-primary shadow-sm" : "border-muted-foreground/25 hover:border-primary/60 bg-background"
          }`}>
            {allSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Tutti gli argomenti
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({selectedIds.size}/{group.items.length})
          </span>
        </button>
      </div>

      <div className="px-4 py-1 space-y-0">
        {group.items.map((item: any, i: number) => (
          <ConceptRow
            key={item.id}
            item={item}
            index={i}
            showStrength={showStrength}
            checked={selectedIds.has(item.id)}
            onToggle={() => toggleItem(item.id)}
          />
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">
          {section === "rinforza" ? "Scegli come vuoi rafforzare" : "Scegli come vuoi ripassare"}
        </p>
        <div className="flex items-center gap-1.5">
          {methodCards.map(mc => (
            <button
              key={mc.method}
              onClick={() => handleMethod(mc.method)}
              disabled={noneSelected}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${
                noneSelected
                  ? "opacity-30 cursor-not-allowed bg-muted text-muted-foreground"
                  : `${mc.color} hover:shadow-sm active:scale-[0.97]`
              }`}
            >
              <mc.icon className="w-3.5 h-3.5" />
              <span>{mc.label}</span>
            </button>
          ))}
        </div>
        {noneSelected && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">Seleziona almeno un argomento</p>
        )}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const MemoryRecap = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Section>("ripasso");
  const [wizard, setWizard] = useState<WizardState>({
    step: "home", section: null, contentType: null, subject: null, specificTopic: null, method: null,
  });
  const [specificInputRipasso, setSpecificInputRipasso] = useState("");
  const [specificInputRinforza, setSpecificInputRinforza] = useState("");
  const [autoNavigated, setAutoNavigated] = useState(false);
  const [activeStudy, setActiveStudy] = useState<{ subject: string; concepts: any[]; method: StudyMethod; topic: string } | null>(null);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const memoryData = await getMemoryItems();
      setItems(memoryData);
      setLoading(false);
    };
    load();
  }, [user]);

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

  const currentSection: Section = wizard.section || activeTab;

  const todayItems = useMemo(() => {
    const todayStart = getTodayStart();
    return items.filter(i => i.created_at >= todayStart).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [items]);

  // 3-level fallback for Rafforza: 0 = strength<50, 1 = strength<75, 2 = all
  const { weakItems, weakFallbackLevel } = useMemo(() => {
    const level0 = items.filter(i => (i.strength || 0) < 50).sort((a, b) => (a.strength || 0) - (b.strength || 0));
    if (level0.length > 0) return { weakItems: level0, weakFallbackLevel: 0 };
    const level1 = items.filter(i => (i.strength || 0) < 75).sort((a, b) => (a.strength || 0) - (b.strength || 0));
    if (level1.length > 0) return { weakItems: level1, weakFallbackLevel: 1 };
    if (items.length > 0) return { weakItems: [...items].sort((a, b) => (a.strength || 50) - (b.strength || 50)), weakFallbackLevel: 2 };
    return { weakItems: [], weakFallbackLevel: 0 };
  }, [items]);

  const getRelevantItems = (section: Section, contentType: ContentType): any[] => {
    if (section === "ripasso") {
      if (contentType === "today") return todayItems;
      if (contentType === "cumulative") return items;
      return [];
    }
    if (section === "rinforza") {
      if (contentType === "today") {
        const todayWeak = weakItems.filter(i => i.created_at >= getTodayStart());
        // Fallback to today's items if no weak ones today
        return todayWeak.length > 0 ? todayWeak : todayItems;
      }
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

  // ─── Start a study method ───
  const startStudyMethod = async (concepts: any[], subject: string, method: StudyMethod, topicLabel: string) => {
    if (method === "flashcard") {
      setGeneratingFlashcards(true);
      try {
        const profile = getProfile();
        const isStrengthen = currentSection === "rinforza";

        // In Rafforza mode, fetch learning errors and flagged cards for context
        let errorContext = "";
        if (isStrengthen) {
          let errors: any[] = [];
          let flagged: any[] = [];

          if (isChildSession()) {
            // Child session: use child-api to bypass RLS
            const [errorsData, flaggedData] = await Promise.all([
              childApi("get-learning-errors").catch(() => []),
              childApi("get-flagged-flashcards", { subject }).catch(() => []),
            ]);
            errors = (Array.isArray(errorsData) ? errorsData : []).filter((e: any) => e.subject === subject);
            flagged = Array.isArray(flaggedData) ? flaggedData : [];
          } else if (user) {
            // Authenticated user: query directly
            const [errorsRes, flaggedRes] = await Promise.all([
              supabase.from("learning_errors").select("topic, error_type, description").eq("user_id", user.id).eq("subject", subject).eq("resolved", false).limit(20),
              supabase.from("flashcards").select("question, answer").eq("user_id", user.id).eq("subject", subject).eq("is_flagged", true).limit(10),
            ]);
            errors = errorsRes.data || [];
            flagged = flaggedRes.data || [];
          }

          if (errors.length > 0 || flagged.length > 0) {
            errorContext = "\n\nCONTESTO ERRORI E DEBOLEZZE DELLO STUDENTE (PRIORITÀ MASSIMA - genera flashcard su questi punti deboli):\n";
            if (errors.length > 0) {
              errorContext += "Errori ricorrenti:\n" + errors.map((e: any) => `- ${e.topic}: ${e.description || e.error_type || "errore generico"}`).join("\n");
            }
            if (flagged.length > 0) {
              errorContext += "\nCarte precedentemente sbagliate:\n" + flagged.map((f: any) => `- D: ${f.question} / R: ${f.answer}`).join("\n");
            }
            errorContext += "\n\nGenera flashcard MIRATE su questi punti deboli, non sull'intero argomento.";
          }
        }

        const conceptTexts = concepts.map(c => `Concetto: ${c.concept}\nRiassunto: ${c.summary || "N/A"}`).join("\n\n");
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({
              subject,
              conversationHistory: conceptTexts + errorContext,
              schoolLevel: profile?.school_level || "superiori",
              lang: getCurrentLang(),
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const cards = (data.flashcards || data.cards || []).map((c: any, i: number) => ({
            id: `gen-${Date.now()}-${i}`,
            subject,
            question: c.question || c.front || "",
            answer: c.answer || c.back || "",
            difficulty: c.difficulty || 1,
            times_shown: 0, times_correct: 0, times_wrong: 0, is_flagged: false,
          }));
          if (cards.length > 0) {
            setGeneratedCards(cards);
            setActiveStudy({ subject, concepts, method: "flashcard", topic: topicLabel });
          }
        }
      } catch (e) { console.error("Error generating flashcards:", e); }
      finally { setGeneratingFlashcards(false); }
    } else {
      setActiveStudy({ subject, concepts, method, topic: topicLabel });
    }
  };

  const goBack = () => {
    if (activeStudy) { setActiveStudy(null); return; }
    if (wizard.step === "summary") {
      if (wizard.contentType === "specific") setWizard(w => ({ ...w, step: "home", section: null, contentType: null, specificTopic: null, subject: null }));
      else setWizard(w => ({ ...w, step: "subject-pick", subject: null }));
    }
    else if (wizard.step === "subject-pick") setWizard(w => ({ ...w, step: "home", section: null, contentType: null }));
    else navigate("/dashboard");
  };

  const pickOption = (section: Section, contentType: ContentType) => {
    if (contentType === "specific") return;
    setWizard({ step: "subject-pick", section, contentType, subject: null, specificTopic: null, method: null });
  };

  const submitSpecific = (section: Section, topic: string) => {
    if (!topic.trim()) return;
    setWizard({ step: "summary", section, contentType: "specific", subject: topic.trim(), specificTopic: topic.trim(), method: null });
  };

  const selectSubject = (subject: string) => {
    setWizard(w => ({ ...w, step: "summary", subject }));
  };

  const isRinforza = activeTab === "rinforza" || wizard.section === "rinforza";

  const methodCards: { method: StudyMethod; icon: any; label: string; desc: string; color: string }[] = [
    {
      method: "coach",
      icon: MessageCircle,
      label: isRinforza ? "Coach" : "Coach",
      desc: isRinforza ? "Ti aiuto a capire meglio i punti più difficili" : "Rivedi l'argomento passo dopo passo con il tuo Coach",
      color: "text-primary bg-primary/10",
    },
    {
      method: "flashcard",
      icon: Layers,
      label: "Flashcard",
      desc: isRinforza ? "Allenati sui concetti da consolidare" : "Allenati sui concetti chiave in modo rapido",
      color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      method: "challenge",
      icon: Zap,
      label: "Sfide",
      desc: isRinforza ? "Lavora su un punto debole con una mini missione" : "Mettiti alla prova con una mini missione",
      color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
    },
    {
      method: "game",
      icon: Gamepad2,
      label: "Giochi",
      desc: isRinforza ? "Capisci meglio con un'attività interattiva" : "Ripassa con un'attività più leggera e interattiva",
      color: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
  ];

  const getSubtitle = (): string => {
    if (wizard.step === "home") {
      return activeTab === "ripasso"
        ? "Rafforza la memoria con ripetizione attiva e spaziata"
        : "Lavora meglio su ciò che ti risulta più difficile";
    }
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

  if (generatingFlashcards) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Genero le flashcard...</p>
      </div>
    );
  }

  const renderSectionBlock = (section: Section) => {
    const isRipasso = section === "ripasso";
    const specificInput = isRipasso ? specificInputRipasso : specificInputRinforza;
    const setSpecificInput = isRipasso ? setSpecificInputRipasso : setSpecificInputRinforza;

    return (
      <div className="space-y-2.5">
        <button onClick={() => pickOption(section, "today")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
          <CalendarDays className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium text-foreground flex-1">Quello che hai studiato oggi</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        <button onClick={() => pickOption(section, "cumulative")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-soft transition-all text-left group">
          <Brain className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium text-foreground flex-1">Ripasso cumulativo</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Argomento specifico</span>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Input value={specificInput} onChange={e => setSpecificInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitSpecific(section, specificInput); }}
              placeholder="Es: frazioni, rivoluzione francese..." className="text-sm" />
            <Button onClick={() => submitSpecific(section, specificInput)} disabled={!specificInput.trim()} size="sm" className="shrink-0 px-4">Vai</Button>
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
            <PageBackButton to="/dashboard" />
            <h1 className="font-display text-lg font-bold text-foreground">
              {wizard.step === "home" ? (activeTab === "ripasso" ? "Ripassa" : "Rafforza") : (currentSection === "ripasso" ? "Ripassa" : "Rafforza")}
            </h1>
          </div>
          {!activeStudy && (
            <p className="text-sm text-muted-foreground ml-8 mb-3">{getSubtitle()}</p>
          )}
          {wizard.step === "home" && !activeStudy && (
            <div className="flex ml-8 gap-1">
              {(["ripasso", "rinforza"] as Section[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors relative ${
                    activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {tab === "ripasso" ? "Ripassa" : "Rafforza"}
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

          {/* HOME */}
          {wizard.step === "home" && !activeStudy && (
            <motion.div key={`home-${activeTab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-2.5 pt-1">
              {renderSectionBlock(activeTab)}
            </motion.div>
          )}

          {/* SUBJECT PICK */}
          {wizard.step === "subject-pick" && !activeStudy && (
            <motion.div key="subject-pick" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scegli la materia</p>
              {relevantSubjects.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="font-medium text-foreground">
                    {wizard.section === "rinforza" && items.length === 0
                      ? t("rafforza_empty_title", "Non hai ancora contenuti da rafforzare")
                      : wizard.contentType === "today"
                        ? t("rafforza_empty_today", "Nessun contenuto studiato oggi")
                        : t("rafforza_empty_generic", "Nessun contenuto disponibile")}
                  </p>
                  {wizard.section === "rinforza" && items.length === 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{t("rafforza_empty_desc", "Completa qualche sessione di studio prima.")}</p>
                      <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => navigate("/dashboard")}>
                        {t("rafforza_empty_cta", "Inizia a studiare")}
                      </Button>
                    </>
                  ) : (
                    <button onClick={goBack} className="mt-3 text-sm text-primary font-medium">{t("back", "Torna indietro")}</button>
                  )}
                </div>
              ) : (
                <>
                  {relevantSubjects.map(([subject, count], i) => {
                    const colors = subjectColors[subject] || subjectColors.Matematica;
                    return (
                      <motion.button key={subject} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring, delay: i * 0.04 }}
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

          {/* SUMMARY */}
          {wizard.step === "summary" && !activeStudy && (
            <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="space-y-4">

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

                summaryItems = [...summaryItems].sort((a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                if (summaryItems.length === 0) {
                  return (
                    <div className="text-center py-10 px-6">
                      <Brain className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="font-medium text-foreground">
                        {wizard.section === "rinforza" && items.length === 0
                          ? t("rafforza_empty_title", "Non hai ancora contenuti da rafforzare")
                          : t("rafforza_no_content", "Nessun contenuto trovato")}
                      </p>
                      {wizard.section === "rinforza" && items.length === 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{t("rafforza_empty_desc", "Completa qualche sessione di studio prima.")}</p>
                          <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => navigate("/dashboard")}>
                            {t("rafforza_empty_cta", "Inizia a studiare")}
                          </Button>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">{t("rafforza_try_other", "Prova con un'altra selezione")}</p>
                      )}
                    </div>
                  );
                }

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
                exerciseGroups.sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());

                return (
                  <div className="space-y-3">
                    {wizard.section === "rinforza" && weakFallbackLevel === 1 && (
                      <div className="rounded-xl bg-accent/50 border border-border px-4 py-3 text-sm text-muted-foreground">
                        💡 {t("rafforza_fallback_level1", "Nessun concetto critico trovato — ti mostriamo quelli che puoi ancora migliorare.")}
                      </div>
                    )}
                    {wizard.section === "rinforza" && weakFallbackLevel === 2 && (
                      <div className="rounded-xl bg-accent/50 border border-border px-4 py-3 text-sm text-muted-foreground">
                        🎉 {t("rafforza_fallback_level2", "Ottimo lavoro — nessun punto debole rilevato. Ecco un ripasso completo.")}
                      </div>
                    )}
                    {exerciseGroups.map((group, gi) => {
                      const showStrength = wizard.section === "rinforza";
                      return (
                        <SubjectGroupCard
                          key={`${group.subject}-${gi}`}
                          group={group}
                          gi={gi}
                          showStrength={showStrength}
                          section={currentSection}
                          methodCards={methodCards}
                          onStartStudy={startStudyMethod}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ACTIVE STUDY SESSION — uses standalone FlashcardSession page for flashcards */}
          {activeStudy && (
            <motion.div key="active-study" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {activeStudy.method === "coach" ? (
                <ReviewChat topic={activeStudy.topic} subject={activeStudy.subject}
                  section={currentSection} onClose={() => setActiveStudy(null)} />
              ) : activeStudy.method === "flashcard" ? (
                // Navigate to standalone FlashcardSession with generated cards
                (() => {
                  // Use inline minimal flashcard view that delegates to the standalone component behavior
                  const InlineFlashcardRedirect = () => {
                    useEffect(() => {
                      // Store generated cards in sessionStorage for the standalone page
                      if (generatedCards.length > 0) {
                        sessionStorage.setItem("inschool-generated-flashcards", JSON.stringify(generatedCards));
                        sessionStorage.setItem("inschool-flashcard-subject", activeStudy.subject);
                        navigate(`/flashcards?mode=topic&subject=${encodeURIComponent(activeStudy.subject)}&fromMemory=true`);
                      }
                    }, []);
                    return (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    );
                  };
                  return <InlineFlashcardRedirect />;
                })()
              ) : activeStudy.method === "challenge" ? (
                <ChallengeSession subject={activeStudy.subject}
                  topic={activeStudy.topic}
                  section={currentSection} concepts={activeStudy.concepts}
                  onClose={() => setActiveStudy(null)} />
              ) : (
                <GameSession subject={activeStudy.subject}
                  topic={activeStudy.topic}
                  section={currentSection} concepts={activeStudy.concepts}
                  onClose={() => setActiveStudy(null)} />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default MemoryRecap;
