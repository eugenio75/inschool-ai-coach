// ═══════════════════════════════════════════════════════════════
// MOMENTO DI APERTURA GIORNALIERA — versione conversazionale
// • Frase fissa + textarea libera (come prima).
// • Quando lo studente invia, il Coach risponde nello stesso schermo.
// • Tono "heavy": il Coach apre uno spazio e ascolta. Lo studente può
//   continuare a scrivere, ignorare e premere "Continua", o segnalare
//   che è pronto. Mai forzare.
// • Se il Coach percepisce segnali oltre lo stress scolastico, propone
//   Clauria con un bottone dedicato (link esterno, nuova tab).
// • Tutto il contenuto resta in memoria di questa pagina e non viene MAI
//   persistito. Solo il "tono" calibrato finisce in sessionStorage.
// • Se l'app viene aperta con ?from=clauria, mostra un breve bentornato.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getChildSession } from "@/lib/childSession";
import {
  DAILY_OPENING_PROMPT,
  markDailyOpeningDone,
  setDailyOpeningTone,
  shouldShowDailyOpening,
  type DailyOpeningTone,
} from "@/lib/dailyOpening";

// Backward-compat: alcuni file importano ancora da qui.
export { shouldShowDailyOpening as shouldShowCheckin, markDailyOpeningDone as markCheckinDone };

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };
const CLAURIA_URL = "https://www.clauria.azarlabs.com?return=sarai";

type Turn = { role: "user" | "assistant"; content: string; offerClauria?: boolean };

const EmotionalCheckin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromClauria = searchParams.get("from") === "clauria";

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationTone, setConversationTone] = useState<DailyOpeningTone | null>(null);
  const [readyToStart, setReadyToStart] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const childSession = getChildSession();
  const savedProfile = useMemo(() => {
    try {
      const stored = localStorage.getItem("inschool-profile");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Salta per profili genitore (nessun child attivo)
  const isParentUser = useMemo(() => {
    try {
      const meta = localStorage.getItem("inschool-signup-meta");
      if (meta) {
        const parsed = JSON.parse(meta);
        if (parsed?.school_level === "alunno") return true;
      }
    } catch {}
    return !childSession?.profile && !savedProfile;
  }, [childSession, savedProfile]);

  useEffect(() => {
    if (isParentUser) {
      markDailyOpeningDone();
      navigate("/dashboard", { replace: true });
    }
  }, [isParentUser, navigate]);

  // Difesa: se per qualunque motivo la pagina viene aperta quando già fatta
  // E non veniamo da Clauria, esci.
  useEffect(() => {
    if (!isParentUser && !fromClauria && !shouldShowDailyOpening()) {
      navigate("/dashboard", { replace: true });
    }
  }, [isParentUser, fromClauria, navigate]);

  // Auto-scroll quando arrivano nuovi turni
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  // Numero di turni utente: usato per la proposta gentile dopo 3 scambi
  const userTurns = turns.filter((t) => t.role === "user").length;

  const finishAndStart = (tone: DailyOpeningTone | null) => {
    if (tone) setDailyOpeningTone(tone);
    markDailyOpeningDone();
    navigate("/dashboard", { replace: true });
  };

  // Invia una risposta al Coach (mini-chat). Niente persistenza.
  const sendToCoach = async (nextTurns: Turn[]) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-opening-chat", {
        body: {
          messages: nextTurns.map((t) => ({ role: t.role, content: t.content })),
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "Sono qui.";
      const tone = (data as any)?.tone as DailyOpeningTone | undefined;
      const offerClauria = Boolean((data as any)?.offerClauria);
      const ready = Boolean((data as any)?.readyToStart);

      // Tono: una volta entrati in heavy non torniamo indietro nella stessa apertura
      const newTone: DailyOpeningTone =
        conversationTone === "heavy"
          ? "heavy"
          : tone === "heavy" || tone === "positive" || tone === "neutral"
            ? tone
            : "neutral";
      setConversationTone(newTone);

      setTurns([...nextTurns, { role: "assistant", content: reply, offerClauria }]);

      if (ready) {
        setReadyToStart(true);
        // Piccola pausa per leggere la risposta calda, poi entra in sessione
        window.setTimeout(() => finishAndStart(newTone), 1100);
      }
    } catch {
      setTurns([
        ...nextTurns,
        { role: "assistant", content: "Sono qui. Quando vuoi, partiamo con calma." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (busy || readyToStart) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = [...turns, { role: "user" as const, content: trimmed }];
    setTurns(next);
    setText("");
    await sendToCoach(next);
  };

  const handleContinue = () => {
    if (busy) return;
    // Skip puro o uscita esplicita: nessun salvataggio, niente segnali
    // Se c'è già stata una conversazione, manteniamo il tono inferito.
    finishAndStart(conversationTone);
  };

  if (isParentUser) return null;

  const isHeavyMode = conversationTone === "heavy";
  const showGentleOfferToStart = isHeavyMode && userTurns >= 3;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center sm:justify-center px-6 py-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="max-w-md w-full flex-1 sm:flex-initial flex flex-col"
      >
        <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col flex-1 sm:flex-initial overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-7 sm:p-8 sm:pb-5 space-y-4">
            {/* Welcome back from Clauria */}
            {fromClauria && (
              <div className="text-base sm:text-lg text-foreground/90 leading-relaxed font-medium">
                Bentornato. Prenditi il tempo che ti serve — siamo qui.
              </div>
            )}

            {/* Frase fissa di apertura */}
            <p className="text-base sm:text-lg text-foreground/90 leading-relaxed font-medium">
              {DAILY_OPENING_PROMPT}
            </p>

            {/* Conversazione mini (mai persistita) */}
            <AnimatePresence initial={false}>
              {turns.map((t, i) => {
                const isLastAssistant =
                  t.role === "assistant" && i === turns.length - 1;
                return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={
                    t.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 text-foreground px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap"
                      : "mr-auto max-w-[92%] text-foreground/90 text-[15px] leading-relaxed whitespace-pre-wrap"
                  }
                >
                  {t.content}
                  {t.role === "assistant" && t.offerClauria && (
                    <div className="mt-3">
                      <a
                        href={CLAURIA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background hover:bg-accent transition-colors px-4 py-2 text-sm font-medium"
                      >
                        Apri Clauria
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {busy && (
              <div className="mr-auto text-foreground/50 text-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>...</span>
              </div>
            )}

            {/* Suggerimento delicato dopo 3 scambi in heavy mode */}
            {showGentleOfferToStart && !busy && (
              <p className="text-foreground/60 text-[13px] italic leading-relaxed">
                Quando vuoi, possiamo iniziare — anche solo per poco. A volte aiuta.
              </p>
            )}

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder=""
              aria-label={DAILY_OPENING_PROMPT}
              className="min-h-[96px] resize-none rounded-xl text-base"
              autoFocus
              disabled={busy || readyToStart}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          <div
            className="sticky bottom-0 bg-card flex items-center justify-between gap-3 px-7 sm:px-8 pt-3 pb-4 sm:pb-6 border-t border-border/40 sm:border-t-0"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)" }}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={handleContinue}
              disabled={busy}
              className="rounded-xl px-3 text-foreground/70"
            >
              Continua
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={busy || readyToStart || text.trim().length === 0}
              className="rounded-xl px-5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Invia
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmotionalCheckin;
