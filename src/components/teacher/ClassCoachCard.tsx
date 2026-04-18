import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { CoachAvatar } from "@/components/shared/CoachAvatar";
import { useLang } from "@/contexts/LangContext";

export interface CoachEvidence {
  id: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
}

interface Props {
  headline: string;
  paragraph: string;
  evidences: CoachEvidence[];
  onAsk: (question: string) => void;
  coachName?: string;
  /** Optional: navigate to the "quadro completo" page */
  onShowFullPicture?: () => void;
}

/**
 * Coach card — large headline, soft evidence rows with pill buttons,
 * fused input at bottom. Refined "soft-card" design system.
 */
export default function ClassCoachCard({ headline, paragraph, evidences, onAsk, coachName, onShowFullPicture }: Props) {
  const [value, setValue] = useState("");
  const { t } = useLang();

  function submit() {
    const q = value.trim();
    if (!q) return;
    onAsk(q);
    setValue("");
  }

  // Integrate all evidences into a single natural-prose paragraph
  const secondaryParagraph = evidences
    .map((ev) => ev.text.trim().replace(/[.;]+$/, ""))
    .filter(Boolean)
    .join(". ") + (evidences.length ? "." : "");

  return (
    <section className="rounded-[32px] border border-border/60 bg-card/95 backdrop-blur overflow-hidden shadow-[0_10px_30px_-15px_hsl(var(--foreground)/0.08)]">
      {/* Header + headline + paragraphs */}
      <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-5">
        <div className="mb-4 flex items-center gap-3">
          <CoachAvatar mood="default" size={44} />
          <div>
            <p className="text-[14px] font-medium text-foreground/80 leading-tight">{coachName || "Coach"} · {t("coach_card_today") || "oggi"}</p>
            <p className="text-[14px] font-normal text-muted-foreground leading-tight mt-0.5">{t("coach_card_subtitle") || "Sintesi operativa della classe"}</p>
          </div>
        </div>

        <h2 className="max-w-3xl text-[22px] font-bold leading-snug tracking-tight text-foreground">
          {headline}
        </h2>
        <p className="mt-4 max-w-3xl text-[16px] font-normal leading-[1.7] text-muted-foreground">
          {paragraph}
        </p>

        {secondaryParagraph && (
          <p className="mt-3 max-w-3xl text-[16px] font-normal leading-[1.7] text-muted-foreground/85">
            {secondaryParagraph}
          </p>
        )}

        {onShowFullPicture && (
          <div className="mt-5">
            <button
              type="button"
              onClick={onShowFullPicture}
              className="text-[14px] font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
            >
              {t("coach_card_explore") || "Approfondisci"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Fused input */}
      <div className="border-t border-border/50 px-6 sm:px-7 py-4 bg-card">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-2.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t("coach_card_input_placeholder") || "Chiedi qualcosa sulla classe..."}
            className="w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
          <button
            onClick={submit}
            className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors shrink-0"
            aria-label="Invia"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
