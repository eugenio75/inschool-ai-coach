import { useState } from "react";
import { Send, ArrowRight } from "lucide-react";
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
 * Coach SarAI card — single white card with header, headline, paragraph,
 * evidence rows, and a fused input at the bottom.
 *
 * Always presents itself as "Coach SarAI" (never "Astro").
 * Always shows interpretive analysis — never raw percentages or metrics.
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
    <div className="rounded-[22px] bg-card border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          S
        </div>
        <p className="text-[12px] font-medium text-muted-foreground">
          Coach SarAI · <span className="text-foreground/60">oggi</span>
        </p>
      </div>

      {/* Headline + paragraph */}
      <div className="px-5 pb-4">
        <h2 className="text-[17px] font-semibold leading-snug text-foreground mb-2">
          {headline}
        </h2>
        <p className="text-[14px] leading-relaxed text-foreground/70">
          {paragraph}
        </p>
      </div>

      {/* Evidence rows */}
      {evidences.length > 0 && (
        <div className="px-5 pb-5 space-y-2">
          {evidences.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center gap-3 rounded-[14px] bg-muted/60 p-3"
            >
              <p className="flex-1 text-[13px] leading-snug text-foreground/85">
                {ev.text}
              </p>
              <button
                onClick={ev.onAction}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 rounded-full",
                  "bg-card border border-border/70 hover:border-primary/40 hover:bg-primary/5",
                  "px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors",
                )}
              >
                {ev.actionLabel}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fused input — separated by hairline */}
      <div className="border-t border-border/60 px-3 py-2.5 flex items-center gap-2">
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
          className="flex-1 bg-transparent border-0 outline-none px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/70"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          className={cn(
            "shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-30 disabled:cursor-not-allowed",
          )}
          aria-label="Invia"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
