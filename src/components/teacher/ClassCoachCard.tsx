import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";

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
 * Coach SarAI card — large headline, soft evidence rows with pill buttons,
 * fused input at bottom. Refined "soft-card" design system.
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
    <section className="rounded-[32px] border border-border/60 bg-card/95 backdrop-blur overflow-hidden shadow-[0_10px_30px_-15px_hsl(var(--foreground)/0.08)]">
      {/* Header + headline */}
      <div className="border-b border-border/50 px-6 sm:px-7 pt-6 sm:pt-7 pb-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-[14px] font-bold shadow-sm">
            S
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground/80 leading-tight">Coach SarAI · oggi</p>
            <p className="text-[12px] text-muted-foreground leading-tight mt-0.5">Sintesi operativa della classe</p>
          </div>
        </div>

        <h2 className="max-w-3xl text-[28px] sm:text-[34px] leading-tight font-extrabold tracking-tight text-foreground">
          {headline}
        </h2>
        <p className="mt-4 max-w-3xl text-[15px] leading-7 text-muted-foreground">
          {paragraph}
        </p>
      </div>

      {/* Evidence rows */}
      {evidences.length > 0 && (
        <div className="px-6 sm:px-7 py-5 space-y-3 bg-muted/30">
          {evidences.map((ev) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-border/70 bg-card px-4 py-4 transition-all hover:-translate-y-px hover:shadow-[0_14px_34px_-20px_hsl(var(--foreground)/0.12)]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="max-w-2xl text-[15px] leading-7 text-foreground/85">
                  {ev.text}
                </p>
                <button
                  onClick={ev.onAction}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-5 py-2.5 text-[14px] font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  {ev.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
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
