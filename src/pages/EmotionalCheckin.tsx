// ═══════════════════════════════════════════════════════════════
// MOMENTO DI APERTURA GIORNALIERA
// Una sola volta al giorno, al primo accesso dello studente.
// Frase fissa, testo libero, "Continua" sempre visibile.
// Il testo NON viene mai salvato né mostrato a docenti/genitori.
// Solo il tono calibrato resta in sessionStorage per la giornata.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getChildSession } from "@/lib/childSession";
import {
  DAILY_OPENING_PROMPT,
  analyzeOpeningTone,
  markDailyOpeningDone,
  setDailyOpeningTone,
  shouldShowDailyOpening,
} from "@/lib/dailyOpening";

// Backward-compat: alcuni file importano ancora da qui.
export { shouldShowDailyOpening as shouldShowCheckin, markDailyOpeningDone as markCheckinDone };

const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

const EmotionalCheckin = () => {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const childSession = getChildSession();
  const savedProfile = useMemo(() => {
    try {
      const stored = localStorage.getItem("inschool-profile");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const schoolLevel = (childSession?.profile?.school_level || savedProfile?.school_level) as
    | string
    | undefined;

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

  // Difesa: se per qualunque motivo la pagina viene aperta quando già fatta, esci.
  useEffect(() => {
    if (!isParentUser && !shouldShowDailyOpening()) {
      navigate("/dashboard", { replace: true });
    }
  }, [isParentUser, navigate]);

  const goNext = () => {
    markDailyOpeningDone();
    navigate("/dashboard", { replace: true });
  };

  const handleContinue = async () => {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) {
      // Skip puro: nessun salvataggio, nessun segnale.
      goNext();
      return;
    }
    setBusy(true);
    try {
      const tone = await analyzeOpeningTone(trimmed);
      setDailyOpeningTone(tone);
    } catch {
      // Fail-safe: niente tono, niente conseguenze.
    } finally {
      goNext();
    }
  };

  if (isParentUser) return null;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center sm:justify-center px-6 py-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="max-w-md w-full flex-1 sm:flex-initial flex flex-col"
      >
        <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col flex-1 sm:flex-initial overflow-hidden">
          <div className="flex-1 overflow-y-auto p-7 sm:p-8 sm:pb-5">
            <p className="text-base sm:text-lg text-foreground/90 leading-relaxed mb-5 font-medium">
              {DAILY_OPENING_PROMPT}
            </p>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder=""
              aria-label={DAILY_OPENING_PROMPT}
              className="min-h-[120px] resize-none rounded-xl text-base"
              autoFocus
              disabled={busy}
            />
          </div>

          <div
            className="sticky bottom-0 bg-card flex items-center justify-end px-7 sm:px-8 pt-3 pb-4 sm:pb-6 border-t border-border/40 sm:border-t-0"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)" }}
          >
            <Button
              onClick={handleContinue}
              disabled={busy}
              className="rounded-xl px-6"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continua
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmotionalCheckin;
