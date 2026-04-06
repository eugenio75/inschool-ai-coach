import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, Gamepad2, CheckCircle, XCircle,
  PenLine, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isChildSession, getChildSession } from "@/lib/childSession";
import { autoCompleteMissions } from "@/lib/database";
import { getCurrentLang } from "@/lib/langUtils";
import { useTranslation } from "react-i18next";

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

function getProfile() {
  try {
    if (isChildSession()) return getChildSession()?.profile || null;
    const saved = localStorage.getItem("inschool-profile");
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export type GameSection = "ripasso" | "rinforza";
type GameType = "true-false" | "complete" | "memory-match" | "find-error";

interface GameItem {
  statement: string;
  isTrue?: boolean;
  answer?: string;
  correction?: string;
  shuffledOptions?: string[];
}

export const GameSession = ({ subject, topic, section, concepts, onClose }: {
  subject: string; topic: string; section: GameSection; concepts: any[]; onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [gameItems, setGameItems] = useState<GameItem[]>([]);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState<boolean | string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [textInput, setTextInput] = useState("");

  const gameCards: { type: GameType; labelKey: string; descKey: string; descKeyRinforza?: string; icon: any; forSection: GameSection[] }[] = [
    { type: "true-false", labelKey: "game_tf_label", descKey: "game_tf_desc", descKeyRinforza: "game_tf_desc_rinforza", icon: CheckCircle, forSection: ["ripasso", "rinforza"] },
    { type: "complete", labelKey: "game_complete_label", descKey: "game_complete_desc", descKeyRinforza: "game_complete_desc_rinforza", icon: PenLine, forSection: ["ripasso", "rinforza"] },
    { type: "find-error", labelKey: "game_find_error_label", descKey: "game_find_error_desc", icon: XCircle, forSection: ["rinforza"] },
    { type: "memory-match", labelKey: "game_match_label", descKey: "game_match_desc", icon: ListChecks, forSection: ["ripasso", "rinforza"] },
  ];

  const availableGames = gameCards.filter(g => g.forSection.includes(section));

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
    const conceptTexts = concepts.map((c: any) => `${c.concept}: ${c.summary || ""}`).join("\n");

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
          setGameItems(cards.map((c: any) => ({ statement: c.question, isTrue: c.correct === 0, correction: c.explanation || "" })));
        } else if (type === "find-error") {
          setGameItems(cards.map((c: any) => ({ statement: c.question, answer: c.options?.[0] || "", correction: c.explanation || "" })));
        } else if (type === "complete") {
          setGameItems(cards.map((c: any) => ({ statement: c.question, answer: c.options?.[0] || "", correction: c.explanation || "" })));
        } else {
          setGameItems(cards.filter((c: any) => c.options?.length >= 2).map((c: any) => {
            const correctAnswer = c.options[c.correct] || c.options[0];
            const shuffled = shuffleArray([...c.options]);
            return { statement: c.question, answer: correctAnswer, correction: c.explanation || "", shuffledOptions: shuffled };
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

  /* ─── Game selection screen ─── */
  if (!gameType) {
    return (
      <div className="min-h-[60vh] bg-muted/40 px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{t("game_choose_title")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {section === "rinforza" ? t("game_choose_subtitle_rinforza") : t("game_choose_subtitle_ripasso")}
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {availableGames.map((g, i) => (
              <motion.button
                key={g.type}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: i * 0.07 }}
                onClick={() => startGame(g.type)}
                className="bg-card rounded-2xl shadow-sm border border-border p-6 flex flex-col items-center text-center gap-3 hover:shadow-md hover:scale-[1.02] transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-accent/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <g.icon className="w-7 h-7 text-primary" />
                </div>
                <p className="text-base font-bold text-foreground">{t(g.labelKey)}</p>
                <p className="text-sm text-muted-foreground leading-snug">
                  {section === "rinforza" && g.descKeyRinforza ? t(g.descKeyRinforza) : t(g.descKey)}
                </p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="min-h-[60vh] bg-muted/40 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">{t("game_loading")}</p>
      </div>
    );
  }

  /* ─── Done / no items ─── */
  if (done || gameItems.length === 0) {
    const pct = gameItems.length > 0 ? Math.round((score / gameItems.length) * 100) : 0;
    return (
      <div className="min-h-[60vh] bg-muted/40 flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mx-auto mb-4">
            <Gamepad2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-1">
            {gameItems.length === 0 ? t("game_no_items") : t("game_completed")}
          </h2>
          {gameItems.length > 0 && (
            <>
              <p className="text-4xl font-bold text-primary mt-4">{pct}%</p>
              <p className="text-sm text-muted-foreground mt-1">{score} / {gameItems.length}</p>
              <div className="mt-3 text-sm text-muted-foreground">
                {pct >= 80 ? t("game_score_great") : pct >= 50 ? t("game_score_good") : t("game_score_retry")}
              </div>
            </>
          )}
          <Button onClick={onClose} className="w-full mt-6 h-12 rounded-xl text-base font-semibold">
            {t("game_back")}
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ─── Game play screen ─── */
  const item = gameItems[currentIdx];
  const progressPct = ((currentIdx + 1) / gameItems.length) * 100;

  return (
    <div className="min-h-[60vh] bg-muted/40 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" /> {t("game_back_btn")}
          </button>
          <span className="bg-primary/10 text-primary text-sm font-bold rounded-full px-3 py-1">
            {score} pt
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            {currentIdx + 1} / {gameItems.length}
          </span>
          <Progress value={progressPct} className="flex-1 h-2.5" />
        </div>

        {/* Question + answers card */}
        <motion.div key={currentIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5">

          {/* Question */}
          <p className="text-lg font-medium text-foreground leading-relaxed">{item.statement}</p>

          {/* True / False */}
          {gameType === "true-false" && (
            <div className="grid grid-cols-2 gap-3">
              {[t("game_true"), t("game_false")].map((label, i) => {
                const val = i === 0;
                let style = "border-border bg-card hover:border-primary/30";
                if (answered) {
                  if (val === item.isTrue) style = "border-green-400 bg-green-50 dark:bg-green-900/20";
                  else if (val === userAnswer) style = "border-destructive bg-destructive/5";
                  else style = "border-border bg-card opacity-60";
                }
                return (
                  <button key={label} onClick={() => handleTrueFalse(val)} disabled={answered}
                    className={`p-5 rounded-xl border-2 transition-all text-base font-semibold ${style}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Complete / Find error */}
          {(gameType === "complete" || gameType === "find-error") && (
            <div className="space-y-3">
              <input
                type="text" value={textInput} onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && textInput.trim()) handleTextAnswer(textInput.trim()); }}
                placeholder={gameType === "find-error" ? t("game_placeholder_correct") : t("game_placeholder_complete")}
                disabled={answered}
                className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              {!answered && (
                <Button onClick={() => textInput.trim() && handleTextAnswer(textInput.trim())} disabled={!textInput.trim()}
                  className="w-full h-12 rounded-xl text-base font-semibold">
                  {t("game_confirm")}
                </Button>
              )}
            </div>
          )}

          {/* Multiple choice */}
          {gameType === "memory-match" && item.shuffledOptions && (
            <div className="space-y-2.5">
              {item.shuffledOptions.map((opt, i) => {
                let style = "border-border bg-card hover:border-primary/30";
                if (answered) {
                  if (opt === item.answer) style = "border-green-400 bg-green-50 dark:bg-green-900/20";
                  else if (opt === userAnswer) style = "border-destructive bg-destructive/5";
                  else style = "border-border bg-card opacity-60";
                }
                return (
                  <button key={`${currentIdx}-${i}`} onClick={() => handleOptionSelect(opt)} disabled={answered}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all text-base ${style}`}>
                    <span className="font-medium text-foreground">{opt}</span>
                    {answered && opt === item.answer && <CheckCircle className="w-5 h-5 text-green-500 inline ml-2" />}
                    {answered && opt === userAnswer && opt !== item.answer && <XCircle className="w-5 h-5 text-destructive inline ml-2" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Feedback + next */}
          {answered && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-1">
              {item.correction && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground leading-relaxed">
                  💡 {item.correction}
                </div>
              )}
              <Button onClick={nextItem} className="w-full h-12 rounded-xl text-base font-semibold">
                {currentIdx + 1 >= gameItems.length ? t("game_see_results") : t("game_next")}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};