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

  function submit() {
    const q = value.trim();
    if (!q) return;
    onAsk(q);
    setValue("");
  }

  return (
    <section className="rounded-[32px] border border-border/60 bg-card/95 backdrop-blur overflow-hidden shadow-[0_10px_30px_-15px_hsl(var(--foreground)/0.08)]">
      {/* Header + headline */}
      <div className="border-b border-border/50 px-6 sm:px-7 pt-6 sm:pt-7 pb-5">
        <div className="mb-4 flex items-center gap-3">
          <CoachAvatar mood="default" size={44} />
          <div>
            <p className="text-[14px] font-semibold text-foreground/80 leading-tight">{coachName || "Coach"} · oggi</p>
            <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">Sintesi operativa della classe</p>
          </div>
        </div>

        <h2 className="max-w-3xl text-[34px] leading-tight font-extrabold tracking-tight text-foreground">
          {headline}
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          {paragraph}
        </p>
      </div>

      {/* Evidence rows — descriptive only */}
      {evidences.length > 0 && (
        <div className="px-6 sm:px-7 py-5 space-y-2 bg-muted/30">
          {evidences.map((ev) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-border/70 bg-card px-4 py-4"
            >
              <p className="text-[15px] leading-7 text-foreground/85">
                {ev.text}
              </p>
            </div>
          ))}

          {onShowFullPicture && (
            <div className="pt-3 flex justify-center">
              <button
                type="button"
                onClick={onShowFullPicture}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                Vedi il quadro completo della classe
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

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
            placeholder="Chiedi qualcosa sulla classe..."
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
