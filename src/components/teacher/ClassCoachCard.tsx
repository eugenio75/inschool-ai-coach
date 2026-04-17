import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

/**
 * Coach SarAI card — clean white card, bordered evidence rows,
 * AI badge top-left, fused input at bottom.
 */
export default function ClassCoachCard({ headline, paragraph, evidences, onAsk }: Props) {
  const [value, setValue] = useState("");

  function submit() {
    const q = value.trim();
    if (!q) return;
    onAsk(q);
    setValue("");
  }

  return (
    <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-7">
      {/* Header */}
      <div className="mb-4 sm:mb-5 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-[13px] font-bold">
          AI
        </div>
        <div>
          <p className="text-[14px] font-semibold text-primary leading-tight">Coach SarAI</p>
          <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">Sintesi della classe</p>
        </div>
      </div>

      {/* Headline + paragraph */}
      <h2 className="text-[20px] sm:text-[22px] font-semibold leading-snug text-foreground tracking-tight">
        {headline}
      </h2>
      <p className="mt-3 text-[14px] sm:text-[15px] leading-[1.65] text-muted-foreground">
        {paragraph}
      </p>

      {/* Evidence rows */}
      {evidences.length > 0 && (
        <div className="mt-5 space-y-3">
          {evidences.map((ev, i) => (
            <div
              key={ev.id}
              className="rounded-[18px] border border-border/70 p-4"
            >
              <p className="text-[14px] sm:text-[15px] font-semibold text-foreground leading-snug">
                {ev.text}
              </p>
              <button
                onClick={ev.onAction}
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors",
                  i === 0
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "border border-border bg-card text-foreground hover:bg-muted/60",
                )}
              >
                {ev.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fused input */}
      <div className="mt-5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Chiedi altro al Coach su questa classe..."
          className="w-full rounded-2xl border border-border bg-muted/40 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/80 outline-none transition-colors focus:border-primary/50 focus:bg-card"
        />
      </div>
    </section>
  );
}
