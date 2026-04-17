import { Sparkles, Wrench, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CoachAction {
  id: string;
  label: string;
  icon: "recovery" | "parents" | "next";
  onClick: () => void;
  variant?: "primary" | "ghost";
}

interface Props {
  className?: string;
  coachName?: string;
  message: string;
  actions?: CoachAction[];
}

const ICONS = {
  recovery: Wrench,
  parents: Mail,
  next: ArrowRight,
} as const;

export default function ClassCoachHero({ className, coachName = "Astro", message, actions = [] }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[16px] border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {/* Soft glow */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex gap-3.5">
        {/* Coach avatar */}
        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/70 mb-1">
            {coachName} · Coach AI
          </p>
          <p className="text-[15px] leading-relaxed text-foreground">
            {message}
          </p>

          {actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((a) => {
                const Icon = ICONS[a.icon];
                const isPrimary = (a.variant ?? "primary") === "primary";
                return (
                  <Button
                    key={a.id}
                    onClick={a.onClick}
                    size="sm"
                    variant={isPrimary ? "default" : "ghost"}
                    className={cn(
                      "h-8 rounded-full text-xs font-medium",
                      isPrimary
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {a.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
