import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, Trophy, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { autoCompleteMissions } from "@/lib/database";
import { getCurrentLang } from "@/lib/langUtils";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

interface ChallengeQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export type ChallengeSection = "ripasso" | "rinforza";

export const ChallengeSession = ({ subject, topic, section, concepts, onClose }: {
  subject: string; topic: string; section: ChallengeSection; concepts: any[]; onClose: () => void;
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
    const conceptTexts = concepts.map((c: any) => `${c.concept}: ${c.summary || ""}`).join("\n");
    const challengeType = section === "rinforza"
      ? "sfide mirate al miglioramento: correggi errori, rimetti in ordine passaggi, scegli il procedimento corretto, applica concetti a esempi concreti"
      : "sfide brevi per attivare attenzione e memoria: domande rapide, abbina concetto e definizione, riconosci concetti";

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
